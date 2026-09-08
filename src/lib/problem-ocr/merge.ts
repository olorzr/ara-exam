import type { QuestionType } from '@/types/problem-bank';
import { OCR_MAX_WARNINGS } from './constants';
import type { OcrBox, OcrDraft, OcrItem } from './schema';

/**
 * 묶음별 초안 → 저장 직전의 지문·문항 목록 (순수 함수).
 *
 * 묶음은 **겹쳐서** 읽는다(batch-plan.ts). 그래서 같은 항목이 두 묶음에 나오는 것이
 * 정상이고, 여기서 합치는 것이 이 함수의 본업이다.
 *
 * 중복을 다루는 규칙이 지문과 문항에서 **다르다**:
 *  - 지문: **더 완전한 쪽이 이긴다**(글이 긴 쪽). 겹침의 목적 자체가 쪽 경계에서 잘린
 *    지문을 통째로 본 묶음의 결과를 얻는 것이라, 먼저 온 것을 고집하면 잘린 지문이 남는다.
 *  - 문항: **먼저 온 것이 이기되 빈 칸만 나중 것이 채운다.** 발문·선지는 어느 묶음에서 읽든
 *    같지만, 정답·배점은 정답표가 실린 쪽을 본 묶음에만 있을 수 있다.
 *
 * ⚠️ 정답(answer)과 유형(question_type)은 **한 덩어리로** 옮긴다.
 *    유형이 바뀌면 정답의 의미가 달라지기 때문이다('1' 은 객관식에서만 선지 번호다).
 */

/** 저장 직전의 지문 */
export interface PassageDraft {
  id: string;
  label: string;
  title: string;
  author: string;
  html: string;
  /** 지문이 시작한 쪽 */
  page_no: number;
  box: OcrBox | null;
  area_path: string[];
  has_figure: boolean;
  /** 이어 붙인 마지막 쪽 (크롭 범위 안내용) */
  lastPage: number;
  /** 아직 다음 쪽으로 이어지는 중인가 */
  open: boolean;
}

/** 저장 직전의 문항 */
export interface ProblemDraft {
  id: string;
  passage_id: string | null;
  number: number | null;
  question_type: QuestionType;
  stem_html: string;
  choices: string[];
  answer: string | null;
  score: number | null;
  work_title: string;
  area_path: string[];
  page_no: number;
  box: OcrBox | null;
  has_figure: boolean;
}

export interface MergeResult {
  passages: PassageDraft[];
  problems: ProblemDraft[];
  warnings: string[];
}

/** 한 묶음의 결과와 그 묶음이 읽은 쪽 */
export interface DraftWithPages {
  draft: OcrDraft;
  pages: number[];
}

export interface MergeOptions {
  /** id 생성기. 테스트에서 결정론적으로 바꾸려고 주입식으로 둔다 */
  newId?: () => string;
  /** 묶음 실행 중 생긴 경고(렌더 실패 등)를 앞에 붙인다 */
  leadingWarnings?: string[];
}

/** 태그를 걷어낸 본문 — 길이 비교와 중복 판정에 쓴다 */
function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 중복 판정 키. 라벨이 없으면 본문 앞부분으로 대신한다 */
function passageKey(item: OcrItem): string {
  const label = (item.label ?? '').trim();
  return label
    ? `${item.page}|L|${label}`
    : `${item.page}|H|${textOf(item.html).slice(0, 40)}`;
}

function problemKey(item: OcrItem): string {
  return item.number !== null
    ? `${item.page}|N|${item.number}`
    : `${item.page}|S|${textOf(item.stem_html).slice(0, 40)}`;
}

function toPassage(item: OcrItem, id: string): PassageDraft {
  return {
    id,
    label: item.label ?? '',
    title: item.title ?? '',
    author: item.author ?? '',
    html: item.html,
    page_no: item.page,
    box: item.box,
    area_path: item.area_path,
    has_figure: item.has_figure,
    lastPage: item.page,
    open: item.continues,
  };
}

function toProblem(item: OcrItem, id: string, passageId: string | null): ProblemDraft {
  return {
    id,
    passage_id: passageId,
    number: item.number,
    question_type: item.question_type,
    stem_html: item.stem_html,
    choices: item.choices,
    answer: item.answer,
    score: item.score,
    work_title: item.work_title ?? '',
    area_path: item.area_path,
    page_no: item.page,
    box: item.box,
    has_figure: item.has_figure,
  };
}

