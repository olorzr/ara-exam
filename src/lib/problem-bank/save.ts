import { supabase } from '@/lib/supabase';
import type { OcrMeta, ProblemSourceStatus } from '@/types/problem-bank';
import type { PassageDraft, ProblemDraft } from '@/lib/problem-ocr/merge';
import type { SourceInsertPayload } from './source-form';

/**
 * 기출 아카이브 쓰기.
 *
 * id 는 **클라이언트가 만든다**(`crypto.randomUUID`). 저장 전에 id 를 알아야
 * Storage 경로(`problems/{id}/region.jpg`)를 정하고 이미지를 올릴 수 있기 때문이다.
 *
 * ⚠️ `user_id` 를 보내지 않는다 — DB 트리거가 `auth.uid()` 로 채우고 UPDATE 에서 잠근다.
 *    보내도 무시되지만, 보내는 코드가 있으면 "여기서 정해진다"는 오해를 만든다.
 */

/** PostgREST 한 번에 보낼 행 수. 너무 크면 URL·본문 한도에 걸린다 */
const INSERT_CHUNK = 50;

/**
 * 출처 행을 만든다.
 *
 * ⚠️ `answer_key_paths` 는 **답지를 올렸을 때만** 보낸다(sql/19). 컬럼은 배포 직전에
 *    추가되므로, 늘 보내면 마이그레이션이 늦은 순간 **모든 업로드**가 PGRST204 로 죽는다.
 * @param id - 클라이언트가 만든 UUID
 * @param payload - 폼에서 정규화한 값
 * @param extra - 파일 경로·쪽 수·상태 (+ 별도 답지 경로)
 * @throws 저장 실패 시
 */
export async function insertSource(
  id: string,
  payload: SourceInsertPayload,
  extra: {
    file_path: string;
    page_count: number;
    status: ProblemSourceStatus;
    answer_key_paths?: string[];
  },
): Promise<void> {
  const { answer_key_paths: answerKeyPaths, ...rest } = extra;
  const { error } = await supabase
    .from('problem_sources')
    .insert({
      id,
      ...payload,
      ...rest,
      ...(answerKeyPaths && answerKeyPaths.length > 0
        ? { answer_key_paths: answerKeyPaths }
        : {}),
    });
  if (error) throw error;
}

/**
 * 출처의 상태·OCR 기록을 갱신한다.
 * @param id - 출처 id
 * @param patch - 바꿀 값
 * @throws 저장 실패 시
 */
export async function updateSource(
  id: string,
  patch: { status?: ProblemSourceStatus; ocr_meta?: OcrMeta; page_count?: number; file_path?: string },
): Promise<void> {
  const { error } = await supabase.from('problem_sources').update(patch).eq('id', id);
  if (error) throw error;
}

/** 저장할 때 함께 넣을 이미지 경로 (크롭이 끝난 뒤 채워진다) */
export type ImagePathMap = Map<string, string>;

/**
 * 본문 제자리에 끼울 그림 경로들 (항목 id → 1번부터 차례로).
 * ⚠️ 못 만든 자리는 **빈 문자열**이다 — 압축하면 본문 자리표시자가 엉뚱한 그림을 가리킨다.
 */
export type FigurePathMap = Map<string, string[]>;

/**
 * 지문을 저장한다.
 * @param sourceId - 출처 id
 * @param passages - 병합이 만든 지문 초안
 * @param imagePaths - 지문 id → 잘라 낸 이미지 경로
 * @param onChunk - 한 묶음이 실제로 들어갈 때마다 부른다 (부분 저장 추적용)
 * @throws 저장 실패 시
 */
export async function insertPassages(
  sourceId: string,
  passages: PassageDraft[],
  imagePaths: ImagePathMap = new Map(),
  onChunk?: (count: number) => void,
  figurePaths: FigurePathMap = new Map(),
): Promise<void> {
  const rows = passages.map((p) => ({
    id: p.id,
    source_id: sourceId,
    label: p.label,
    title: p.title,
    author: p.author,
    html: p.html,
    page_no: p.page_no,
    bbox: p.box ? { column: p.box.column, top: p.box.top, bottom: p.box.bottom } : null,
    image_path: imagePaths.get(p.id) ?? '',
    figure_paths: figurePaths.get(p.id) ?? [],
    // 검수에서 사람이 바꿀 수 있다.
    //
    // ⚠️ 단, **여러 쪽에 걸친 지문은 제안하지 않는다.** 잘라 둔 이미지는 시작 쪽 하나뿐이라
    //    이미지 출제로 두면 이어지는 뒷부분이 인쇄물에서 통째로 사라진다(코덱스 리뷰 2R).
    //    이런 지문은 글로 인쇄하고, 필요하면 검수에서 사람이 직접 바꾼다.
    //
    // ⚠️ **그림을 제자리에 끼웠으면 글로 둔다.** 그림이 본문 안에 있으면 이미지로 통째
    //    출제할 까닭이 없다 — 글로 두어야 편집·검색되고 문제지에서 다시 조판된다
    render_mode: renderModeFor(p.has_figure && p.pageSpan === 1, imagePaths, figurePaths, p.id),
    area_path: p.area_path,
    unit_path: p.unit_path,
  }));
  await insertChunked('passages', rows, onChunk);
}

