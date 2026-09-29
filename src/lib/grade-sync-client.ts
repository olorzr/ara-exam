import { toast } from 'sonner';
import { supabase } from './supabase';

/**
 * ara-system(학원 관리 시스템) 성적 자동 등록 — 클라이언트 발신부.
 *
 * 단어 시험지 생성·재시험 생성·개념지 저장·OMR 문제지 저장 네 곳이 이 한 함수를 쓴다.
 * 문제지 상세 화면의 '학원 성적에 등록' 단추는 결과를 보여 줘야 해서 `requestGradeSync` 를 기다린다.
 *
 * 의도적으로 fire-and-forget 이다 — 세션 조회와 전송을 모두 격리해 연동 실패가
 * 생성/저장 UX 를 막지 않고, `keepalive` 로 직후 페이지를 떠나도 요청이 살아남는다.
 *
 * ⚠️ **응답은 반드시 읽는다.** 예전엔 `.catch(() => {})` 로 응답을 통째로 버렸는데,
 * 그 탓에 2026-07-19~09-13 연동 env 가 비어 있는 동안 단어 시험 139건이 한 건도
 * 등록되지 않았는데도 **아무 신호가 없었다**(발신 라우트의 `not_configured` 가 200 이라
 * 상태 코드로도 안 보였다). 실패는 경고 토스트로 드러내되, 저장 자체는 이미 끝났으므로
 * 되돌리거나 막지 않는다.
 */

/** 발신 라우트(`/api/sync-*-to-grades`)의 응답 모양. */
export interface GradeSyncResponse {
  ok?: boolean;
  skipped?: boolean;
  reason?: string;
  status?: number;
  detail?: string;
  /** 수신부가 돌려준 오류 코드(예: `total_questions_locked`) — 같은 상태 코드의 다른 사유를 가른다 */
  intakeCode?: string;
  /** 발신 라우트가 사람에게 보일 문구를 직접 만든 경우(`omr_blocked`) */
  message?: string;
  /** 성공 시 수신부 응답 */
  result?: { created?: boolean; teacher?: string; answerKeyFrozen?: boolean; omrTemplateDetached?: boolean };
}

/** 사유별 안내 문구. 선생님이 무엇을 해야 하는지가 드러나야 한다. */
const REASON_MESSAGES: Record<string, string> = {
  not_configured: '연동이 설정되지 않았어요 (관리자에게 알려주세요)',
  unauthorized: '로그인이 만료됐어요. 새로고침 후 다시 저장해주세요',
  exam_not_found: '시험지를 찾지 못했어요',
  sheet_not_found: '개념지를 찾지 못했어요',
  words_read_failed: '단어를 읽지 못했어요',
  category_read_failed: '카테고리를 읽지 못해 학교급을 정할 수 없었어요',
  bad_body: '요청이 올바르지 않았어요',
  bad_examId: '요청이 올바르지 않았어요',
  bad_conceptSheetId: '요청이 올바르지 않았어요',
  bad_paperId: '요청이 올바르지 않았어요',
  paper_not_found: '문제지를 찾지 못했어요',
  omr_not_enabled: 'OMR 채점을 켜지 않은 문제지예요',
  items_read_failed: '문제지 문항을 읽지 못했어요',
  items_mismatch: '문제지 문항 수가 맞지 않아요 (관리자에게 알려주세요)',
  omr_blocked: '정답이 OMR 로 채점할 수 없는 모양이에요',
  omr_no_objective: '객관식 문항이 없어 OMR 로 채점할 수 없어요',
  exception: '알 수 없는 오류가 났어요',
};

/**
 * 응답을 보고 보여줄 경고 문구를 정한다.
 * @param res - 발신 라우트의 응답 본문. 네트워크 실패면 undefined
 * @returns 보여줄 문구, 또는 경고할 것이 없으면 null
 */
export function gradeSyncFailureMessage(res: GradeSyncResponse | undefined): string | null {
  // 네트워크·파싱 실패 — 응답 자체를 못 받았다
  if (!res) return '시험관리 시스템에 연결하지 못했어요';
  if (res.ok) return null;
  // 마킹된 개념 단어가 없으면 등록할 시험이 없는 게 정상이다(경고 아님)
  if (res.reason === 'no_marks') return null;
  // 라우트가 문항 번호까지 담아 만든 문구가 있으면 그것이 가장 정확하다
  if (res.reason === 'omr_blocked' && res.message) return res.message;

  if (res.reason === 'intake_failed') {
    if (res.status === 401) return '시험관리 시스템이 인증을 거절했어요 (주소·시크릿 확인 필요)';
    // 409 가 둘이다 — 이미 채점한 시험의 문항 수를 바꾸려 했거나(문제지·단어),
    // 재시험인데 원본 시험지가 아직 등록되지 않았다(단어, ara-system mig477).
    if (res.status === 409 && res.intakeCode === 'total_questions_locked') {
      return '이미 OMR 로 채점한 시험이라 문항 수를 바꿀 수 없어요';
    }
    if (res.status === 409) return '원본 시험지가 학원 성적에 아직 등록되지 않았어요 — 관리자에게 알려주세요';
    return `시험관리 시스템이 등록을 거절했어요 (${res.status ?? '오류'})`;
  }
  return REASON_MESSAGES[res.reason ?? ''] ?? '등록에 실패했어요';
}

/** 이 앱에서 성적 자동 등록을 트리거하는 라우트. */
export type GradeSyncPath = '/api/sync-to-grades' | '/api/sync-concept-to-grades' | '/api/sync-paper-to-grades';

/**
 * 성적 등록을 보내고 **응답을 돌려준다**. 던지지 않는다.
 * @param path - 발신 라우트 경로
 * @param body - 라우트가 받을 본문(`{ examId }`·`{ conceptSheetId }`·`{ paperId }`)
 * @returns 응답 본문. 응답을 못 받았으면 undefined, 로그인 세션이 없으면 null
 */
export async function requestGradeSync(
  path: GradeSyncPath,
  body: Record<string, string>,
  { keepalive = false }: { keepalive?: boolean } = {},
): Promise<GradeSyncResponse | undefined | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
      // 쏘고 떠나는 자동 등록만 페이지를 떠나도 살아남게 한다 — 기다리는 단추에는 필요 없다
      keepalive,
    });
    return (await res.json().catch(() => undefined)) as GradeSyncResponse | undefined;
  } catch {
    return undefined;
  }
}

/**
 * 성적 자동 등록을 쏘고, 실패하면 경고 토스트만 띄운다(생성/저장은 이미 끝났다).
 * 세션이 없으면 조용히 끝난다(예전 동작 그대로 — 로그인 화면으로 이미 넘어가는 중이다).
 * @param path - 발신 라우트 경로
 * @param body - 라우트가 받을 본문
 */
export function fireGradeSync(path: GradeSyncPath, body: Record<string, string>): void {
  void requestGradeSync(path, body, { keepalive: true }).then((json) => {
    if (json === null) return;
    const message = gradeSyncFailureMessage(json);
    if (message) toast.warning(`학원 성적 자동 등록 실패 — ${message}`);
  });
}
