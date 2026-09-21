import type { WorkFacet } from './facets';
import { GRAMMAR_AXIS_CLEARED, type ProblemFilters } from './filters';
import { SCHOOL_AXES_CLEARED, type FacetTreeNode } from './school-exam-tree';
import type { WorkKind } from './work-counts';

/**
 * 작품 트리 (순수 함수).
 *
 * 아카이브를 **문학·비문학 › (지은이 ›) 작품** 으로 훑는다. 교과서 단원·학교 기출과 나란한
 * 또 하나의 진입로다 — 같은 「동백꽃」 문항을 여러 학교 기출에서 한 번에 모아 볼 수 있어야 한다.
 *
 * ⚠️ 트리는 **실제로 태깅된 작품**(패싯)으로만 만든다. 작품 마스터 표는 없고, 만들 생각도
 *    없다 — 작품은 교과서처럼 목록이 정해진 것이 아니라 시험지에 실려야 비로소 생긴다.
 * ⚠️ 노드 키는 `JSON.stringify` 로 만든다(학교 기출 트리와 같은 규약). 작품명·지은이는
 *    자유 텍스트라 `'|'` 같은 구분자를 쓰면 이름에 그 글자가 든 순간 키가 섞인다.
 * ⚠️ **잎의 id 는 정렬 모드와 무관하게 `workKey` 다.** 정렬을 바꿨다고 고른 작품의 강조가
 *    풀리면 어디를 눌러 이 목록이 됐는지 알 수 없어진다.
 */

/** 지은이를 모를 때 쓰는 폴더 이름 */
const UNKNOWN_AUTHOR = '지은이 미입력';

/** 갈래 폴더 순서 — 문학이 먼저다(작품 트리에서 먼저 찾는 것이 문학이다) */
const KIND_ORDER: readonly WorkKind[] = ['literary', 'nonliterary', 'unknown'];

/** 갈래 폴더 이름 */
const KIND_LABEL: Record<WorkKind, string> = {
  literary: '문학',
  nonliterary: '비문학',
  unknown: '영역 미지정',
};

/** 잎 라벨에서 제목과 지은이를 잇는 글자 — `' · '`(작품 여럿을 이은 파생 문자열)와 겹치지 않게 */
const TITLE_AUTHOR_JOIN = ' — ';

/** 고를 수 있는 트리 정렬 */
export const WORK_TREE_ORDERS = ['author', 'title'] as const;

/** 트리 정렬 — 'author' 는 지은이 폴더로 묶고, 'title' 은 작품을 평면으로 세운다 */
export type WorkTreeOrder = typeof WORK_TREE_ORDERS[number];

/** 기본 정렬 (이 기능이 생기기 전의 모양) */
export const DEFAULT_WORK_TREE_ORDER: WorkTreeOrder = 'author';

/** 작품 축을 비우는 패치 — 다른 트리로 넘어갈 때 쓴다 */
export const WORK_AXIS_CLEARED: Partial<ProblemFilters> = { work_title: '' };

/**
 * 저장·선택된 값이 쓸 수 있는 정렬인지.
 *
 * 화면(`OptionSelect`)과 localStorage 는 둘 다 `string` 을 주므로 `as` 로 단정하지 않고
 * 여기서 좁힌다.
 * @param value - 확인할 값
 * @returns 쓸 수 있는 정렬이면 true
 */
export function isWorkTreeOrder(value: string): value is WorkTreeOrder {
  return (WORK_TREE_ORDERS as readonly string[]).includes(value);
}

/**
 * 작품 하나를 가리키는 키.
 * @param facet - 작품
 * @returns 중복 판정·강조에 쓰는 문자열
 */
export function workKey(facet: Pick<WorkFacet, 'title'>): string {
  return `work:${JSON.stringify([facet.title])}`;
}

/** 한글 사전순, 빈 값은 맨 뒤 */
function compareWithEmptyLast(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, 'ko');
}

