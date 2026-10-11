import type { Category } from '@/types';
import { EXTERNAL_LEVEL } from './constants';
import { UNSPECIFIED_OPTION } from './external-category';
import { textbookGradeLabel } from './textbook-grade';

/** 카테고리 트리 노드 타입 */
export interface CategoryTreeNode {
  id: string;
  label: string;
  type: 'level' | 'year' | 'grade' | 'publisher' | 'semester' | 'chapter' | 'sub_chapter' | 'school' | 'material';
  children: CategoryTreeNode[];
  category?: Category;
}

/**
 * 카테고리 배열을 계층 트리 구조로 변환한다.
 * 중등/고등: level > grade > publisher > semester > chapter > sub_chapter
 *   (학기가 빈 '학기 구분 없는' 교과서는 semester 층 없이 publisher > chapter,
 *    학년이 빈 고등 교과서는 grade 폴더 이름이 '선택과목')
 * 외부지문: level > school > year > grade > material
 */
export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const byLevel = groupBy(categories, (c) => c.level);

  const tree = Object.entries(byLevel).map(([level, cats]) => {
    if (level === EXTERNAL_LEVEL) {
      return buildExternalTree(level, cats);
    }
    return buildSchoolLevelTree(level, cats);
  });

  return sortChildren(tree);
}

function buildExternalTree(level: string, cats: Category[]): CategoryTreeNode {
  const bySchool = groupBy(cats, (c) => c.school_name || '외부');

  return {
    id: `level-${level}`,
    label: level,
    type: 'level',
    children: Object.entries(bySchool).map(([school, schoolCats]) => {
      // 년도/학년이 비어 있는(미지정) 과거 데이터도 자기 노드 아래에 그대로 노출한다.
      const byYear = groupBy(schoolCats, (c) => c.year || UNSPECIFIED_OPTION);

      return {
        id: `school-${school}`,
        label: school,
        type: 'school' as const,
        children: Object.entries(byYear).map(([year, yearCats]) => {
          const byGrade = groupBy(yearCats, (c) => c.grade || UNSPECIFIED_OPTION);

          return {
            id: `school-${school}-${year}`,
            label: year === UNSPECIFIED_OPTION ? year : `${year}학년도`,
            type: 'year' as const,
            children: Object.entries(byGrade).map(([grade, gradeCats]) => ({
              id: `school-${school}-${year}-${grade}`,
              label: grade,
              type: 'grade' as const,
              children: gradeCats.map((cat) => ({
                id: cat.id,
                label: cat.chapter || '(미분류)',
                type: 'material' as const,
                children: [],
                category: cat,
              })),
            })),
          };
        }),
      };
    }),
  };
}

function buildSchoolLevelTree(level: string, cats: Category[]): CategoryTreeNode {
  const byGrade = groupBy(cats, (c) => c.grade);

  return {
    id: `level-${level}`,
    label: level,
    type: 'level',
    children: Object.entries(byGrade).map(([grade, gradeCats]) => {
      const byPub = groupBy(gradeCats, (c) => c.publisher);

      return {
        id: `${level}-${grade}`,
        // 학년이 빈 고등 교과서 = 선택과목(고2·고3 어디서든 배운다) — 이름 없는 폴더가 되지 않게
        label: textbookGradeLabel(grade, level),
        type: 'grade' as const,
        children: Object.entries(byPub).map(([pub, pubCats]) => ({
          id: `${level}-${grade}-${pub}`,
          label: pub,
          type: 'publisher' as const,
          children: publisherChildren(`${level}-${grade}-${pub}`, pubCats),
        })),
      };
    }),
  };
}

/**
 * 출판사(교과서) 아래 — 학기 폴더 › 대단원.
 *
 * 학기가 빈 행은 **학기 구분 없는 교과서**(고등 선택과목 — 문학·화법과 언어 등, `semester.ts`)라
 * 학기 폴더 없이 대단원을 출판사 바로 아래 둔다. 예전에는 '미지정' 폴더 하나를 더 거쳐야 했다.
 * 노드 id 는 학기 자리가 비어 `…-출판사--대단원` 이 된다(학기 폴더 아래 대단원과 겹치지 않는다).
 * @param prefix - 출판사 노드 id
 * @param pubCats - 그 출판사의 카테고리
 * @returns 학기 폴더들 + (학기 없는) 대단원들
 */
