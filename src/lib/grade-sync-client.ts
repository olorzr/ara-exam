import { toast } from 'sonner';
import { supabase } from './supabase';

/**
 * ara-system(학원 관리 시스템) 성적 자동 등록 — 클라이언트 발신부.
 *
 * 단어 시험지 생성·재시험 생성·개념지 저장 세 곳이 이 한 함수를 쓴다.
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

  if (res.reason === 'intake_failed') {
    if (res.status === 401) return '시험관리 시스템이 인증을 거절했어요 (주소·시크릿 확인 필요)';
    return `시험관리 시스템이 등록을 거절했어요 (${res.status ?? '오류'})`;
  }
  return REASON_MESSAGES[res.reason ?? ''] ?? '등록에 실패했어요';
}

/** 이 앱에서 성적 자동 등록을 트리거하는 두 라우트. */
export type GradeSyncPath = '/api/sync-to-grades' | '/api/sync-concept-to-grades';

/**
 * 성적 자동 등록을 쏘고, 실패하면 경고 토스트만 띄운다(생성/저장은 이미 끝났다).
 * @param path - 발신 라우트 경로
 * @param body - 라우트가 받을 본문(`{ examId }` 또는 `{ conceptSheetId }`)
 */
export function fireGradeSync(path: GradeSyncPath, body: Record<string, string>): void {
  supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      if (!session?.access_token) return;
      return fetch(path, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
        keepalive: true,
      })
        .then((res) => res.json().catch(() => undefined) as Promise<GradeSyncResponse | undefined>)
        .catch(() => undefined)
        .then((json) => {
          const message = gradeSyncFailureMessage(json);
          if (message) toast.warning(`학원 성적 자동 등록 실패 — ${message}`);
        });
    })
    .catch(() => {});
}
