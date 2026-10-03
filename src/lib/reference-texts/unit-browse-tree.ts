import { naturalCompare } from '@/lib/category-tree';
import type { FacetTreeNode } from '@/lib/problem-bank/school-exam-tree';
import type { ReferenceUnit } from '@/types/reference-text';
import type { ReferenceFacetRow } from './facets';
import { UNIT_NONE_KEY, axisKey, type ReferenceBrowseAxis } from './filters';

/**
 * 작품 전문의 교과서 · 단원 트리 (순수 함수).
 *
 * **학년 › 교과서 › 학기 › 대단원 › 소단원** — 카테고리 관리·문제 은행 교과서 트리와 같은 층이라
 * 선생님이 이미 아는 모양이다. 마스터 전체가 아니라 **실제로 붙은 단원**으로만 만든다(전문이
 * 없는 단원 폴더를 수백 개 늘어놓으면 찾을 것이 묻힌다).
 *
 * ⚠️ 건수는 **전문 수**다(단원 수가 아니다). 한 전문이 같은 대단원의 소단원 둘에 붙어 있으면
 *    대단원 폴더에서는 한 번만 센다 — `(n)` 이 그 폴더를 눌렀을 때 나오는 목록 길이와 맞아야 한다.
 * ⚠️ 소단원이 있는 대단원에는 맨 앞에 `(전체)` 잎을 단다. 값은 대단원만 든 단원이라
 *    jsonb 포함 검색이 그 아래 소단원 단원까지 함께 건다(문법 트리의 `(전체)` 와 같은 수).
 * ⚠️ 잎의 id 는 `axisKey` 와 **같은 값**이다 — 강조를 축에서 바로 끌어낸다.
 */

/** 대단원 가지 맨 앞에 다는 '이 대단원 전부' 잎 */
export const UNIT_SELF_LEAF = '(전체)';

/** 단원을 하나도 안 붙인 전문 */
export const UNIT_NONE_LABEL = '분류 없음';

const UNKNOWN_GRADE = '학년 미지정';
const UNKNOWN_SEMESTER = '학기 미지정';

/** 이름 → 그 아래 전문 id 들과 하위 갈래 */
interface Bucket {
  ids: Set<string>;
  children: Map<string, Bucket>;
}

const newBucket = (): Bucket => ({ ids: new Set(), children: new Map() });

/** 갈래를 찾거나 만들고 전문 id 를 넣는다 */
function enter(parent: Bucket, name: string, id: string): Bucket {
  let bucket = parent.children.get(name);
  if (!bucket) {
    bucket = newBucket();
    parent.children.set(name, bucket);
  }
  bucket.ids.add(id);
  return bucket;
}

/** 학년 순서 — 중학교가 먼저, 그다음 고등학교, 모르는 것은 맨 뒤 */
function gradeRank(grade: string): number {
  if (grade.startsWith('중')) return 0;
  if (grade.startsWith('고')) return 1;
  return 2;
}

/** 빈 값은 맨 뒤, 나머지는 자연순('10.' 이 '2.' 뒤) */
function compareNames(a: string, b: string): number {
  if (!a || !b) return Number(!a) - Number(!b);
  return naturalCompare(a, b);
}

const compareGrades = (a: string, b: string): number =>
  gradeRank(a) - gradeRank(b) || compareNames(a, b);

/** 이름과 건수 — 색만으로 알리지 않도록 숫자를 늘 적는다 */
const labelWith = (name: string, count: number): string => `${name} (${count})`;

/** 단원 잎 하나 */
function unitLeaf(unit: ReferenceUnit, label: string, count: number): FacetTreeNode<ReferenceBrowseAxis> {
  const axis: ReferenceBrowseAxis = { kind: 'unit', unit };
  return { id: axisKey(axis), label: labelWith(label, count), children: [], value: axis };
}

/** 정렬된 갈래 목록 */
function sortedEntries(bucket: Bucket, compare: (a: string, b: string) => number): [string, Bucket][] {
  return [...bucket.children.entries()].sort(([a], [b]) => compare(a, b));
}

/**
 * 대단원 갈래 하나를 노드로 — 소단원이 있으면 폴더, 없으면 그 자체가 잎.
 * @param scope - 학년·교과서·학기
 * @param major - 대단원 이름
 * @param bucket - 그 아래 갈래
 * @returns 트리 노드
 */
function majorNode(
  scope: Pick<ReferenceUnit, 'grade' | 'textbook' | 'semester'>,
  major: string,
  bucket: Bucket,
): FacetTreeNode<ReferenceBrowseAxis> {
  const self: ReferenceUnit = { ...scope, unit_path: [major] };
  if (bucket.children.size === 0) return unitLeaf(self, major, bucket.ids.size);

  return {
    id: `unit-tree:${JSON.stringify([scope.grade, scope.textbook, scope.semester, major])}`,
    label: labelWith(major, bucket.ids.size),
    children: [
      unitLeaf(self, UNIT_SELF_LEAF, bucket.ids.size),
      ...sortedEntries(bucket, compareNames).map(([sub, subBucket]) =>
        unitLeaf({ ...scope, unit_path: [major, sub] }, sub, subBucket.ids.size)),
    ],
  };
}

/**
 * 전문들의 단원으로 트리를 만든다.
 * @param rows - 패싯 (전문별 분류 칸)
 * @returns 학년 폴더부터 시작하는 트리 (+ 맨 끝 '분류 없음' 잎)
 */
export function buildReferenceUnitTree(
  rows: readonly ReferenceFacetRow[],
): FacetTreeNode<ReferenceBrowseAxis>[] {
  const root = newBucket();
  let untagged = 0;

  for (const row of rows) {
    if (row.units.length === 0) {
      untagged += 1;
      continue;
    }
    for (const unit of row.units) {
      const [major, sub] = unit.unit_path;
      if (!unit.textbook || !major) continue;
      const grade = enter(root, unit.grade, row.id);
      const textbook = enter(grade, unit.textbook, row.id);
      const semester = enter(textbook, unit.semester, row.id);
      const majorBucket = enter(semester, major, row.id);
      if (sub) enter(majorBucket, sub, row.id);
    }
  }

  const tree: FacetTreeNode<ReferenceBrowseAxis>[] = sortedEntries(root, compareGrades)
    .map(([grade, gradeBucket]) => ({
      id: `unit-tree:${JSON.stringify([grade])}`,
      label: labelWith(grade || UNKNOWN_GRADE, gradeBucket.ids.size),
      children: sortedEntries(gradeBucket, (a, b) => a.localeCompare(b, 'ko'))
        .map(([textbook, textbookBucket]) => ({
          id: `unit-tree:${JSON.stringify([grade, textbook])}`,
          label: labelWith(textbook, textbookBucket.ids.size),
          children: sortedEntries(textbookBucket, compareNames)
            .map(([semester, semesterBucket]) => ({
              id: `unit-tree:${JSON.stringify([grade, textbook, semester])}`,
              label: labelWith(semester || UNKNOWN_SEMESTER, semesterBucket.ids.size),
              children: sortedEntries(semesterBucket, compareNames)
                .map(([major, majorBucket]) => majorNode({ grade, textbook, semester }, major, majorBucket)),
            })),
        })),
    }));

  // 아직 단원을 안 붙인 전문도 이 탭에서 찾을 수 있어야 한다 — 붙이러 들어가는 길이다
  if (untagged > 0) {
    tree.push({
      id: UNIT_NONE_KEY,
      label: labelWith(UNIT_NONE_LABEL, untagged),
      children: [],
      value: { kind: 'unit-none' },
    });
  }
  return tree;
}
