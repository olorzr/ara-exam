import type { QuestionType } from '@/types/problem-bank';
import { OCR_MAX_MERGED_WARNINGS } from './constants';
import type { OcrBox, OcrDraft } from './schema';
import {
  capWarnings, itemTargetLabel, resolveDraftWarning, warningKey,
  type OcrWarning, type OcrWarningTarget,
} from './warnings';
import { passageKeyIn, problemKeyIn, textOf } from './merge-keys';
import {
  alreadyContains, appendFragment, fillGaps, fillPassageGaps, toPassage, toProblem,
  type FragmentRef, type PassageWork,
} from './merge-fill';

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
 *    같지만, 정답은 정답표가 실린 쪽을 본 묶음에만 있을 수 있다.
 *
 * ⚠️ 정답(answer)과 유형(question_type)은 **한 덩어리로** 옮긴다.
 *    유형이 바뀌면 정답의 의미가 달라지기 때문이다('1' 은 객관식에서만 선지 번호다).
 */

/** 잘라 낼 그림 하나 — 어느 쪽의 어느 자리인가 */
export interface FigureRegion {
  page: number;
  box: OcrBox;
}

/** 저장 직전의 지문 */
export interface PassageDraft {
  id: string;
  label: string;
  title: string;
  author: string;
  /**
   * 이어 붙인 본문.
   *
   * ⚠️ 병합 중에는 **조각(fragments)을 따로 들고 있다가** 마지막에 합친다.
   *    합쳐 둔 글에 대고 "더 긴 쪽이 이긴다"를 적용하면, 겹쳐 읽은 **조각 하나**가
   *    합본 전체와 길이를 겨루게 되어 개선된 조각을 버리거나(짧으니까)
   *    합본을 조각으로 갈아치워 앞부분을 잃는다.
   */
  html: string;
  /** 지문이 시작한 쪽 */
  page_no: number;
  box: OcrBox | null;
  area_path: string[];
  /** 교과서 단원 이름 경로 [대단원, 소단원] */
  unit_path: string[];
  has_figure: boolean;
  /**
   * 글로 못 옮긴 그림들 — **자기 쪽 번호와 함께** 든다.
   * 쪽을 넘어가는 지문의 그림은 시작 쪽이 아니라 그 그림이 실린 쪽에서 잘라야 한다.
   */
  figures: FigureRegion[];
  /** 이어 붙인 마지막 쪽 (크롭 범위 안내용) */
  lastPage: number;
  /** 아직 다음 쪽으로 이어지는 중인가 */
  open: boolean;
  /** 이 지문이 몇 쪽에 걸쳐 있는가 — 잘라 둔 이미지가 전체를 담았는지 판단한다 */
  pageSpan: number;
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
  /**
   * 배점.
   * ⚠️ OCR 은 **읽지 않는다**(2026-09-08) — 늘 null 이다. DB 컬럼과 옛 값을 지키려고
   *    타입에만 남겨 둔 자리다.
   */
  score: number | null;
  work_title: string;
  area_path: string[];
  /** 교과서 단원 이름 경로 [대단원, 소단원] */
  unit_path: string[];
  /** 문법 분류 경로 문자열 목록 (여러 개) */
  grammar_paths: string[];
  page_no: number;
  box: OcrBox | null;
  has_figure: boolean;
  figures: FigureRegion[];
}

export interface MergeResult {
  passages: PassageDraft[];
  problems: ProblemDraft[];
  /**
   * 최종 경고. 파서가 `ref` 로만 가리키던 항목이 여기서 **진짜 행 id** 를 얻는다 —
   * 그래야 검수 화면이 "이 경고는 저 카드 얘기" 라고 짚어 줄 수 있다.
   */
  warnings: OcrWarning[];
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
  leadingWarnings?: OcrWarning[];
}

