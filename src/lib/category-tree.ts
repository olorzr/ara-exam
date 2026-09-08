import type { Category } from '@/types';
import { EXTERNAL_LEVEL } from './constants';
import { UNSPECIFIED_OPTION } from './external-category';

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
        label: grade,
        type: 'grade' as const,
        children: Object.entries(byPub).map(([pub, pubCats]) => {
          const bySemester = groupBy(pubCats, (c) => c.semester || '미지정');

          return {
            id: `${level}-${grade}-${pub}`,
            label: pub,
            type: 'publisher' as const,
            children: Object.entries(bySemester).map(([sem, semCats]) => {
              const byChapter = groupBy(semCats, (c) => c.chapter);

              return {
                id: `${level}-${grade}-${pub}-${sem}`,
                label: sem,
                type: 'semester' as const,
                children: Object.entries(byChapter).map(([ch, chCats]) => {
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
                    id: `${level}-${grade}-${pub}-${sem}-${ch}`,
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
                }),
              };
            }),
          };
        }),
      };
    }),
  };
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

/** children 배열을 label 기준 자연순 정렬한다 */
function sortChildren(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes
    .map((node) => ({ ...node, children: sortChildren(node.children) }))
    .sort((a, b) => naturalCompare(a.label, b.label));
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}
