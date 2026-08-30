import { supabase } from '../supabase';
import { categoryNaturalKey, withNormalizedCategoryNames } from '../category-key';
import { EXTERNAL_LEVEL } from '../constants';
import type { Publisher, MajorChapter, SubChapter, School, SchoolMaterial, Category } from '@/types';

/**
 * 한 번에 읽을 최대 행 수. PostgREST 기본 상한에 조용히 걸려 단원이 사라지는 것을
 * 막기 위해 명시하고, 상한에 닿으면 호출처가 알 수 있도록 에러를 던진다.
 */
const SELECT_LIMIT = 5000;

/**
 * 마스터 전개용 Category 골격 (id 는 호출처가 지정).
 *
 * 이름 필드는 `withNormalizedCategoryNames` 로 정규화해서 내보낸다. 마스터 테이블에
 * `천재(정호웅)` 과 `천재 (정호웅)` 이 둘 다 남아 있으면 트리의 `groupBy` 가 이름
 * 완전 일치로 묶기 때문에 출판사 폴더가 두 개로 갈라진다(그 아래 대단원·소단원도
 * 각각 나뉘어 붙는다). 값까지 정규화해야 한 노드로 합쳐진다.
 */
function makeCategory(id: string, fields: Partial<Category> & Pick<Category, 'level'>): Category {
  return withNormalizedCategoryNames({
    id,
    level: fields.level,
    year: fields.year ?? '',
    grade: fields.grade ?? '',
    publisher: fields.publisher ?? '',
    semester: fields.semester ?? '',
    chapter: fields.chapter ?? '',
    sub_chapter: fields.sub_chapter ?? '',
    school_name: fields.school_name ?? '',
    user_id: '',
    created_at: '',
  });
}

/**
 * 앱에서 **선택 가능한 모든 카테고리**를 반환한다. 세 소스의 합집합이다.
 *
 * 1. 마스터 중등/고등 전개 (publishers × major_chapters × sub_chapters).
 *    소단원이 있어도 `sub_chapter: ''` 인 대단원 단독 행을 함께 만든다 — 단어 등록은
 *    소단원이 선택 사항이라 대단원만으로 저장할 수 있는데, 예전엔 개념지 트리에
 *    그 조합이 없어 같은 단원을 고를 수 없었다(트리에서 `(전체)` 노드로 뜬다).
 * 2. 마스터 외부지문 전개 (schools × school_materials).
 * 3. `categories` 테이블 전체 — 마스터에서 지워졌거나 마스터 없이 만들어진 레거시 단원까지.
 *
 * 중복은 자연키로 제거하며 `categories` 행(실제 UUID 를 가진 쪽)을 우선한다.
 * 단어 등록 여부와 무관하게 빈 카테고리도 포함되므로, 개념지 편집기처럼
 * "아직 단어가 없는 단원도 골라야 하는" 곳에서 그대로 쓸 수 있다.
 *
 * @returns 선택 가능한 카테고리 배열
 * @throws 조회 실패 시(RLS·네트워크) 또는 행 상한에 도달했을 때
 */
export async function getAllSelectableCategories(): Promise<Category[]> {
  // 상한 + 1 을 요청해, 실제로 넘쳤을 때만(= 조용히 잘렸을 때만) 에러를 낸다.
  const fetchAll = (table: string) => supabase.from(table).select('*').limit(SELECT_LIMIT + 1);

  const [pubRes, majorRes, subRes, schoolRes, materialRes, categoryRes] = await Promise.all([
    fetchAll('publishers'),
    fetchAll('major_chapters'),
    fetchAll('sub_chapters'),
    fetchAll('schools'),
    fetchAll('school_materials'),
    fetchAll('categories'),
  ]);

  const responses = [
    ['publishers', pubRes], ['major_chapters', majorRes], ['sub_chapters', subRes],
    ['schools', schoolRes], ['school_materials', materialRes], ['categories', categoryRes],
  ] as const;

  for (const [name, res] of responses) {
    if (res.error) throw new Error(`${name} 조회 실패: ${res.error.message}`);
    if ((res.data?.length ?? 0) > SELECT_LIMIT) {
      throw new Error(`${name} 가 조회 상한(${SELECT_LIMIT}행)을 넘었습니다. 페이지네이션이 필요합니다.`);
    }
  }

  const publishers = (pubRes.data as Publisher[]) ?? [];
  const majors = (majorRes.data as MajorChapter[]) ?? [];
  const subs = (subRes.data as SubChapter[]) ?? [];
  const schools = (schoolRes.data as School[]) ?? [];
  const materials = (materialRes.data as SchoolMaterial[]) ?? [];
  const saved = (categoryRes.data as Category[]) ?? [];

  const result: Category[] = [];

  // 1. 중등/고등 마스터
  for (const pub of publishers) {
    for (const major of majors.filter((m) => m.publisher_id === pub.id)) {
      const base = {
        level: pub.level,
        grade: major.grade,
        publisher: pub.name,
        semester: major.semester,
        chapter: major.name,
      };
      // 대단원 단독(= 소단원 미지정) 은 소단원 유무와 무관하게 항상 만든다
      result.push(makeCategory(`master-major-${major.id}`, base));
      for (const sub of subs.filter((s) => s.major_chapter_id === major.id)) {
        result.push(makeCategory(`master-sub-${sub.id}`, { ...base, sub_chapter: sub.name }));
      }
    }
  }

  // 2. 외부지문 마스터
  const schoolNameById = new Map(schools.map((s) => [s.id, s.name]));
  for (const material of materials) {
    const schoolName = schoolNameById.get(material.school_id);
    if (!schoolName) continue;
    result.push(makeCategory(`master-material-${material.id}`, {
      level: EXTERNAL_LEVEL,
      year: material.year,
      grade: material.grade,
      chapter: material.name,
      school_name: schoolName,
    }));
  }

  // 3. categories 테이블 (같은 자연키면 이쪽이 이긴다 — 실제 UUID 를 가진 행)
  //    저장된 행도 정규화해서 담는다 — 마스터와 표기가 갈리면 dedupe 를 통과해
  //    두 행이 살아남고, 트리에서 다시 두 폴더로 보인다.
  const byKey = new Map<string, Category>();
  for (const cat of result) byKey.set(categoryNaturalKey(cat), cat);
  for (const cat of saved) {
    const normalized = withNormalizedCategoryNames(cat);
    byKey.set(categoryNaturalKey(normalized), normalized);
  }

  return [...byKey.values()];
}