/** 이미 담은 문항의 빈 칸만 채운다 */
function fillGaps(target: ProblemDraft, item: OcrItem): void {
  if (!textOf(target.stem_html) && item.stem_html) target.stem_html = item.stem_html;
  if (target.choices.length === 0 && item.choices.length > 0) target.choices = item.choices;
  // 정답과 유형은 한 덩어리다 — 유형이 바뀌면 정답의 의미가 달라진다
  if (target.answer === null && item.answer !== null) {
    target.answer = item.answer;
    target.question_type = item.question_type;
  }
  if (target.score === null && item.score !== null) target.score = item.score;
  if (!target.work_title && item.work_title) target.work_title = item.work_title;
  if (target.area_path.length === 0 && item.area_path.length > 0) target.area_path = item.area_path;
  if (!target.box && item.box) target.box = item.box;
  if (item.has_figure) target.has_figure = true;
}

/**
 * 앞 묶음에서 아직 열려 있는(다음 쪽으로 이어지는) 지문을 찾는다.
 * 바로 앞 쪽에서 끊긴 것만 후보다 — 멀리 있는 지문에 잘못 붙이면 두 글이 뒤섞인다.
 */
function findOpenPassage(passages: PassageDraft[], page: number): PassageDraft | undefined {
  for (let i = passages.length - 1; i >= 0; i -= 1) {
    const p = passages[i];
    if (p.open && p.lastPage === page - 1) return p;
  }
  return undefined;
}

/**
 * 묶음별 초안을 하나로 합친다.
 * @param drafts - 묶음 순서대로의 초안과 그 묶음이 읽은 쪽
 * @param opts - id 생성기·선행 경고
 * @returns 합쳐진 지문·문항과 경고
 */
export function mergeOcrDrafts(drafts: DraftWithPages[], opts: MergeOptions = {}): MergeResult {
  const newId = opts.newId ?? (() => crypto.randomUUID());
  const warnings: string[] = [...(opts.leadingWarnings ?? [])];

  const passages: PassageDraft[] = [];
  const problems: ProblemDraft[] = [];
  const passageByKey = new Map<string, PassageDraft>();
  const problemByKey = new Map<string, ProblemDraft>();

  const warn = (message: string) => {
    if (warnings.length < OCR_MAX_WARNINGS && !warnings.includes(message)) warnings.push(message);
  };

  for (const { draft } of drafts) {
    warnings.push(...draft.warnings.filter((w) => !warnings.includes(w)));

    // 이 묶음의 ref → 합쳐진 지문 id. ref 는 묶음 안에서만 유효하다
    const refToId = new Map<string, string>();

    // 1) 지문 먼저 — 문항이 참조를 풀 수 있어야 한다
    for (const item of draft.items) {
      if (item.kind !== 'passage') continue;

      const key = passageKey(item);
      const existing = passageByKey.get(key);
      if (existing) {
        // 겹쳐 읽은 같은 지문 — 더 완전한(긴) 쪽을 남긴다
        if (textOf(item.html).length > textOf(existing.html).length) {
          existing.html = item.html;
          existing.open = item.continues;
          existing.lastPage = Math.max(existing.lastPage, item.page);
          if (!existing.label && item.label) existing.label = item.label;
          if (!existing.title && item.title) existing.title = item.title;
          if (!existing.author && item.author) existing.author = item.author;
          if (!existing.box && item.box) existing.box = item.box;
        }
        refToId.set(item.ref, existing.id);
        continue;
      }

      // 앞 쪽에서 이어지는 조각이면 그 지문에 붙인다
      if (item.continued) {
        const open = findOpenPassage(passages, item.page);
        if (open) {
          open.html = `${open.html}\n${item.html}`.trim();
          open.lastPage = item.page;
          open.open = item.continues;
          passageByKey.set(key, open);
          refToId.set(item.ref, open.id);
          continue;
        }
        warn('앞 쪽에서 이어지는 지문을 합치지 못했어요. 검수에서 확인해 주세요.');
      }

      const passage = toPassage(item, newId());
      passages.push(passage);
      passageByKey.set(key, passage);
      refToId.set(item.ref, passage.id);
    }

    // 2) 문항
    for (const item of draft.items) {
      if (item.kind !== 'problem') continue;

      const passageId = item.passage_ref ? refToId.get(item.passage_ref) ?? null : null;
      const key = problemKey(item);
      const existing = problemByKey.get(key);

      if (existing) {
        fillGaps(existing, item);
        // 지문은 나중에야 온전히 보이는 경우가 있다(앞 묶음에서는 잘려 있었다)
        if (!existing.passage_id && passageId) existing.passage_id = passageId;
        continue;
      }

      const problem = toProblem(item, newId(), passageId);
      problems.push(problem);
      problemByKey.set(key, problem);
    }
  }

  // 지문이 끝내 안 닫혔으면 뒷부분이 빠졌을 수 있다 — 조용히 넘기지 않는다
  const unclosed = passages.filter((p) => p.open);
  if (unclosed.length > 0) {
    warn(`뒷부분이 이어지는 지문 ${unclosed.length}개가 있어요. 검수에서 이어 붙여 주세요.`);
  }

  return { passages, problems, warnings: warnings.slice(0, OCR_MAX_WARNINGS) };
}
