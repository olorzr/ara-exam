import type { WorkFacet } from '@/lib/problem-bank/facets';
import { buildGrammarBrowseTree } from '@/lib/problem-bank/grammar-browse-tree';
import { tallyGrammarCounts } from '@/lib/problem-bank/grammar-counts';
import type { FacetTreeNode } from '@/lib/problem-bank/school-exam-tree';
import { buildWorkTree, type WorkTreeOrder } from '@/lib/problem-bank/work-tree';
import type { ReferenceFacetRow } from './facets';
import { GRAMMAR_NONE_KEY, type ReferenceBrowseAxis } from './filters';

/**
 * 작품 전문의 작품 · 문법 트리 (순수 함수). 단원 트리는 `unit-browse-tree.ts`.
 *
 * 문제 은행의 트리 빌더(`buildWorkTree`·`buildGrammarBrowseTree`)를 **그대로** 쓰고, 잎의 값만
 * 축(`ReferenceBrowseAxis`)으로 바꾼다 — 그러면 세 탭이 모두 `onSelect(axis)` 하나로 끝나고,
 * 잎 id 가 원래 빌더의 것 그대로라 `axisKey` 로 강조가 바로 나온다.
 */

/** 문법 분류를 하나도 안 붙인 전문 */
export const GRAMMAR_NONE_LABEL = '분류 없음';

/**
 * 트리의 잎 값을 바꾼다(모양·id·라벨은 그대로).
 * @param nodes - 원래 트리
 * @param map - 잎 값 변환
 * @returns 값만 바뀐 트리
 */
export function mapTreeValues<A, B>(
  nodes: readonly FacetTreeNode<A>[],
  map: (value: A) => B,
): FacetTreeNode<B>[] {
  return nodes.map((node) => ({
    id: node.id,
    label: node.label,
    dimmed: node.dimmed,
    children: mapTreeValues(node.children, map),
    ...(node.value !== undefined ? { value: map(node.value) } : {}),
  }));
}

/**
 * 전문들을 작품별로 묶는다 — 같은 제목의 판본이 여럿이면 한 작품의 `(n)` 이 된다.
 *
 * 지은이는 처음 만난 비어 있지 않은 값이다(판본마다 비워 둔 것이 섞여도 폴더가 갈리지 않게).
 * 갈래는 모두 문학으로 둔다 — 전문은 영역 축이 없고, 올리는 것도 거의 문학 작품이다.
 * @param rows - 패싯
 * @returns 작품 목록
 */
export function referenceWorkFacets(rows: readonly ReferenceFacetRow[]): WorkFacet[] {
  const byTitle = new Map<string, WorkFacet>();
  for (const row of rows) {
    const title = row.title.trim();
    if (!title) continue;
    const author = row.author.trim();
    const hit = byTitle.get(title);
    if (hit) {
      hit.count += 1;
      if (!hit.author && author) hit.author = author;
    } else {
      byTitle.set(title, { title, author, count: 1, kind: 'literary' });
    }
  }
  return [...byTitle.values()];
}

/**
 * 작품 트리 — **지은이 › 작품** (또는 작품 평면).
 *
 * 문제 은행 빌더는 갈래 폴더(문학·비문학)부터 시작하는데, 전문은 전부 '문학' 하나라 그 뿌리를
 * 걷어 낸다 — 폴더 하나를 매번 더 여는 수고만 남는다.
 * @param rows - 패싯
 * @param order - 'author' 면 지은이 폴더, 'title' 이면 작품 평면
 * @returns 트리 (잎 값은 작품 축)
 */
export function buildReferenceWorkTree(
  rows: readonly ReferenceFacetRow[],
  order: WorkTreeOrder,
): FacetTreeNode<ReferenceBrowseAxis>[] {
  const flattened = buildWorkTree(referenceWorkFacets(rows), order).flatMap((kind) => kind.children);
  return mapTreeValues(flattened, (facet): ReferenceBrowseAxis => ({ kind: 'work', title: facet.title }));
}

/**
 * 문법 트리 — **마스터 전체**에 전문 수를 얹는다(0건은 흐리게).
 *
 * 문제 은행 문법 트리와 같은 판단이다: 마스터가 코드 상수라 목차 그대로 보여 주면 아직 전문이
 * 없는 개념도 자리가 보인다. 맨 끝에 '분류 없음' 잎을 단다.
 * @param rows - 패싯
 * @returns 트리 (잎 값은 문법 축)
 */
export function buildReferenceGrammarTree(
  rows: readonly ReferenceFacetRow[],
): FacetTreeNode<ReferenceBrowseAxis>[] {
  const counts = tallyGrammarCounts(rows.map((row) => row.grammar_paths));
  const tree = mapTreeValues(
    buildGrammarBrowseTree(counts),
    (path): ReferenceBrowseAxis => ({ kind: 'grammar', path }),
  );
  const untagged = rows.filter((row) => row.grammar_paths.length === 0).length;
  if (untagged > 0) {
    tree.push({
      id: GRAMMAR_NONE_KEY,
      label: `${GRAMMAR_NONE_LABEL} (${untagged})`,
      children: [],
      value: { kind: 'grammar-none' },
    });
  }
  return tree;
}