/**
 * 앞 쪽에서 이어지는 조각을 붙일 지문을 찾는다.
 *
 * **바로 앞 쪽에서 끝난 것만** 후보다 — 멀리 있는 지문에 잘못 붙이면 두 글이 뒤섞인다.
 *
 * 두 단계로 찾는다:
 *  ① 아직 열려 있는(`continues`) 지문 — 모델이 양쪽 표시를 다 낸 정상 경우.
 *  ② 없으면 **닫혀 있어도** 바로 앞 쪽에서 끝난 마지막 지문. 모델이 쪽 끝에서
 *     `continues` 를 빠뜨리는 일이 잦은데, ①만 보면 그때마다 뒷부분이 **주인 없는
 *     지문 하나로 떨어져 나가** 문항이 어느 쪽에도 온전히 붙지 않는다.
 *     붙이기 전에 `alreadyContains` 로 중복을 거른다.
 */
function findOpenPassage(works: PassageWork[], page: number): PassageWork | undefined {
  let fallback: PassageWork | undefined;
  for (let i = works.length - 1; i >= 0; i -= 1) {
    const w = works[i];
    if (w.draft.lastPage !== page - 1) continue;
    if (w.draft.open) return w;
    if (!fallback) fallback = w;
  }
  return fallback;
}

/**
 * 묶음별 초안을 하나로 합친다.
 * @param drafts - 묶음 순서대로의 초안과 그 묶음이 읽은 쪽
 * @param opts - id 생성기·선행 경고
 * @returns 합쳐진 지문·문항과 경고
 */
