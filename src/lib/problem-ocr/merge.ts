import type { PassageWork, QuestionType } from '@/types/problem-bank';
import { OCR_MAX_MERGED_WARNINGS } from './constants';
import type { OcrBox, OcrDraft } from './schema';
import {
  capWarnings, dropStaleWarnings, itemTargetLabel, resolveDraftWarning, warningKey,
  type OcrWarning, type OcrWarningTarget,
} from './warnings';
import { passageKeyIn, problemKeyIn, textOf } from './merge-keys';
import {
  alreadyContains, appendFragment, fillGaps, fillPassageGaps, joinFragments,
  replaceFragment, toPassage, toProblem,
  type FragmentRef, type PassageBuild,
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

/**
 * 작품 목록을 **차례와 상관없이** 견줄 열쇠.
 *
 * 겹쳐 읽은 묶음이 같은 두 편을 `(가)(나)` 와 `(나)(가)` 순으로 낼 수 있는데, 그것은
 * 같은 말이다 — 차례로 견주면 정상적인 겹쳐 읽기가 '다르게 냈다' 로 보인다(코덱스 리뷰 6R).
 * @param titles - 작품명 목록
 * @returns 비교용 문자열
 */
function workSetKey(titles: readonly string[]): string {
  return [...new Set(titles)].sort().join('\u0000');
}

/** 잘라 낼 그림 하나 — 어느 쪽의 어느 자리인가 */
export interface FigureRegion {
  page: number;
  box: OcrBox;
}

/** 저장 직전의 지문 */
export interface PassageDraft {
  id: string;
  label: string;
  /**
   * 이 지문에 실린 작품들.
   *
   * ⚠️ 이 축만 **합집합**으로 합친다(`grammar_paths` 와 같은 사정) — (가)(나) 지문이
   *    쪽을 넘어가면 앞 조각은 (가)만, 뒷 조각은 (나)만 보인다. '비어 있을 때만 채운다' 를
   *    그대로 쓰면 뒤에서 알아본 편이 통째로 버려진다.
   */
  works: PassageWork[];
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
  /**
   * 이 문항이 좁혀 묻는 작품들. **빈 배열이면 '지문 전체'** 이고 DB 트리거가 채운다(sql/33).
   *
   * ⚠️ 지문과 달리 **합집합이 아니다** — 묶음마다 다른 한 편을 냈다면 그것은 합쳐야 할
   *    조각이 아니라 **의견이 갈린 것**이라, 문항의 규칙대로 먼저 온 것이 이긴다.
   */
  work_titles: string[];
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
function findOpenPassage(builds: PassageBuild[], page: number): PassageBuild | undefined {
  let fallback: PassageBuild | undefined;
  for (let i = builds.length - 1; i >= 0; i -= 1) {
    const w = builds[i];
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

  const builds: PassageBuild[] = [];
  const problems: ProblemDraft[] = [];
  // 키 → **조각 자리**. 합쳐 둔 지문이 아니라 조각을 가리켜야
  // 겹쳐 읽은 같은 조각끼리 길이를 견줄 수 있다
  const fragmentByKey = new Map<string, FragmentRef>();
  const problemByKey = new Map<string, ProblemDraft>();
  /**
   * 문항 id → 모델이 낸 작품 후보들(묶음 순서).
   *
   * ⚠️ 문항의 작품은 **먼저 온 것이 이기는데**, 그 값이 딸린 지문에 없는 이름일 수 있다
   *    (앞 묶음에서 참조를 못 풀어 지문 없이 읽힌 경우가 그렇다). 그때 그냥 걸러 내면
   *    빈 목록이 되어 '지문 전체' 로 **넓어지고**, 뒤 묶음이 제대로 낸 좁힘이 버려진다.
   *    후보를 들고 있다가 지문이 확정된 뒤 **맞는 것을 고른다**(코덱스 리뷰 2R)
   */
  const workCandidates = new Map<string, string[][]>();

  /**
   * 경고를 담는다 — 같은 말이라도 **대상이 다르면 다른 경고**다(문항마다 알려야 한다).
   */
  /** 이 묶음이 이 문항에 대해 낸 작품 목록을 후보로 담아 둔다 */
  const rememberWorks = (id: string, item: { works: { title: string }[] }) => {
    if (item.works.length === 0) return;
    const titles = item.works.map((w) => w.title);
    const seen = workCandidates.get(id) ?? [];
    // ⚠️ **차례는 뜻이 아니다** — `[가, 나]` 와 `[나, 가]` 는 같은 말이다(코덱스 리뷰 5R)
    if (seen.some((c) => workSetKey(c) === workSetKey(titles))) return;
    workCandidates.set(id, [...seen, titles]);
  };

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
        // ⚠️ **가리키기만 하는 자리**는 갈아 끼우지 않는다. 그 키가 가리키는 것은
        //    이 조각이 아니라 통째로 담은 큰 조각이라, 더 긴 이어짐으로 바꾸면
        //    지문 앞부분과 그림이 통째로 날아간다
        if (existing.alias) {
          fillPassageGaps(existing.work.draft, item);
          // ⚠️ 갈아 끼우지는 않되 **새로 읽어 낸 것은 버리지 않는다.** 이번 판이 글을
          //    더 읽었거나 그림을 알아봤을 수 있는데, 그냥 넘기면 그것이 사라진다
          if (alreadyContains(existing.work, item) !== 'duplicate') {
            appendFragment(existing.work, item);
            warn({
              message: '이어지는 글의 앞부분이 겹쳐 보일 수 있어요. 검수에서 확인해 주세요.',
              targets: [{
                kind: 'passage',
                id: existing.work.draft.id,
                page: existing.work.draft.page_no,
                label: itemTargetLabel({
                  kind: 'passage', page: existing.work.draft.page_no,
                }),
              }],
            });
          }
          refToId.set(item.ref, existing.work.draft.id);
          continue;
        }
        // 겹쳐 읽은 **같은 조각** — 더 완전한(긴) 쪽을 남긴다.
        // 비교 대상이 합본이 아니라 조각이라 앞부분을 잃지 않는다
        const current = existing.work.fragments[existing.index] ?? '';
        const grew = textOf(item.html).length - textOf(current).length;
        // ⚠️ 그림은 **글 길이와 따로** 본다. `textOf` 가 자리표시자를 지우므로, 같은 글을
        //    옮겼는데 이번에만 도표를 알아본 경우 길이가 똑같아 갈아 끼우지 못했다 —
        //    그러면 그 그림이 잘리지도 저장되지도 않는다(코덱스 리뷰)
        const mine = existing.work.figures[existing.index] ?? [];
        const moreFigures = item.figures.length > mine.length;
        if (grew > 0 || (grew === 0 && moreFigures)) {
          // ⚠️ 글만 고르고 그림을 남길 수는 없다 — 자리표시자 번호가 **그 판의 그림 목록**
          //    기준이라 짝이 어긋나면 1번 자리에 딴 그림이 그려진다. 그래서 함께 간다.
          //    버리는 판이 그림을 더 알아봤다면 조용히 넘기지 않고 알린다
          if (item.figures.length < mine.length) {
            warn({
              message: '같은 지문을 두 번 읽었는데 글이 더 온전한 쪽이 그림을 덜 알아봤어요. '
                + '빠진 그림이 없는지 확인하고, 필요하면 원본에서 끌어 넣어 주세요.',
              targets: [{
                kind: 'passage',
                id: existing.work.draft.id,
                page: existing.work.draft.page_no,
                label: itemTargetLabel({ kind: 'passage', page: existing.work.draft.page_no }),
              }],
            });
          }
          replaceFragment(existing.work, existing.index, item);
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
        const open = findOpenPassage(builds, item.page);
        if (open) {
          // 앞 묶음이 이 지문을 통째로 읽어 뒷부분까지 이미 담았을 수 있다.
          // 그때 또 붙이면 같은 글이 두 번 인쇄된다 — 참조만 잇고 넘어간다
          const verdict = alreadyContains(open, item);
          if (verdict === 'duplicate') {
            fillPassageGaps(open.draft, item);
            // ⚠️ 글을 안 붙여도 **이 지문이 그 쪽까지 걸쳐 있다는 사실은 같다.**
            //    안 옮기면 pageSpan 이 1로 남아 `save.ts` 가 이미지 출제를 고르고,
            //    시작 쪽 이미지 하나만 인쇄돼 뒷부분이 사라진다
            open.draft.open = item.continues;
            // ⚠️ **이 조각 키를 등록한다.** 안 하면 겹쳐 읽은 다음 묶음이 같은 이어짐을
            //    또 냈을 때 표에서 못 찾고, 그 사이 lastPage 가 그 쪽까지 와 있어
            //    `findOpenPassage` 도 이 지문을 거른다 — 주인 없는 지문이 하나 더 생기고
            //    처음 보는 문항이 거기에 붙는다. 마지막 조각을 가리켜 두면 다음번엔
            //    중복 판정 길로 들어온다. **가리키기만 하는 자리**로 표시해 두어야
            //    나중에 더 긴 이어짐이 와도 큰 조각을 갈아 끼우지 않는다
            fragmentByKey.set(key, {
              work: open, index: open.fragments.length - 1, alias: true,
            });
            refToId.set(item.ref, open.draft.id);
            continue;
          }
          // ⚠️ 앞부분만 겹치면 **붙인다.** 앞 묶음이 다음 쪽 첫 문단까지만 읽어 둔 경우가
          //    흔한데, 겹친다고 버리면 되찾은 뒷부분이 사라진다. 겹쳐 보이는 편이
          //    사라지는 것보다 낫고(눈에 띈다), 검수에서 지울 수 있다
          if (verdict === 'partial') {
            warn({
              message: '이어지는 글의 앞부분이 겹쳐 보일 수 있어요. 검수에서 확인해 주세요.',
              targets: [{
                kind: 'passage',
                id: open.draft.id,
                page: open.draft.page_no,
                label: itemTargetLabel({ kind: 'passage', page: open.draft.page_no }),
              }],
            });
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

      const build = toPassage(item, newId());
      builds.push(build);
      fragmentByKey.set(key, { work: build, index: 0 });
      refToId.set(item.ref, build.draft.id);
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
        rememberWorks(existing.id, item);
        refToId.set(item.ref, existing.id);
        continue;
      }

      const problem = toProblem(item, newId(), passageId);
      problems.push(problem);
      problemByKey.set(key, problem);
      rememberWorks(problem.id, item);
      refToId.set(item.ref, problem.id);
    }

    // 이제 ref 가 전부 풀리므로 이 묶음의 경고에 행 id 를 붙인다
    for (const warning of draft.warnings) warn(resolveDraftWarning(warning, refToId));
  }

  // 조각을 이제 합친다 — 조각별 비교가 다 끝난 뒤여야 한다.
  // 그림 번호 밀기도 여기서 **한 번만** 한다(joinFragments)
  const passages = builds.map((w) => {
    const { droppedFigures, ...joined } = joinFragments(w);
    // ⚠️ 상한에 걸려 버린 그림은 **반드시 알린다.** 크롭은 남은 것만 보므로 여기서
    //    말하지 않으면 그 그림이 어디에도 안 나오고 아무 표시도 없다
    if (droppedFigures > 0) {
      warn({
        message: `그림이 너무 많아 ${droppedFigures}개를 담지 못했어요. `
          + '검수에서 필요한 그림을 직접 잘라 넣어 주세요.',
        targets: [{
          kind: 'passage',
          id: w.draft.id,
          page: w.draft.page_no,
          label: itemTargetLabel({ kind: 'passage', page: w.draft.page_no }),
        }],
      });
    }
    return { ...w.draft, ...joined };
  });

  // ⚠️ 문항의 작품은 **지문에 실린 작품 가운데 하나**여야 한다. 모델이 지문에 없는 이름을
  //    문항에 적으면(본문을 보고 지어낸 경우다) 작품 트리에 그 지문과 무관한 잎이 하나 생기고,
  //    DB 전파 트리거는 그것을 '사람이 좁혀 적은 값' 으로 보아 **영영 보존한다**.
  // ⚠️ **파서가 아니라 여기서** 한다(코덱스 리뷰). 묶음 하나의 지문 조각에는 실린 작품이 다
  //    안 보일 수 있어서(쪽을 넘어가는 (가)(나) 지문), 그때 대조하면 문항이 좁혀 적은 편이
  //    버려져 **지문 전체를 묻는 문항으로 넓어진다** — 합집합이 확정된 뒤여야 한다.
  //    지문이 작품을 모르면 대조할 근거가 없어 건너뛴다
  const worksByPassage = new Map(passages.map((p) => [p.id, p.works.map((w) => w.title)]));
  for (const problem of problems) {
    if (!problem.passage_id || problem.work_titles.length === 0) continue;
    const allowed = worksByPassage.get(problem.passage_id) ?? [];
    if (allowed.length === 0) continue;

    const at: OcrWarningTarget = {
      kind: 'problem',
      id: problem.id,
      page: problem.page_no,
      label: itemTargetLabel({ kind: 'problem', page: problem.page_no, number: problem.number }),
    };
    /** 다른 묶음이 낸, **지문에 다 있는** 목록들 */
    const usable = (workCandidates.get(problem.id) ?? [])
      .filter((c) => c.length > 0 && c.every((t) => allowed.includes(t)));

    const dropped = problem.work_titles.filter((t) => !allowed.includes(t));
    let told = false;
    if (dropped.length > 0) {
      // ⚠️ **살아남은 편이 하나라도 있으면 그것이 답이다**(코덱스 리뷰 4R). 다른 묶음의
      //    온전한 후보를 먼저 보면, `[A, 엉뚱]` 이 `[A, B]` 로 **넓어져** 두 작품을 묻는
      //    문항이 된다 — 좁힘은 사람이 되돌리기 어려운 쪽으로 틀리면 안 된다
      const kept = problem.work_titles.filter((t) => allowed.includes(t));
      // 하나도 안 남았을 때만 다른 묶음의 목록을 쓴다. 그냥 비우면 '지문 전체' 가 되어
      // 맞는 좁힘을 두고도 엉뚱하게 넓은 문항이 된다.
      // ⚠️ 고를 때는 **넓은 쪽**이다(코덱스 리뷰 6R): 너무 좁으면 그 작품으로 훑을 때 문항이
      //    아예 안 나와 없는 줄 알지만, 너무 넓으면 눈으로 보고 뺄 수 있다.
      //    `sort` 는 안정 정렬이라 같은 길이면 묶음 차례를 지킨다
      const widest = [...usable].sort((a, b) => b.length - a.length)[0];
      problem.work_titles = (kept.length > 0 ? kept : widest) ?? [];
      warn({
        // 값이 말없이 달라지는 자리라 상한에 밀리면 안 된다(옛한글 경고에만 자리를 내준다)
        keep: 'merge',
        message: `문항에 적힌 작품 '${dropped.join("', '")}' 이 딸린 지문에 없어 뺐어요. `
          + '검수에서 확인해 주세요.',
        targets: [at],
      });
      told = true;
    }

    // ⚠️ **묶음마다 다르게 냈으면** 먼저 온 것을 쓰되 그 사실을 알린다(코덱스 리뷰 5R).
    //    조용히 첫 값을 굳히면, 첫 묶음이 잘못 좁혔을 때 원본과 맞춰 볼 실마리가 어디에도
    //    남지 않는다 — 문항이 묻는 작품은 눈으로 한 번 보면 알 수 있다.
    //    이미 '뺐어요' 로 짚었으면 더 말하지 않는다(그 카드는 이미 보러 간다)
    if (told || problem.work_titles.length === 0) continue;
    const mineKey = workSetKey(problem.work_titles);
    const other = usable.find((c) => workSetKey(c) !== mineKey);
    if (!other) continue;
    warn({
      keep: 'merge',
      message: '겹쳐 읽은 묶음이 묻는 작품을 다르게 냈어요'
        + `(${problem.work_titles.join(' · ')} / ${other.join(' · ')}). 원본과 맞춰 주세요.`,
      targets: [at],
    });
  }

  // 지문이 끝내 안 닫혔으면 뒷부분이 빠졌을 수 있다 — 조용히 넘기지 않는다.
  // 개수만 세지 말고 **어느 지문인지** 짚는다(개수만으로는 찾을 방법이 없다)
  // ⚠️ **'이어 붙여 주세요' 가 아니라 '확인해 주세요' 다**(2026-09-15). `findOpenPassage` 가
  //    닫힌 지문에도 붙이게 된 뒤로 병합은 거의 자동으로 끝나고, 여기 남는 `open` 은 대개
  //    마지막 조각의 `continues` 표시다 — 온전한 글에 손으로 이어 붙이라고 하면 할 일 없는
  //    지시가 되어 선생님이 경고 전체를 안 믿게 된다
  const unclosed = passages.filter((p) => p.open);
  if (unclosed.length > 0) {
    const targets: OcrWarningTarget[] = unclosed.map((p) => ({
      kind: 'passage',
      id: p.id,
      page: p.page_no,
      label: itemTargetLabel({ kind: 'passage', page: p.page_no }),
    }));
    warn({
      message: `뒷부분이 이어질 수 있는 지문 ${unclosed.length}개가 있어요. 검수에서 본문이 끝까지 있는지만 확인해 주세요.`,
      targets,
    });
  }

  // ⚠️ **걷어내기가 상한보다 먼저**다 — 틀린 말을 남기고 맞는 말을 자르면 안 된다
  return {
    passages,
    problems,
    warnings: capWarnings(
      dropStaleWarnings(warnings, problems, passages),
      OCR_MAX_MERGED_WARNINGS,
    ),
  };
}
