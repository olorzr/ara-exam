import { supabase } from '@/lib/supabase';
import { sanitizeInlineHTML, sanitizeProblemHTML } from '@/lib/sanitize-problem';
import { normalizeCategoryName } from '@/lib/category-name';
import type { Bbox, Problem, RenderMode } from '@/types/problem-bank';

/**
 * 검수·편집에서 쓰는 쓰기.
 *
 * ⚠️ 이 표들은 **공유 표**다(개념지와 같은 모델). 두 사람이 같은 문항을 열면
 *    나중에 저장한 쪽이 이긴다 — 그래서 `updated_at` 을 조건에 걸어
 *    **0행이면 충돌**로 알린다. 조용히 덮어쓰면 남의 검수가 사라진다.
 *
 * ⚠️ 저장 직전에 다시 정화한다. 편집기가 이미 정화했더라도 화면을 우회한 값이 올 수 있다.
 */

/** 저장이 남의 수정과 부딪혔을 때 */
export class ConflictError extends Error {
  constructor() {
    super('다른 사람이 먼저 수정했어요. 새로고침한 뒤 다시 저장해 주세요.');
    this.name = 'ConflictError';
  }
}

/** 문항에서 사람이 고칠 수 있는 값 */
export interface ProblemPatch {
  stem_html?: string;
  choices?: string[];
  answer?: string;
  question_type?: Problem['question_type'];
  explanation_html?: string;
  area_path?: string[];
  /** 교과서 단원 이름 경로 [대단원, 소단원] */
  unit_path?: string[];
  work_title?: string;
  render_mode?: RenderMode;
  bbox?: Bbox | null;
  image_path?: string;
  passage_id?: string | null;
  number?: number | null;
}

/**
 * 문항을 저장한다(낙관적 동시성).
 * @param id - 문항 id
 * @param loadedUpdatedAt - 화면이 읽어 온 시점의 updated_at
 * @param patch - 바꿀 값
 * @returns 새 updated_at (연속 저장에 쓴다)
 * @throws ConflictError - 그 사이 남이 고쳤을 때
 */
export async function updateProblem(
  id: string,
  loadedUpdatedAt: string,
  patch: ProblemPatch,
): Promise<string> {
  const payload: Record<string, unknown> = { ...patch };
  if (patch.stem_html !== undefined) payload.stem_html = sanitizeProblemHTML(patch.stem_html);
  if (patch.explanation_html !== undefined) {
    payload.explanation_html = sanitizeProblemHTML(patch.explanation_html);
  }
  if (patch.choices !== undefined) payload.choices = patch.choices.map(sanitizeInlineHTML);
  if (patch.work_title !== undefined) payload.work_title = normalizeCategoryName(patch.work_title);

  const { data, error } = await supabase
    .from('problems')
    .update(payload)
    .eq('id', id)
    .eq('updated_at', loadedUpdatedAt)
    .select('updated_at');
  if (error) throw error;
  if (!data || data.length === 0) throw new ConflictError();
  return (data[0] as { updated_at: string }).updated_at;
}

/** 지문에서 사람이 고칠 수 있는 값 */
export interface PassagePatch {
  label?: string;
  title?: string;
  author?: string;
  html?: string;
  area_path?: string[];
  /** 교과서 단원 이름 경로 [대단원, 소단원] */
  unit_path?: string[];
  render_mode?: RenderMode;
  bbox?: Bbox | null;
  image_path?: string;
}

/**
 * 지문을 저장한다(낙관적 동시성).
 * @param id - 지문 id
 * @param loadedUpdatedAt - 화면이 읽어 온 시점의 updated_at
 * @param patch - 바꿀 값
 * @returns 새 updated_at
 * @throws ConflictError - 그 사이 남이 고쳤을 때
 */