export function mergeOcrDrafts(drafts: DraftWithPages[], opts: MergeOptions = {}): MergeResult {
  const newId = opts.newId ?? (() => crypto.randomUUID());
  const warnings: OcrWarning[] = [...(opts.leadingWarnings ?? [])];
  const seenWarnings = new Set(warnings.map(warningKey));

  const works: PassageWork[] = [];
  const problems: ProblemDraft[] = [];
  // 키 → **조각 자리**. 합쳐 둔 지문이 아니라 조각을 가리켜야
  // 겹쳐 읽은 같은 조각끼리 길이를 견줄 수 있다
  const fragmentByKey = new Map<string, FragmentRef>();
  const problemByKey = new Map<string, ProblemDraft>();

  /**
   * 경고를 담는다 — 같은 말이라도 **대상이 다르면 다른 경고**다(문항마다 알려야 한다).
   */
  const warn = (warning: OcrWarning) => {
    const key = warningKey(warning);
    if (seenWarnings.has(key)) return;
    seenWarnings.add(key);
    warnings.push(warning);
  };

  for (const { draft } of drafts) {
    // 이 묶음의 ref → 합쳐진 행 id. ref 는 묶음 안에서만 유효하다.
    // ⚠️ 지문·문항을 다 훑은 **뒤에** 이 표로 경고를 푼다 — 먼저 풀면 표가 비어 있어
    //    모든 경고가 행을 못 찾고 쪽 대상으로 떨어진다
    const refToId = new Map<string, string>();

    // 1) 지문 먼저 — 문항이 참조를 풀 수 있어야 한다
    const seenPassages = new Map<string, number>();
    for (const item of draft.items) {
      if (item.kind !== 'passage') continue;

      const key = passageKeyIn(item, seenPassages);
      const existing = fragmentByKey.get(key);
      if (existing) {
        // 겹쳐 읽은 **같은 조각** — 더 완전한(긴) 쪽을 남긴다.
        // 비교 대상이 합본이 아니라 조각이라 앞부분을 잃지 않는다
        const current = existing.work.fragments[existing.index] ?? '';
        if (textOf(item.html).length > textOf(current).length) {
          existing.work.fragments[existing.index] = item.html;
          // 이 조각이 마지막이었다면 '아직 이어지는가'도 새 값으로 바꾼다
          if (existing.index === existing.work.fragments.length - 1) {
            existing.work.draft.open = item.continues;
          }
        }
        // ⚠️ 빈 칸 채우기는 **글 길이와 상관없이** 한다. 같은 글을 두 번 읽었는데
        //    두 번째에만 작품·영역·단원을 알아본 경우가 흔한데, 길이 비교 안에 두면
        //    그 분류가 통째로 버려진다(코덱스 리뷰).
        fillPassageGaps(existing.work.draft, item);
        refToId.set(item.ref, existing.work.draft.id);
        continue;
      }

      // 앞 쪽에서 이어지는 조각이면 그 지문에 붙인다
      if (item.continued) {
        const open = findOpenPassage(works, item.page);
        if (open) {
          // 앞 묶음이 이 지문을 통째로 읽어 뒷부분까지 이미 담았을 수 있다.
          // 그때 또 붙이면 같은 글이 두 번 인쇄된다 — 참조만 잇고 넘어간다
          if (alreadyContains(open, item.html)) {
            fillPassageGaps(open.draft, item);
            refToId.set(item.ref, open.draft.id);
            continue;
          }
          appendFragment(open, item);
          // 이어지는 조각에서만 작품명·영역·단원을 알아볼 때가 있다(앞 쪽은 머리글이 없다)
          fillPassageGaps(open.draft, item);
          fragmentByKey.set(key, { work: open, index: open.fragments.length - 1 });
          refToId.set(item.ref, open.draft.id);
          continue;
        }
        warn({
          message: '앞 쪽에서 이어지는 지문을 합치지 못했어요. 검수에서 확인해 주세요.',
          // 새로 만드는 지문이라 아래에서 id 가 생긴다 — 쪽만 가리켜도 찾아갈 수 있다
          targets: [{ kind: 'passage', page: item.page, label: `${item.page}쪽 지문` }],
        });
      }

      const work = toPassage(item, newId());
      works.push(work);
      fragmentByKey.set(key, { work, index: 0 });
      refToId.set(item.ref, work.draft.id);
    }

    // 2) 문항
    // 이 묶음에서 같은 기본 키가 몇 번째로 나왔는지 — 한 쪽에서 번호가 반복되는
    // 자료(문제집·프린트)의 서로 다른 문항을 갈라 준다
    const seenInBatch = new Map<string, number>();
    for (const item of draft.items) {
      if (item.kind !== 'problem') continue;

      const passageId = item.passage_ref ? refToId.get(item.passage_ref) ?? null : null;
      const key = problemKeyIn(item, seenInBatch);
      const existing = problemByKey.get(key);

      if (existing) {
        fillGaps(existing, item);
        // 지문은 나중에야 온전히 보이는 경우가 있다(앞 묶음에서는 잘려 있었다)
        if (!existing.passage_id && passageId) existing.passage_id = passageId;
        refToId.set(item.ref, existing.id);
        continue;
      }

      const problem = toProblem(item, newId(), passageId);
      problems.push(problem);
      problemByKey.set(key, problem);
      refToId.set(item.ref, problem.id);
    }

    // 이제 ref 가 전부 풀리므로 이 묶음의 경고에 행 id 를 붙인다
    for (const warning of draft.warnings) warn(resolveDraftWarning(warning, refToId));
  }

  // 조각을 이제 합친다 — 조각별 비교가 다 끝난 뒤여야 한다
  const passages = works.map((w) => ({
    ...w.draft,
    html: w.fragments.map((f) => f.trim()).filter(Boolean).join('\n'),
  }));

  // 지문이 끝내 안 닫혔으면 뒷부분이 빠졌을 수 있다 — 조용히 넘기지 않는다.
  // 개수만 세지 말고 **어느 지문인지** 짚는다(개수만으로는 찾을 방법이 없다)
  const unclosed = passages.filter((p) => p.open);
  if (unclosed.length > 0) {
    const targets: OcrWarningTarget[] = unclosed.map((p) => ({
      kind: 'passage',
      id: p.id,
      page: p.page_no,
      label: itemTargetLabel({ kind: 'passage', page: p.page_no }),
    }));
    warn({
      message: `뒷부분이 이어지는 지문 ${unclosed.length}개가 있어요. 검수에서 이어 붙여 주세요.`,
      targets,
    });
  }

  return { passages, problems, warnings: capWarnings(warnings, OCR_MAX_MERGED_WARNINGS) };
}
