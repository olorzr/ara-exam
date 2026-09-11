import { normalizeGrammarPaths } from '@/lib/problem-bank/grammar-tree';
import {
  figureNumbersIn, MAX_FIGURES, reconcileFigurePlaceholders, shiftFigurePlaceholders,
} from '@/lib/problem-bank/figure-placeholders';
import { textOf } from './merge-keys';
import type { OcrBox, OcrItem } from './schema';
import type { FigureRegion, PassageDraft, ProblemDraft } from './merge';

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
  /**
   * 조각마다의 그림 — `fragments` 와 자리·길이가 같다.
   *
   * ⚠️ **조각의 html 은 모델이 낸 그대로**(번호가 그 조각 안에서 1번부터)이고, 번호 밀기는
   *    합칠 때 한 번만 한다. 밀어 둔 글을 들고 있으면 겹쳐 읽은 더 온전한 판으로 갈아 끼울
   *    때마다 밀기를 되걸어야 하고, 그때 그림 목록까지 함께 갈지 않으면 **새로 알아본 그림이
   *    조용히 사라진다.** 조각이 자기 그림을 들고 있으면 그 어긋남이 생기지 않는다.
   */
  figures: FigureRegion[][];
}

/** 중복 판정 키가 가리키는 자리 — 어느 지문의 몇 번째 조각인가 */
export interface FragmentRef {
  work: PassageWork;
  index: number;
}

/**
 * 이어지는 조각의 **앞부분**이 이미 있는지 볼 때 견줄 글자 수.
 *
 * 짧게 잡는다 — 앞 묶음이 다음 쪽의 **첫 문단까지만** 읽어 둔 경우를 알아채야 하는데,
 * 첫 문단이 스무 글자쯤인 시는 흔하다.
 */
const HEAD_PROBE = 20;

/**
 * **끝부분**이 이미 있는지 볼 때 견줄 글자 수.
 *
 * 넉넉히 잡는다 — 여기서 맞으면 조각을 통째로 버리므로 확신이 있어야 한다.
 */
const TAIL_PROBE = 40;

/** 같은 자리를 가리키는 좌표인가 — 모델이 낸 값이라 딱 떨어지지 않는다 */
function sameBox(a: OcrBox, b: OcrBox): boolean {
  return a.column === b.column
    && Math.abs(a.top - b.top) < BOX_TOLERANCE
    && Math.abs(a.bottom - b.bottom) < BOX_TOLERANCE;
}

/** 같은 그림으로 볼 좌표 차이 (쪽 높이 비율). 모델이 낼 때마다 조금씩 달라진다 */
const BOX_TOLERANCE = 0.03;

/** 이어지는 조각이 이미 담겨 있는가에 대한 판정 */
export type ContainmentVerdict =
  /** 통째로 이미 있다 — 또 붙이면 같은 글이 두 번 인쇄된다 */
  | 'duplicate'
  /** 처음 보는 글이다 */
  | 'new'
  /** **앞부분만** 이미 있다 — 뒷부분은 새 글이다 */
  | 'partial';

/**
 * 이 지문이 **이미** 이 조각을 담고 있는가.
 *
 * ⚠️ 이 검사가 없으면 같은 뒷부분이 두 번 붙는다. 앞 묶음이 쪽 경계를 넘는 지문을
 *    통째로 한 항목으로 읽어 두면(흔하다), 겹쳐 읽은 다음 묶음이 그 뒷부분만 다시
 *    '이어지는 조각' 으로 내놓는데 그것을 그대로 이어 붙이면 본문이 겹쳐 인쇄된다.
 *
 * ⚠️ 앞부분만 견주면 안 된다. 앞 묶음이 다음 쪽의 **첫 문단까지만** 읽어 둔 경우가
 *    흔한데, 앞 40자가 맞는다고 조각을 통째로 버리면 **되찾은 뒷부분이 사라진다.**
 *    끝부분까지 맞을 때만 '통째로 있다' 로 본다(코덱스 리뷰).
 *
 * ⚠️ 글이 없는 조각(**그림만 있는 이어짐**)은 견줄 것이 없어 무조건 '이미 있다' 로
 *    떨어졌다. 그러면 그 그림이 잘리지도 저장되지도 않는다 — 쪽 머리에 도표만 이어지는
 *    지문이 실제로 그렇다. 그림이 있으면 새 조각으로 본다.
 * @param work - 붙일 대상 지문
 * @param item - 붙이려는 조각
 * @returns 판정
 */
