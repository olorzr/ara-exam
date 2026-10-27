import { naturalCompare } from '@/lib/category-tree';
import { NO_GRADE_OPTION } from '@/lib/textbook-grade';
import type { FacetTreeNode } from '@/lib/problem-bank/school-exam-tree';
import type { ReferenceUnit } from '@/types/reference-text';
import type { ReferenceFacetRow } from './facets';
import {
  UNIT_NONE_KEY, axisKey, type ReferenceBrowseAxis, type ReferenceUnitScope,
} from './filters';

/**
 * 작품 전문의 교과서 · 단원 트리 (순수 함수).
 *
 * **학년 › 교과서 › 학기 › 대단원 › 소단원** — 카테고리 관리·문제 은행 교과서 트리와 같은 층이라
 * 선생님이 이미 아는 모양이다. 학기가 빈 단원(학기 구분 없는 교과서 — 고등 선택과목)은 학기 폴더 없이
 * 대단원이 교과서 바로 아래 온다(`category-tree.ts` 와 같은 모양). 학기 폴더가 있으면 그쪽이 앞이다.
 * **[2026-10-28] 하나라도 붙은 교과서는 그 교과서의 마스터 단원을 전부 깐다** — 아직 아무것도 안 붙은
 * 단원이 `(0)` 으로 흐리게 보여, 단원마다 작품·개념을 '꽉꽉' 채웠는지 한눈에 본다(원장님 요청). 아무것도
 * 안 붙은 교과서는 여전히 그리지 않는다(교과서 수십 권의 빈 폴더가 찾을 것을 묻는다).
 *
 * ⚠️ 건수는 **전문 수**다(단원 수가 아니다). 한 전문이 같은 대단원의 소단원 둘에 붙어 있으면
 *    대단원 폴더에서는 한 번만 센다 — `(n)` 이 그 폴더를 눌렀을 때 나오는 목록 길이와 맞아야 한다.
 * ⚠️ **폴더마다**(학년·교과서·학기·소단원이 있는 대단원) 맨 앞에 `(전체)` 잎을 단다 — 폴더는
 *    누르면 펼쳐질 뿐이라, 이 잎이 없으면 '이 교과서 전부' 를 볼 길이 없다(코덱스 리뷰). 값은 그 폴더까지의
 *    칸만 든 범위라 jsonb 포함 검색이 그 아래 단원을 모두 건다(문법 트리의 `(전체)` 와 같은 수).
 * ⚠️ 잎의 id 는 `axisKey` 와 **같은 값**이다 — 강조를 축에서 바로 끌어낸다.
 */

/** 대단원 가지 맨 앞에 다는 '이 대단원 전부' 잎 */
export const UNIT_SELF_LEAF = '(전체)';

/** 단원을 하나도 안 붙인 전문 */
export const UNIT_NONE_LABEL = '분류 없음';

/**
 * 학년이 빈 단원 — 학년 구분 없는 고등 선택과목 교과서('선택과목', `textbook-grade.ts`).
 * 단원은 카테고리 트리에서 고르는데 중등 교과서는 늘 학년이 있어, 빈 학년은 선택과목뿐이다.
 */
const GRADELESS = NO_GRADE_OPTION;

/** 이름 → 그 아래 전문 id 들과 하위 갈래 */
interface Bucket {
  ids: Set<string>;
  children: Map<string, Bucket>;
}

const newBucket = (): Bucket => ({ ids: new Set(), children: new Map() });

/** 갈래를 찾거나 만든다(전문 id 는 넣지 않는다 — 마스터로 빈 갈래를 깔 때) */
function touch(parent: Bucket, name: string): Bucket {
  let bucket = parent.children.get(name);
  if (!bucket) {
    bucket = newBucket();
    parent.children.set(name, bucket);
  }
  return bucket;
}

/** 갈래를 찾거나 만들고 전문 id 를 넣는다 */
function enter(parent: Bucket, name: string, id: string): Bucket {
  const bucket = touch(parent, name);
  bucket.ids.add(id);
  return bucket;
}

/** 학년 순서 — 중학교가 먼저, 그다음 고등학교, 빈 학년(선택과목)은 맨 뒤 */
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

/** 범위 잎 하나 (단원 잎이거나 폴더의 `(전체)` 잎) — 0건이면 흐리게(고를 수는 있다) */
function unitLeaf(
  unit: ReferenceUnitScope, label: string, count: number,
): FacetTreeNode<ReferenceBrowseAxis> {
  const axis: ReferenceBrowseAxis = { kind: 'unit', unit };
  const node: FacetTreeNode<ReferenceBrowseAxis> = { id: axisKey(axis), label: labelWith(label, count), children: [], value: axis };
  if (count === 0) node.dimmed = true;
  return node;
}

