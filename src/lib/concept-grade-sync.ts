import { supabase } from './supabase';

/**
 * 저장된 개념지를 ara-system 성적의 개념 3단계 시험으로 등록한다(멱등).
 *
 * 의도적으로 fire-and-forget 이다:
 * - 세션 조회와 전송을 모두 격리해, 연동 실패가 개념지 저장 UX 를 막지 않는다.
 * - `keepalive` 로 저장 직후 페이지를 떠나도 요청이 살아남는다.
 *
 * @param conceptSheetId - 저장된 개념지 id
 * @param markCount - 마킹된 개념 단어 수. 0 이면 등록할 시험이 없어 아무것도 하지 않는다
 */
export function fireConceptGradeSync(conceptSheetId: string, markCount: number): void {
  if (markCount === 0) return;

  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session?.access_token) return;
    fetch('/api/sync-concept-to-grades', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ conceptSheetId }),
      keepalive: true,
    }).catch(() => {});
  }).catch(() => {});
}
