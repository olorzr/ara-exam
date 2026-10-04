import { supabase } from '@/lib/supabase';
import { uploadProblemFile } from '@/lib/problem-bank/storage';
import { newFigureToken, paperCoverPath } from '@/lib/problem-bank/storage-paths';
import { normalizePaperCover, toCoverRow, type PaperCover } from './cover';

/**
 * 문제지 표지 읽기·쓰기 (`exam.problem_paper_covers`, sql/61).
 *
 * 행이 없으면 '표지 없음' 이다. 저장은 `paper_id` 로 upsert 한다 — 같은 표지를 두 선생님이
 * 동시에 고치는 일은 드물고, 겹치면 나중 저장이 이긴다(표지는 시험 내용이 아니라 인쇄 꾸밈이라
 * 낙관적 동시성까지 두지 않았다).
 */

const COVER_COLUMNS = 'paper_id, kind, title, subtitle, show_name_box, image_path';

/**
 * 문제지 표지를 읽는다.
 * @param paperId - 문제지 id
 * @returns 표지. 없으면 null
 * @throws 조회 실패 시 (호출부가 알린다 — '표지 없음' 과 '못 읽음' 은 다르다)
 */
export async function fetchPaperCover(paperId: string): Promise<PaperCover | null> {
  const { data, error } = await supabase
    .from('problem_paper_covers')
    .select(COVER_COLUMNS)
    .eq('paper_id', paperId)
    .maybeSingle();
  if (error) throw error;
  return normalizePaperCover(data);
}

/**
 * 표지 그림을 올리고 경로를 돌려준다. 이름은 한 번만 쓰는 것이라 옛 그림을 덮지 않는다.
 * @param paperId - 문제지 id
 * @param jpeg - 다시 인코딩한 JPEG (`encodeCoverJpeg`)
 * @returns 버킷 기준 경로
 */
export async function uploadPaperCoverImage(paperId: string, jpeg: Blob): Promise<string> {
  const path = paperCoverPath(paperId, newFigureToken());
  await uploadProblemFile(path, jpeg, 'image/jpeg');
  return path;
}

/**
 * 표지를 저장한다(없으면 만들고 있으면 바꾼다).
 * @param paperId - 문제지 id
 * @param cover - 표지 (그림이면 경로가 이미 올라가 있어야 한다)
 * @returns DB 에 실제로 들어간 표지
 * @throws 저장 실패 시
 */
export async function savePaperCover(paperId: string, cover: PaperCover): Promise<PaperCover> {
  const { data, error } = await supabase
    .from('problem_paper_covers')
    .upsert(toCoverRow(paperId, cover), { onConflict: 'paper_id' })
    .select(COVER_COLUMNS)
    .single();
  if (error) throw error;
  const saved = normalizePaperCover(data);
  if (!saved) throw new Error('표지를 저장했지만 다시 읽지 못했어요.');
  return saved;
}

/**
 * 표지를 없앤다. 그림 파일은 남긴다(다른 탭이 그 경로로 인쇄 중일 수 있다).
 * ⚠️ `delete()` 는 0행을 지워도 error 가 null 이라 지운 행을 돌려받아 확인한다.
 * @param paperId - 문제지 id
 * @throws 지우지 못했으면
 */
export async function removePaperCover(paperId: string): Promise<void> {
  const { data, error } = await supabase
    .from('problem_paper_covers')
    .delete()
    .eq('paper_id', paperId)
    .select('paper_id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('이미 지워졌거나 지울 수 없는 표지예요.');
}
