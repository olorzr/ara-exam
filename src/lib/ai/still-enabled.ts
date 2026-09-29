import { authFetch } from '@/lib/auth-fetch';
import type { AiFeature } from './types';

/**
 * 서버의 킬스위치를 **시작 직전에** 다시 확인한다.
 *
 * `useAiEnabled` 는 화면이 뜰 때 한 번만 물어본다. 탭을 열어 둔 사이에 기능을 껐다면
 * 그 탭에서는 계속 새 작업이 나가 버린다 — 배포 없이 끄는 스위치가 되지 못한다.
 * 확인 자체가 실패해도 **막는다**(fail-closed) — 코덱스 리뷰 13R.
 *
 * 시험지 화면의 '다음 쪽 이어 읽기', 학교 프린트 읽기·단어 등록·문답, 빈칸 추천,
 * O,X·단답형이 같은 것을 쓴다 — 게이트가 여러 벌이면 한쪽만 고쳐져 꺼 둔 기능이 계속 나간다.
 * (예전에는 기출 업로드 훅 `useProblemOcr` 에 있었다. 그 화면을 2026-09-30 에 걷으며 옮겼다.)
 * ⚠️ **취소 신호를 받는다**(코덱스 리뷰 3R). 이 확인을 기다리는 동안 부르는 쪽이 이미 실행
 * 자리를 맡아 두므로, 요청이 멎으면 '취소' 를 눌러도 풀 길이 없어 화면이 잠긴 채로 남는다.
 * 끊기면 여느 실패와 같이 **false**(fail-closed)다 — 부르는 쪽이 `signal.aborted` 로
 * '사람이 끊은 것' 과 '기능이 꺼진 것' 을 가른다.
 * @param feature - 확인할 기능 (기본: 기출 OCR)
 * @param signal - 취소 신호(선택)
 * @returns 지금 써도 되면 true
 */
export async function ocrStillEnabled(
  feature: AiFeature = 'problem_ocr',
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const res = await authFetch('/api/ai/status', signal ? { signal } : {});
    if (!res.ok) return false;
    const json = await res.json();
    return json?.enabled === true && json?.features?.[feature] === true;
  } catch {
    return false;
  }
}
