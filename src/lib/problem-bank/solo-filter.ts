import type { ProblemFilters } from './filters';

/**
 * '그 작품만 · 그 문법만' 필터 (순수 함수).
 *
 * 원장님 요청(2026-10-11): "해당 문학 작품 혹은 해당 문법만 있는(다른 지문은 겹치지 않은) 문제만
 * 뽑아 쓸 수 있도록". 칸은 하나(`ProblemFilters.solo`)지만 **축마다 뜻이 다르다**(사용자 결정):
 *  - **작품 축** — 그 작품 **하나만** 묻는 문항(`work_titles = {작품}`). (가)(나) 를 함께 묻는 문항은
 *    빠지고, 복합 지문이어도 발문이 그 작품만 묻는 문항은 남는다. 문제지에서는 묻지 않는 구역을
 *    빼고 인쇄할 수 있다(problem-paper/trim-works.ts).
 *  - **문법 축** — 문학·독서 지문에 딸리지 **않은** 문항. 지문이 없거나 화법과 언어 지문(문법 설명글·
 *    대화문·「훈민정음」)에 딸린 문항이 남는다.
 * 축이 없으면 아무 조건도 만들지 않는다 — 트리를 눌러 축을 바꿔도 칸은 켜진 채 남는다(취향이다).
 */

/**
 * 문법 축 단독 필터가 통과시키는 **지문 대영역**.
 *
 * ⚠️ `'화법과 언어'` 는 ara-system 영역 마스터의 대영역 이름이다(work-counts.ts 의 `LITERARY_AREA`·
 *    grammar-tree.ts 의 `GRAMMAR_AREA_NAMES` 와 같은 성질의 상수). 이름이 바뀌면 여기도 함께 고친다.
 *    SQL(sql/67)은 원시 글자만 복제하고 이 분류를 하지 않는다 — 거울을 두면 갈라진다.
 * `''` 은 지문이 없거나 영역이 빈 지문. **뒤에 둔다** — `in.(화법과 언어,)` 꼴이 운영 PostgREST 가
 * 빈 값으로 읽는 것으로 확인된 모양이다(quiz-references/candidates.ts).
 */
export const GRAMMAR_SOLO_PASSAGE_AREAS: readonly string[] = ['화법과 언어', ''];

/** 체크박스 이름 — 축마다 다르다 */
export const SOLO_LABELS = {
  work: '이 작품만 묻는 문항',
  grammar: '문학·독서 지문 없는 문항',
} as const;

/** 단독 필터를 걸 수 있는 축 — 작품이 먼저다(둘 다 걸렸을 때 이름이 그쪽을 말한다) */
export type SoloAxis = keyof typeof SOLO_LABELS;

/**
 * 지금 걸린 축 가운데 단독 필터가 뜻을 갖는 것.
 * @param filters - 화면 필터
 * @returns 작품 축 → 'work', 문법 축 → 'grammar', 둘 다 없으면 null
 */
export function soloAxisOf(filters: ProblemFilters): SoloAxis | null {
  if (filters.work_title) return 'work';
  if (filters.grammar_path.length > 0) return 'grammar';
  return null;
}

/**
 * 단독 필터가 **실제로 조건을 만드는가** — 켜져 있고 축이 있을 때만.
 * '조건 지우기' 단추가 숨은 칸 때문에 뜨지 않게 이 값으로 가른다.
 * @param filters - 화면 필터
 * @returns 조건이 걸리면 true
 */
export function soloApplies(filters: ProblemFilters): boolean {
  return filters.solo && soloAxisOf(filters) !== null;
}

/**
 * 필터 막대에 체크박스를 그릴지와 그 이름.
 * @param filters - 화면 필터
 * @returns 축이 있으면 이름, 없으면 null(그리지 않는다)
 */
export function soloToggleLabel(filters: ProblemFilters): string | null {
  const axis = soloAxisOf(filters);
  return axis ? SOLO_LABELS[axis] : null;
}