export function alreadyContains(work: PassageWork, item: OcrItem): ContainmentVerdict {
  const text = textOf(item.html);
  if (!text) return item.figures.length === 0 ? 'duplicate' : 'new';

  const soFar = textOf(work.fragments.join(' '));
  if (!soFar.includes(text.slice(0, HEAD_PROBE))) return 'new';
  // 끝부분까지 있어야 통째로 있는 것이다. 그림이 늘었어도 아직 담을 것이 남았다.
  // ⚠️ 그림은 **개수가 아니라 자리로** 견준다. 앞 묶음이 시작 쪽 그림 하나를 잡아 뒀는데
  //    이번 조각이 **다음 쪽의 다른 그림** 하나를 알아본 경우, 개수만 보면 '이미 있다' 가
  //    되어 그 새 그림이 잘리지도 저장되지도 않는다(코덱스 리뷰)
  const mine = work.figures.flat();
  const newFigure = item.figures.some(
    (box) => !mine.some((had) => had.page === item.page && sameBox(had.box, box)),
  );
  const whole = soFar.includes(text.slice(-TAIL_PROBE)) && !newFigure;
  return whole ? 'duplicate' : 'partial';
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
      figures: item.figures.map((box) => ({ page: item.page, box })),
      lastPage: item.page,
      open: item.continues,
      pageSpan: 1,
    },
    fragments: [item.html],
    figures: [item.figures.map((box) => ({ page: item.page, box }))],
  };
}

/**
 * 조각들을 합치며 그림 번호를 민다 — **여기서 한 번만** 민다.
 * @param work - 합칠 지문
 * @returns 이어 붙인 본문과 조각 순서대로의 그림
 */
export function joinFragments(work: PassageWork): { html: string; figures: FigureRegion[] } {
  const figures: FigureRegion[] = [];
  const parts: string[] = [];

  for (const [i, fragment] of work.fragments.entries()) {
    const mine = work.figures[i] ?? [];
    // 상한을 넘는 그림은 붙이지 않는다 — 자리표시자도 아래 reconcile 이 지운다
    const room = Math.max(MAX_FIGURES - figures.length, 0);
    const kept = mine.slice(0, room);
    const shifted = shiftFigurePlaceholders(fragment, figures.length);
    figures.push(...kept);
    const trimmed = shifted.trim();
    if (trimmed) parts.push(trimmed);
  }

  return {
    // 조각을 갈아 끼우는 사이 남거나 모자란 번호가 생길 수 있다 — 마지막에 한 번 맞춘다
    html: reconcileFigurePlaceholders(parts.join('\n'), figures.length),
    figures,
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
    figures: item.figures.map((box) => ({ page: item.page, box })),
  };
}

/**
 * 이어지는 조각을 지문에 붙인다 — **그림 번호를 함께 민다.**
 *
 * ⚠️ 번호를 안 밀면 뒤 조각의 '1번 그림' 이 앞 조각의 그림을 가리킨다. 쪽을 넘어가는
 *    그림 지문이 여기서 풀린다 — 그림은 **자기 쪽에서** 잘리고, 자리표시자만 이어진다.
 * @param work - 붙일 대상 지문
 * @param item - 이어지는 조각
 */
export function appendFragment(work: PassageWork, item: OcrItem): void {
  // ⚠️ 번호를 **여기서 밀지 않는다.** 조각은 모델이 낸 그대로 들고 있다가 합칠 때 한 번만
  //    민다(joinFragments) — 그래야 갈아 끼우기와 밀기가 서로 어긋나지 않는다
  work.fragments.push(item.html);
  work.figures.push(item.figures.map((box) => ({ page: item.page, box })));
  work.draft.open = item.continues;
}