/** 작품 잎 하나 */
function workLeaf(work: WorkFacet, withAuthor: boolean): FacetTreeNode<WorkFacet> {
  // 개수를 붙인다 — 어느 작품이 두툼하게 쌓였는지 한눈에 보여야 고르기 쉽다
  const name = withAuthor && work.author
    ? `${work.title}${TITLE_AUTHOR_JOIN}${work.author}`
    : work.title;
  return { id: workKey(work), label: `${name} (${work.count})`, children: [], value: work };
}

/** 지은이 폴더들 — 갈래 하나 아래 */
function authorFolders(kind: WorkKind, works: WorkFacet[]): FacetTreeNode<WorkFacet>[] {
  const byAuthor = new Map<string, WorkFacet[]>();
  for (const work of works) {
    const author = work.author || '';
    const list = byAuthor.get(author);
    if (list) list.push(work);
    else byAuthor.set(author, [work]);
  }

  return [...byAuthor.entries()]
    // 지은이를 모르는 것은 맨 뒤 — 아는 작가부터 훑는다
    .sort(([a], [b]) => compareWithEmptyLast(a, b))
    .map(([author, authorWorks]) => ({
      // ⚠️ 키에 갈래를 함께 넣는다 — 같은 지은이가 문학·비문학에 다 있으면 키가 겹친다
      //    (성석제의 수필과 학생 글처럼 실제로 일어난다)
      id: `author:${JSON.stringify([kind, author])}`,
      label: author || UNKNOWN_AUTHOR,
      children: [...authorWorks]
        .sort((a, b) => a.title.localeCompare(b.title, 'ko'))
        .map((work) => workLeaf(work, false)),
    }));
}

/**
 * 작품들을 갈래 › (지은이 ›) 작품 트리로 묶는다.
 * @param facets - 패싯에서 모은 작품 (중복·제목 빈 값이 섞여 있어도 된다)
 * @param order - 'author' 면 지은이 폴더로 묶고, 'title' 이면 작품을 평면으로 세운다
 * @returns 갈래 폴더부터 시작하는 트리 (작품이 없는 갈래는 빼고)
 */
export function buildWorkTree(
  facets: readonly WorkFacet[],
  order: WorkTreeOrder = DEFAULT_WORK_TREE_ORDER,
): FacetTreeNode<WorkFacet>[] {
  const byKind = new Map<WorkKind, WorkFacet[]>();
  const seen = new Set<string>();

  for (const facet of facets) {
    // 제목이 없으면 어느 작품인지 알 수 없어 트리에 자리를 줄 수 없다
    if (!facet.title) continue;
    if (seen.has(facet.title)) continue;
    seen.add(facet.title);
    const list = byKind.get(facet.kind);
    if (list) list.push(facet);
    else byKind.set(facet.kind, [facet]);
  }

  return KIND_ORDER
    .filter((kind) => (byKind.get(kind)?.length ?? 0) > 0)
    .map((kind) => {
      const works = byKind.get(kind) ?? [];
      return {
        id: `kind:${kind}`,
        label: KIND_LABEL[kind],
        children: order === 'author'
          ? authorFolders(kind, works)
          : [...works]
            .sort((a, b) => a.title.localeCompare(b.title, 'ko'))
            .map((work) => workLeaf(work, true)),
      };
    });
}

/**
 * 작품을 골랐을 때 걸 필터.
 *
 * 학교·교과서·단원 축을 **비운다** — 세 트리는 탭으로 갈린 대안 경로라, 남겨 두면
 * '상현중 기출 ∩ 동백꽃' 이 조용히 0건이 되고 화면에 이유가 없다(학교마다 실리는 작품이
 * 다르다). 일부러 겹쳐 보고 싶으면 위쪽 필터 줄에서 고른다.
 * @param facet - 고른 작품
 * @returns 필터 패치
 */
export function workFilterPatch(facet: WorkFacet): Partial<ProblemFilters> {
  return {
    ...SCHOOL_AXES_CLEARED,
    ...GRAMMAR_AXIS_CLEARED,
    textbook: '',
    unit_path: [],
    work_title: facet.title,
    page: 0,
  };
}
