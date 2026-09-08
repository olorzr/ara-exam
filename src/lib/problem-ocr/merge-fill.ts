import { normalizeGrammarPaths } from '@/lib/problem-bank/grammar-tree';
import { textOf } from './merge-keys';
import type { OcrItem } from './schema';
import type { PassageDraft, ProblemDraft } from './merge';

/**
 * 묶음 결과 → 저장 직전 초안으로 옮기기와 **빈 칸 채우기** (순수 함수).
 *
 * 병합(merge.ts)에서 떼어 둔 이유: "무엇을 언제 덮어쓰는가" 가 이 도메인에서 가장
 * 미묘한 부분이라서다. 규칙은 하나다 — **비어 있을 때만 채운다.** 그래야 사람이 검수한
 * 값도, 먼저 읽은 값도 나중 묶음이 되돌리지 못한다.
 */

/** 병합 중에만 쓰는 상태 — 조각을 따로 들고 있다가 끝에 합친다 */
export interface PassageWork {
  draft: PassageDraft;
  fragments: string[];
}

/** 중복 판정 키가 가리키는 자리 — 어느 지문의 몇 번째 조각인가 */
export interface FragmentRef {
  work: PassageWork;
  index: number;
}

export function toPassage(item: OcrItem, id: string): PassageWork {
  return {
    draft: {
      id,
      label: item.label ?? '',
      title: item.title ?? '',
      author: item.author ?? '',
      html: item.html,
      page_no: item.page,
      box: item.box,
      area_path: item.area_path,
      unit_path: item.unit_path,
      has_figure: item.has_figure,
      lastPage: item.page,
      open: item.continues,
      pageSpan: 1,
    },
    fragments: [item.html],
  };
}

export function toProblem(item: OcrItem, id: string, passageId: string | null): ProblemDraft {
  return {
    id,
    passage_id: passageId,
    number: item.number,
    question_type: item.question_type,
    stem_html: item.stem_html,
    choices: item.choices,
    answer: item.answer,
    // OCR 은 배점을 읽지 않는다 — 컬럼을 지키려고 자리만 채운다
    score: null,
    work_title: item.work_title ?? '',
    area_path: item.area_path,
    unit_path: item.unit_path,
    grammar_paths: item.grammar_paths,
    page_no: item.page,
    box: item.box,
    has_figure: item.has_figure,
  };
}

/**
 * 이미 담은 지문의 빈 칸만 채운다.
 *
 * 겹쳐 읽은 조각과 이어지는 조각 **양쪽에서** 부른다 — 어느 쪽이든 나중 묶음에서만
 * 작품명·영역·단원을 알아볼 수 있고, 그때 채우지 않으면 분류가 사라진다.
 */
export function fillPassageGaps(draft: PassageDraft, item: OcrItem): void {
  draft.lastPage = Math.max(draft.lastPage, item.page);
  if (!draft.label && item.label) draft.label = item.label;
  if (!draft.title && item.title) draft.title = item.title;
  if (!draft.author && item.author) draft.author = item.author;
  // ⚠️ 좌표는 **같은 쪽에서 읽은 것만** 받는다. box 와 page_no 는 짝이라(크롭이 둘을 함께
  //    쓴다) 이어지는 쪽의 좌표를 첫 쪽에 붙이면 엉뚱한 자리를 잘라 낸다(코덱스 리뷰 2R)
  if (!draft.box && item.box && item.page === draft.page_no) draft.box = item.box;
  if (draft.area_path.length === 0 && item.area_path.length > 0) draft.area_path = item.area_path;
  if (draft.unit_path.length === 0 && item.unit_path.length > 0) draft.unit_path = item.unit_path;
  if (item.has_figure) draft.has_figure = true;
}

/** 이미 담은 문항의 빈 칸만 채운다 */
export function fillGaps(target: ProblemDraft, item: OcrItem): void {
  if (!textOf(target.stem_html) && item.stem_html) target.stem_html = item.stem_html;
  if (target.choices.length === 0 && item.choices.length > 0) target.choices = item.choices;
  // 정답과 유형은 한 덩어리다 — 유형이 바뀌면 정답의 의미가 달라진다
  if (target.answer === null && item.answer !== null) {
    target.answer = item.answer;
    target.question_type = item.question_type;
  }
  if (!target.work_title && item.work_title) target.work_title = item.work_title;
  if (target.area_path.length === 0 && item.area_path.length > 0) target.area_path = item.area_path;
  if (target.unit_path.length === 0 && item.unit_path.length > 0) target.unit_path = item.unit_path;
  // ⚠️ 문법만 **합집합**이다. 나머지 축은 경로 하나라 '비어 있을 때만 채운다' 가 맞지만,
  //    문법 태그는 서로 배타적이지 않고 겹쳐 읽은 묶음이 각각 다른 개념을 알아봤을 수 있다.
  //    빈 칸 규칙을 그대로 쓰면 나중 묶음이 본 개념이 통째로 버려진다
  if (item.grammar_paths.length > 0) {
    target.grammar_paths = normalizeGrammarPaths([
      ...target.grammar_paths, ...item.grammar_paths,
    ]);
  }
  if (!target.box && item.box) target.box = item.box;
  if (item.has_figure) target.has_figure = true;
}