/**
 * 겹쳐 읽어 **더 온전한 판**이 왔을 때 그 조각을 갈아 끼운다.
 *
 * ⚠️ 글과 그림을 **늘 함께** 간다. 자리표시자 번호는 **그 판의 그림 목록** 기준이라,
 *    한쪽만 갈면 1번 자리에 딴 그림이 그려진다 — 없는 것보다 나쁘다(없는 것은 눈에
 *    띄지만 딴 그림은 안 띈다). 버리는 판이 그림을 더 알아봤다면 호출부가 알린다.
 * @param work - 대상 지문
 * @param index - 갈아 끼울 조각 자리
 * @param item - 더 온전한 판
 */
export function replaceFragment(work: PassageWork, index: number, item: OcrItem): void {
  work.fragments[index] = item.html;
  work.figures[index] = item.figures.map((box) => ({ page: item.page, box }));
  // 이 조각이 마지막이었다면 '아직 이어지는가' 도 새 값으로 바꾼다
  if (index === work.fragments.length - 1) work.draft.open = item.continues;
}

/**
 * 이미 담은 지문의 빈 칸만 채운다.
 *
 * 겹쳐 읽은 조각과 이어지는 조각 **양쪽에서** 부른다 — 어느 쪽이든 나중 묶음에서만
 * 작품명·영역·단원을 알아볼 수 있고, 그때 채우지 않으면 분류가 사라진다.
 */
export function fillPassageGaps(draft: PassageDraft, item: OcrItem): void {
  draft.lastPage = Math.max(draft.lastPage, item.page);
  // ⚠️ 몇 쪽에 걸쳐 있는지는 **세지 말고 계산한다.** 겹쳐 읽은 묶음이 같은 이어짐을 두 번
  //    내면 세기는 부풀고, 글이 이미 있어 안 붙인 경우(중복)에는 아예 안 는다.
  //    그 값으로 `save.ts` 가 '이미지로 출제' 를 정하므로, 1로 남으면 여러 쪽 지문이
  //    **시작 쪽 이미지 하나로** 인쇄돼 뒷부분이 통째로 사라진다
  draft.pageSpan = Math.max(1, draft.lastPage - draft.page_no + 1);
  if (!draft.label && item.label) draft.label = item.label;
  if (!draft.title && item.title) draft.title = item.title;
  if (!draft.author && item.author) draft.author = item.author;
  // ⚠️ 좌표는 **같은 쪽에서 읽은 것만** 받는다. box 와 page_no 는 짝이라(크롭이 둘을 함께
  //    쓴다) 이어지는 쪽의 좌표를 첫 쪽에 붙이면 엉뚱한 자리를 잘라 낸다(코덱스 리뷰 2R)
  if (!draft.box && item.box && item.page === draft.page_no) draft.box = item.box;
  if (draft.area_path.length === 0 && item.area_path.length > 0) draft.area_path = item.area_path;
  if (draft.unit_path.length === 0 && item.unit_path.length > 0) draft.unit_path = item.unit_path;
  if (item.has_figure) draft.has_figure = true;
  // ⚠️ 그림은 여기서 채우지 않는다 — **조각마다 따로** 들고 있다가 합칠 때 모은다
  //    (replaceFragment / appendFragment). 지문 전체에 대고 채우면 어느 조각의 그림인지
  //    알 수 없어 번호가 어긋난다
}

/** 이미 담은 문항의 빈 칸만 채운다 */
export function fillGaps(target: ProblemDraft, item: OcrItem): void {
  if (!textOf(target.stem_html) && item.stem_html) {
    // ⚠️ 발문과 그림을 **함께** 간다. 자리표시자 번호는 그 판의 그림 목록 기준이라,
    //    발문만 갈면 1번 자리에 딴 그림이 그려진다(지문 쪽 replaceFragment 와 같은 규약)
    target.stem_html = item.stem_html;
    target.figures = item.figures.map((box) => ({ page: item.page, box }));
  }
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
  // ⚠️ 그림만 따로 채우는 것은 **발문이 비어 있지 않을 때**뿐이고, 그때도 지금 발문에
  //    자리표시자가 없으면 채워 봐야 그릴 자리가 없다 — 그래서 자리표시자가 있을 때만
  //    받는다. 좌표와 쪽은 짝이라 같은 쪽에서 읽은 것만 받는다
  if (
    target.figures.length === 0
    && item.figures.length > 0
    && item.page === target.page_no
    && figureNumbersIn(target.stem_html).length > 0
  ) {
    target.figures = item.figures.map((box) => ({ page: item.page, box }));
  }
}
