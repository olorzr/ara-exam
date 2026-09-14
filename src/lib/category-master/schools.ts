import { supabase } from '../supabase';
import { normalizeCategoryName } from '../category-name';
import { fetchMasterSchoolName, fetchMasterSchools } from '../naesin-scope/fetch';
import { mergeSchoolOptions } from './school-options';
import type { School, SelectableSchool } from '@/types';

/**
 * 학교의 원본은 **관리자시스템 `public.schools`** 다(중등 15·고등 5).
 * 이 파일이 다루는 `exam.schools` 는 그 마스터의 **온디맨드 거울**이고 id 가 같다(sql/27) —
 * 프린트·외부지문이 실제로 등록된 학교만 들어 있다.
 *
 * ⚠️ **여기서 학교를 만들거나 이름을 고치지 말 것.** 학교 등록·수정·삭제는 관리자시스템에서만
 *    한다. 예전의 `createSchool`/`updateSchool`/`deleteSchool` 은 그래서 없앴다 — 손으로 적은
 *    이름이 마스터와 갈라지는 바람에 프린트 스캔의 학교 선택지가 두 곳뿐이었다.
 * ⚠️ 마스터 전체를 거울에 미리 복사하지 말 것. `aggregate.ts` 의 `getAllSelectableCategories`
 *    (개념지 편집기 카테고리 바 `ExamCategoryBar`·기출 `UnitTreePanel`)가 이 표를 `fetchAll('schools')`
 *    로 그대로 그려서, 미리 복사하면 프린트가 하나도 없는 학교로 트리가 가득 찬다.
 */

/** Postgres 유니크 위반 */
const UNIQUE_VIOLATION = '23505';

/**
 * 거울에 들어 있는 학교 — 곧 **프린트·외부지문이 이미 등록된 학교**다.
 * 선택 칸에 쓰려면 `getSelectableSchools()` 를 쓸 것(이쪽만 보면 마스터의 나머지가 안 보인다).
 * @returns 이름순 학교 목록
 */
export async function getSchools(): Promise<School[]> {
  const { data } = await supabase.from('schools').select('*').order('name');
  return (data as School[]) ?? [];
}

/**
 * 학교 선택 칸에 올릴 목록 — **관리자 마스터 ∪ 이미 쓰인 학교**.
 *
 * 마스터를 못 읽으면(권한·네트워크) 거울만으로 돌려준다. 빈 목록보다 낫다 —
 * 이미 만들어 둔 프린트의 학교라도 고를 수 있어야 편집기가 '고른 자리가 빈' 모양이 안 된다.
 * @returns 마스터(학교급 → 이름 순) 다음에 짝 없는 옛 학교
 */
export async function getSelectableSchools(): Promise<SelectableSchool[]> {
  const [master, used] = await Promise.all([
    fetchMasterSchools().catch(() => null),
    getSchools(),
  ]);
  return mergeSchoolOptions(master ?? [], used);
}

/** `ensureSchoolMirror` 의 결과 — 못 만들었으면 `id` 가 null 이고 까닭이 `warning` 에 있다 */
export interface SchoolMirrorResult {
  /** `school_materials.school_id` 에 실제로 써야 할 값. **언제나 넘긴 학교의 id 이거나 null 이다** */
  id: string | null;
  /** 사람에게 보여 줄 경고 (조용히 삼키지 말 것) */
  warning?: string;
}

/**
 * 마스터의 학교를 `exam.schools` 에 거울로 만들어 둔다 — **프린트를 저장하기 직전에** 부른다.
 *
 * `school_materials.school_id` 가 `exam.schools(id)` 를 가리키는 하드 FK 라, 거울이 없으면
 * 프린트 마스터 등록이 FK 위반으로 실패하고 카테고리 트리에서 그 프린트가 영영 안 보인다.
 *
 * ⚠️ **이름은 화면 값이 아니라 마스터에서 되읽어 쓴다.** 폼을 열어 둔 사이 관리자시스템에서
 *    이름을 바꿨다면, 화면이 들고 있던 옛 이름으로 upsert 하는 순간 `sync_school_name` 트리거가
 *    categories·concept_sheets·print_bundles 를 **전부 옛 이름으로 되돌린다** — 탭 하나가
 *    관리자의 이름 변경을 통째로 무를 수 있다(코덱스 리뷰 P1).
 * ⚠️ **이름이 겹치면 다른 학교에 붙이지 않는다.** `exam.schools.name` 은 UNIQUE 인데
 *    `public.schools.name` 은 아니다. 겹쳤을 때 같은 이름의 다른 행에 슬쩍 붙이면 프린트가
 *    **다른 학교 밑으로 조용히 들어간다** — 트리에서 안 보이는 것보다 나쁘다. 붙이지 않고 말한다.
 * @param school - 마스터에서 고른 학교(id 는 `public.schools.id`)
 * @returns 쓸 수 있는 거울 id 와, 있으면 경고
 */
export async function ensureSchoolMirror(school: { id: string; name: string }): Promise<SchoolMirrorResult> {
  if (!school.id) return { id: null };

  // 마스터에 없는 학교(보존 중인 옛 항목)거나 조회가 실패했으면 화면 값으로 물러선다
  const current = await fetchMasterSchoolName(school.id).catch(() => null);
  const authoritative = current !== null;
  const name = normalizeCategoryName(current ?? school.name);

  // ⚠️ **권위 있는 이름을 못 얻었으면 이미 있는 행의 이름을 건드리지 않는다**(넣기만 한다).
  //    행을 처음 만들 때는 되돌릴 이름이 아예 없어 화면 값을 써도 잃을 것이 없지만,
  //    이미 있는 행을 화면 값으로 덮으면 그 UPDATE 가 `sync_school_name` 을 발화시켜
  //    categories·concept_sheets·print_bundles 를 **전부 옛 이름으로 되돌린다**.
  //    마스터 조회가 잠깐 실패한 것만으로 관리자의 이름 변경이 무효가 되면 안 된다.
  const { error } = await supabase
    .from('schools')
    .upsert({ id: school.id, name }, { onConflict: 'id', ignoreDuplicates: !authoritative });
  if (!error) return { id: school.id };

  if (error.code === UNIQUE_VIOLATION) {
    return {
      id: null,
      warning: `'${name}' 과(와) 같은 이름의 학교가 이미 있어 카테고리 마스터에 등록하지 못했어요.`
        + ' 관리자시스템에서 학교 이름이 겹치지 않는지 확인해 주세요(sql/27 미적용일 수도 있습니다).',
    };
  }
  return { id: null, warning: `학교 '${name}' 을(를) 카테고리 마스터에 등록하지 못했어요: ${error.message}` };
}
