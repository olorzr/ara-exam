import { fireGradeSync } from './grade-sync-client';

/**
 * 저장된 개념지를 ara-system 성적의 개념 시험으로 등록한다(멱등).
 *
 * 전송·실패 알림은 [grade-sync-client](./grade-sync-client.ts) 가 맡는다 —
 * 단어 시험지와 같은 규약을 쓰기 위해서다(fire-and-forget · keepalive · 실패 시 경고 토스트).
 *
 * @param conceptSheetId - 저장된 개념지 id
 * @param markCount - 마킹된 개념 단어 수. 0 이면 등록할 시험이 없어 아무것도 하지 않는다
 */
export function fireConceptGradeSync(conceptSheetId: string, markCount: number): void {
  if (markCount === 0) return;
  fireGradeSync('/api/sync-concept-to-grades', { conceptSheetId });
}