export async function updatePassage(
  id: string,
  loadedUpdatedAt: string,
  patch: PassagePatch,
): Promise<string> {
  const payload: Record<string, unknown> = { ...patch };
  if (patch.html !== undefined) payload.html = sanitizeProblemHTML(patch.html);
  if (patch.title !== undefined) payload.title = normalizeCategoryName(patch.title);

  const { data, error } = await supabase
    .from('passages')
    .update(payload)
    .eq('id', id)
    .eq('updated_at', loadedUpdatedAt)
    .select('updated_at');
  if (error) throw error;
  if (!data || data.length === 0) throw new ConflictError();
  return (data[0] as { updated_at: string }).updated_at;
}

/**
 * 검수 완료 표시를 켜고 끈다.
 *
 * ⚠️ **새 `updated_at` 을 반드시 돌려주고 화면도 그 값으로 갱신해야 한다.**
 *    이 UPDATE 가 `problems_updated_at` 트리거를 건드리므로, 화면이 옛 값을 들고 있으면
 *    다음 본문 저장이 아무도 안 고쳤는데도 충돌로 튕긴다.
 *
 * ⚠️ 그리고 **읽어 온 버전을 조건으로 걸어야 한다.** 조건 없이 성공시키면 그 사이 남이 고친
 *    문항의 새 버전을 화면이 물려받으면서 본문은 옛것을 들고 있게 되고, 다음 저장이
 *    동시성 검사를 통과하며 **남의 수정을 조용히 덮어쓴다**(코덱스 리뷰 2R).
 * @param id - 문항 id
 * @param loadedUpdatedAt - 화면이 읽어 온 시점의 updated_at
 * @param verified - 완료로 표시할지
 * @returns 새 updated_at
 * @throws ConflictError - 그 사이 남이 고쳤을 때
 */
export async function setProblemVerified(
  id: string,
  loadedUpdatedAt: string,
  verified: boolean,
): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from('problems')
    .update({
      status: verified ? '검수완료' : '초안',
      verified_by: verified ? session.session?.user.id ?? null : null,
      verified_at: verified ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .eq('updated_at', loadedUpdatedAt)
    .select('updated_at');
  if (error) throw error;
  if (!data || data.length === 0) throw new ConflictError();
  return (data[0] as { updated_at: string }).updated_at;
}

/**
 * 문항을 지운다.
 * @param id - 문항 id
 * @throws 삭제 실패 시
 */
export async function deleteProblem(id: string): Promise<void> {
  const { error } = await supabase.from('problems').delete().eq('id', id);
  if (error) throw error;
}

/**
 * 지문을 지운다. 딸린 문항은 남고 `passage_id` 만 비워진다(FK ON DELETE SET NULL).
 * @param id - 지문 id
 * @throws 삭제 실패 시
 */
export async function deletePassage(id: string): Promise<void> {
  const { error } = await supabase.from('passages').delete().eq('id', id);
  if (error) throw error;
}

/**
 * 출처를 지운다. 지문·문항이 CASCADE 로 함께 사라진다.
 *
 * ⚠️ 이미 만든 문제지는 **스냅샷**이라 계속 인쇄된다(항목의 problem_id 만 null 이 된다).
 * @param id - 출처 id
 * @throws 삭제 실패 시
 */
export async function deleteSource(id: string): Promise<void> {
  const { error } = await supabase.from('problem_sources').delete().eq('id', id);
  if (error) throw error;
}

/**
 * 이 문항들이 이미 쓰인 문제지 수 — 지우기 전에 알려 주려고 센다.
 * @param problemIds - 문항 id 들
 * @returns 문제지 개수
 */
export async function countPapersUsing(problemIds: string[]): Promise<number> {
  if (problemIds.length === 0) return 0;
  const { data, error } = await supabase
    .from('problem_paper_items')
    .select('paper_id')
    .in('problem_id', problemIds)
    .limit(1000);
  if (error) return 0;
  return new Set((data ?? []).map((r) => (r as { paper_id: string }).paper_id)).size;
}

/**
 * 출처 상태를 바꾼다(검수중 → 완료).
 * @param id - 출처 id
 * @param status - 새 상태
 * @throws 저장 실패 시
 */
export async function setSourceStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('problem_sources').update({ status }).eq('id', id);
  if (error) throw error;
}