function publisherChildren(prefix: string, pubCats: Category[]): CategoryTreeNode[] {
  const bySemester = groupBy(pubCats, (c) => c.semester);

  return Object.entries(bySemester).flatMap(([sem, semCats]) => {
    const chapters = chapterNodes(`${prefix}-${sem}`, semCats);
    if (sem === '') return chapters;
    return [{
      id: `${prefix}-${sem}`,
      label: sem,
      type: 'semester' as const,
      children: chapters,
    }];
  });
}

/**
 * 대단원 노드들 — 소단원이 없는 대단원 하나는 그 자체가 고를 수 있는 잎, 아니면 폴더.
 * @param prefix - 부모(학기 또는 출판사) 노드 id
 * @param cats - 그 아래 카테고리
 * @returns 대단원 노드
 */
function chapterNodes(prefix: string, cats: Category[]): CategoryTreeNode[] {
  const byChapter = groupBy(cats, (c) => c.chapter);

  return Object.entries(byChapter).map(([ch, chCats]) => {
    const hasSubChapters = chCats.some((c) => c.sub_chapter);

    if (!hasSubChapters && chCats.length === 1) {
      return {
        id: chCats[0].id,
        label: ch,
        type: 'chapter' as const,
        children: [],
        category: chCats[0],
      };
    }

    return {
      id: `${prefix}-${ch}`,
      label: ch,
      type: 'chapter' as const,
      children: chCats.map((cat) => ({
        id: cat.id,
        label: cat.sub_chapter || '(전체)',
        type: 'sub_chapter' as const,
        children: [],
        category: cat,
      })),
    };
  });
}

/**
 * 자연스러운 문자열 비교 (숫자 부분을 숫자로 비교).
 * `'10. 문학'` 이 `'2. 문법'` 보다 뒤에 오게 한다 — 단원 이름은 거의 번호로 시작한다.
 * @param a - 왼쪽 문자열
 * @param b - 오른쪽 문자열
 * @returns 정렬 비교값
 */
export function naturalCompare(a: string, b: string): number {
  const regex = /(\d+)|(\D+)/g;
  const aParts = a.match(regex) ?? [];
  const bParts = b.match(regex) ?? [];

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    if (i >= aParts.length) return -1;
    if (i >= bParts.length) return 1;

    const aIsNum = /^\d+$/.test(aParts[i]);
    const bIsNum = /^\d+$/.test(bParts[i]);

    if (aIsNum && bIsNum) {
      const diff = Number(aParts[i]) - Number(bParts[i]);
      if (diff !== 0) return diff;
    } else {
      const cmp = aParts[i].localeCompare(bParts[i]);
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

/**
 * children 배열을 label 기준 자연순 정렬한다.
 * 학기 폴더는 언제나 그 옆의 대단원보다 앞이다 — 한 교과서에 학기 폴더와 학기 없는 대단원이
 * 섞이면(정상 데이터에는 없다) 라벨순으로만 세울 때 '1. 문학' 과 '1학기' 가 한 줄에 엉킨다.
 */
function sortChildren(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes
    .map((node) => ({ ...node, children: sortChildren(node.children) }))
    .sort((a, b) => folderRank(a) - folderRank(b) || naturalCompare(a.label, b.label));
}

/** 학기 폴더를 앞으로 */
const folderRank = (node: CategoryTreeNode): number => (node.type === 'semester' ? 0 : 1);

/**
 * 같은 키끼리 묶는다.
 *
 * ⚠️ **모아 담는 그릇은 `{}` 가 아니라 프로토타입 없는 객체여야 한다**(코덱스 리뷰).
 *    카테고리 이름은 선생님이 직접 치는 자유 텍스트라 `__proto__`·`constructor`·`toString`
 *    이 그대로 키가 될 수 있는데, 평범한 객체에서는 그 이름들이 **물려받은 속성**으로 잡혀
 *    `if (!acc[key])` 가 거짓이 되고 `acc[key].push` 가 함수가 아니라 터진다 —
 *    개념지 목록이 통째로 안 그려진다. `Object.entries` 는 그대로 쓸 수 있다.
 *    (O/X 별칭표를 `Map` 으로 둔 것과 같은 근거다)
 * @param items - 묶을 것들
 * @param keyFn - 키를 뽑는 함수
 * @returns 키 → 그 키의 것들
 */
function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const acc = Object.create(null) as Record<string, T[]>;
  for (const item of items) {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
  }
  return acc;
}