/** 폴더 노드 — 0건이면 흐리게 */
function folder(id: string, label: string, count: number, children: FacetTreeNode<ReferenceBrowseAxis>[]): FacetTreeNode<ReferenceBrowseAxis> {
  const node: FacetTreeNode<ReferenceBrowseAxis> = { id, label: labelWith(label, count), children };
  if (count === 0) node.dimmed = true;
  return node;
}

/** 폴더 맨 앞의 `(전체)` 잎 — 그 폴더까지의 칸만 든 범위 */
const selfLeaf = (scope: ReferenceUnitScope, bucket: Bucket): FacetTreeNode<ReferenceBrowseAxis> =>
  unitLeaf(scope, UNIT_SELF_LEAF, bucket.ids.size);

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
  scope: Required<Pick<ReferenceUnitScope, 'grade' | 'textbook' | 'semester'>>,
  major: string,
  bucket: Bucket,
): FacetTreeNode<ReferenceBrowseAxis> {
  const self: ReferenceUnitScope = { ...scope, unit_path: [major] };
  if (bucket.children.size === 0) return unitLeaf(self, major, bucket.ids.size);

  return folder(`unit-tree:${JSON.stringify([scope.grade, scope.textbook, scope.semester, major])}`, major, bucket.ids.size, [
    selfLeaf(self, bucket),
    ...sortedEntries(bucket, compareNames).map(([sub, subBucket]) =>
      unitLeaf({ ...scope, unit_path: [major, sub] }, sub, subBucket.ids.size)),
  ]);
}

/**
 * 교과서 폴더 아래 — 학기 폴더들, 그다음 학기 구분 없는 대단원들.
 * 학기 `''` 갈래는 폴더를 만들지 않고 대단원을 바로 올린다. 범위 값에는 `semester: ''` 를 그대로
 * 실어 jsonb 포함 검색이 '학기 구분 없는' 단원만 정확히 건다.
 * @param grade - 학년
 * @param textbook - 교과서
 * @param bucket - 그 교과서의 갈래
 * @returns 노드 목록
 */
function textbookChildren(
  grade: string, textbook: string, bucket: Bucket,
): FacetTreeNode<ReferenceBrowseAxis>[] {
  const folders: FacetTreeNode<ReferenceBrowseAxis>[] = [];
  const flat: FacetTreeNode<ReferenceBrowseAxis>[] = [];
  for (const [semester, semesterBucket] of sortedEntries(bucket, compareNames)) {
    const scope = { grade, textbook, semester };
    const majors = sortedEntries(semesterBucket, compareNames)
      .map(([major, majorBucket]) => majorNode(scope, major, majorBucket));
    if (semester === '') {
      flat.push(...majors);
      continue;
    }
    folders.push(folder(`unit-tree:${JSON.stringify([grade, textbook, semester])}`, semester, semesterBucket.ids.size,
      [selfLeaf(scope, semesterBucket), ...majors]));
  }
  return [...folders, ...flat];
}

/**
 * 전문들의 단원으로 트리를 만든다.
 * @param rows - 패싯 (전문별 분류 칸)
 * @param master - 카테고리 관리의 단원 전부(`unit-master.ts`) — **붙은 교과서**의 단원만 깔린다. 없으면 붙은 단원만
 * @returns 학년 폴더부터 시작하는 트리 (+ 맨 끝 '분류 없음' 잎)
 */
export function buildReferenceUnitTree(
  rows: readonly ReferenceFacetRow[],
  master: readonly ReferenceUnit[] = [],
): FacetTreeNode<ReferenceBrowseAxis>[] {
  const root = newBucket();
  let untagged = 0;

  // 하나라도 붙은 교과서(학년 포함)의 마스터 단원을 먼저 깐다 — 빈 단원이 (0) 으로 드러난다
  const used = new Set(rows.flatMap((row) => row.units.map((u) => JSON.stringify([u.grade, u.textbook]))));
  for (const unit of master) {
    const [major, sub] = unit.unit_path;
    if (!unit.textbook || !major || !used.has(JSON.stringify([unit.grade, unit.textbook]))) continue;
    const majorBucket = touch(touch(touch(touch(root, unit.grade), unit.textbook), unit.semester), major);
    if (sub) touch(majorBucket, sub);
  }

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
    .map(([grade, gradeBucket]) => folder(`unit-tree:${JSON.stringify([grade])}`, grade || GRADELESS, gradeBucket.ids.size, [
      selfLeaf({ grade }, gradeBucket),
      ...sortedEntries(gradeBucket, (a, b) => a.localeCompare(b, 'ko'))
        .map(([textbook, textbookBucket]) => folder(
          `unit-tree:${JSON.stringify([grade, textbook])}`, textbook, textbookBucket.ids.size, [
            selfLeaf({ grade, textbook }, textbookBucket),
            ...textbookChildren(grade, textbook, textbookBucket),
          ],
        )),
    ]));

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
