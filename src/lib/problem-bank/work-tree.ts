import type { WorkFacet } from './facets';
import type { ProblemFilters } from './filters';
import { SCHOOL_AXES_CLEARED, type FacetTreeNode } from './school-exam-tree';

/**
 * 작품 트리 (순수 함수).
 *
 * 아카이브를 **지은이 › 작품** 으로 훑는다. 교과서 단원·학교 기출과 나란한 또 하나의
 * 진입로다 — 같은 「동백꽃」 문항을 여러 학교 기출에서 한 번에 모아 볼 수 있어야 한다.
 *
 * ⚠️ 트리는 **실제로 태깅된 작품**(패싯)으로만 만든다. 작품 마스터 표는 없고, 만들 생각도
 *    없다 — 작품은 교과서처럼 목록이 정해진 것이 아니라 시험지에 실려야 비로소 생긴다.
 * ⚠️ 노드 키는 `JSON.stringify` 로 만든다(학교 기출 트리와 같은 규약). 작품명·지은이는
 *    자유 텍스트라 `'|'` 같은 구분자를 쓰면 이름에 그 글자가 든 순간 키가 섞인다.
 */

/** 지은이를 모를 때 쓰는 폴더 이름 */
const UNKNOWN_AUTHOR = '지은이 미입력';

/** 작품 축을 비우는 패치 — 다른 트리로 넘어갈 때 쓴다 */
export const WORK_AXIS_CLEARED: Partial<ProblemFilters> = { work_title: '' };

/**
 * 작품 하나를 가리키는 키.
 * @param facet - 작품
 * @returns 중복 판정·강조에 쓰는 문자열
 */
export function workKey(facet: Pick<WorkFacet, 'title'>): string {
  return `work:${JSON.stringify([facet.title])}`;
}

/**
 * 작품들을 지은이 › 작품 트리로 묶는다.
 * @param facets - 패싯에서 모은 작품 (중복·제목 빈 값이 섞여 있어도 된다)
 * @returns 지은이부터 시작하는 트리
 */
export function buildWorkTree(facets: readonly WorkFacet[]): FacetTreeNode<WorkFacet>[] {
  const byAuthor = new Map<string, WorkFacet[]>();
  const seen = new Set<string>();

  for (const facet of facets) {
    // 제목이 없으면 어느 작품인지 알 수 없어 트리에 자리를 줄 수 없다
    if (!facet.title) continue;
    if (seen.has(facet.title)) continue;
    seen.add(facet.title);
    const author = facet.author || '';
    const list = byAuthor.get(author);
    if (list) list.push(facet);
    else byAuthor.set(author, [facet]);
  }

  return [...byAuthor.entries()]
    // 지은이를 모르는 것은 맨 뒤 — 아는 작가부터 훑는다
    .sort(([a], [b]) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b, 'ko');
    })
    .map(([author, works]) => ({
      id: `author:${JSON.stringify([author])}`,
      label: author || UNKNOWN_AUTHOR,
      children: [...works]
        .sort((a, b) => a.title.localeCompare(b.title, 'ko'))
        .map((work) => ({
          id: workKey(work),
          // 개수를 붙인다 — 어느 작품이 두툼하게 쌓였는지 한눈에 보여야 고르기 쉽다
          label: `${work.title} (${work.count})`,
          children: [],
          value: work,
        })),
    }));
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
    textbook: '',
    unit_path: [],
    work_title: facet.title,
    page: 0,
  };
}