/**
 * 문항을 저장한다.
 * @param sourceId - 출처 id
 * @param problems - 병합이 만든 문항 초안
 * @param imagePaths - 문항 id → 잘라 낸 이미지 경로
 * @param onChunk - 한 묶음이 실제로 들어갈 때마다 부른다 (부분 저장 추적용)
 * @throws 저장 실패 시
 */
export async function insertProblems(
  sourceId: string,
  problems: ProblemDraft[],
  imagePaths: ImagePathMap = new Map(),
  onChunk?: (count: number) => void,
  figurePaths: FigurePathMap = new Map(),
): Promise<void> {
  const rows = problems.map((p) => ({
    id: p.id,
    source_id: sourceId,
    passage_id: p.passage_id,
    number: p.number,
    question_type: p.question_type,
    stem_html: p.stem_html,
    choices: p.choices,
    answer: p.answer ?? '',
    area_path: p.area_path,
    unit_path: p.unit_path,
    grammar_paths: p.grammar_paths,
    work_title: p.work_title,
    page_no: p.page_no,
    bbox: p.box ? { column: p.box.column, top: p.box.top, bottom: p.box.bottom } : null,
    image_path: imagePaths.get(p.id) ?? '',
    figure_paths: figurePaths.get(p.id) ?? [],
    render_mode: renderModeFor(p.has_figure, imagePaths, figurePaths, p.id),
  }));
  await insertChunked('problems', rows, onChunk);
}

/**
 * 처음 제안할 인쇄 방식.
 *
 * 순서가 중요하다:
 *  ① 그림을 **본문 제자리에 하나라도 끼웠으면** 글로 둔다 — 그게 가장 쓸모 있는 모양이다
 *    (편집·검색되고 문제지에서 다시 조판된다).
 *  ② 못 끼웠는데 그림이 있다고 표시됐고 항목 이미지가 있으면 통째로 이미지 출제.
 *    프롬프트가 "옮길 수 있는 글자만 적으라" 고 시켰으므로 글만으로는 온전하지 않다.
 *  ③ 나머지는 글.
 * 검수에서 사람이 바꿀 수 있다.
 * @param needsImage - 그림이 있어 글만으로는 온전하지 않은가
 * @param imagePaths - 항목 전체 이미지
 * @param figurePaths - 본문에 끼운 그림들
 * @param id - 항목 id
 * @returns 'text' 또는 'image'
 */
function renderModeFor(
  needsImage: boolean,
  imagePaths: ImagePathMap,
  figurePaths: FigurePathMap,
  id: string,
): 'text' | 'image' {
  if ((figurePaths.get(id) ?? []).some(Boolean)) return 'text';
  return needsImage && imagePaths.has(id) ? 'image' : 'text';
}

/**
 * 묶음으로 나눠 넣는다.
 *
 * ⚠️ 중간에 실패해도 **앞 묶음은 이미 들어가 있다**(트랜잭션이 아니다).
 *    호출부가 "하나도 안 들어갔다" 고 오해하면 복구 안내가 거짓말이 되므로,
 *    묶음이 들어갈 때마다 알린다(코덱스 리뷰 13R).
 */
async function insertChunked(
  table: string,
  rows: Record<string, unknown>[],
  onChunk?: (count: number) => void,
): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw error;
    onChunk?.(chunk.length);
  }
}

/**
 * 잘라 낸 이미지 경로를 나중에 채운다(크롭이 저장보다 늦게 끝날 때).
 * @param table - 'problems' | 'passages'
 * @param id - 행 id
 * @param imagePath - Storage 경로
 */
export async function setImagePath(
  table: 'problems' | 'passages',
  id: string,
  imagePath: string,
): Promise<void> {
  const { error } = await supabase.from(table).update({ image_path: imagePath }).eq('id', id);
  if (error) throw error;
}
