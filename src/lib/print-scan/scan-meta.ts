import { normalizeCategoryName } from '@/lib/category-name';
import { SEMESTER_OPTIONS } from '@/lib/constants';
import { toStoredValue, UNSPECIFIED_OPTION } from '@/lib/external-category';
import {
  EXAM_TYPE_OPTIONS, gradeOptionsForLevel, type SchoolLevel,
} from '@/lib/problem-bank/source-form';
import type { SelectableSchool } from '@/types';

/**
 * 스캔 한 건이 공통으로 지니는 정보 — **학교급 → 학교 → 학년 → 학년도 → 학기 → 시험**.
 *
 * 예전에는 이 값들을 **프린트(묶음)마다** 물었다. 한 번에 스캔해 오는 프린트는 거의 언제나
 * 같은 학교·같은 학년 것이라 같은 값을 대여섯 번 고르게 되고, 그래서 `newBundleDraft` 가
 * 앞 묶음에서 물려받는 우회로까지 있었다. 이제 **스캔을 올릴 때 한 번** 고르고,
 * 저장할 때 묶음 행마다 복사한다(DB 는 그대로 묶음 단위다 — sql/29 참고).
 *
 * 기출 업로드 폼(`problem-bank/source-form.ts`)과 **같은 규약**이다:
 *  · 값은 **표시값**이다('미지정' 이 섞일 수 있고, 저장 직전 `toStoredValue` 로 바꾼다)
 *  · 학교급은 **저장하지 않는다** — 학교·학년 선택지를 좁히는 데만 쓰고 학년 접두사로 되찾는다
 *  · 제목은 직접 치기 전까지 고른 값을 따라간다
 */

/** 화면이 들고 있는 스캔 정보 (표시값 그대로) */
export interface ScanMetaValues {
  /** 학교급 — **저장하지 않는다**. 학교·학년 선택지를 좁히는 데만 쓴다 */
  level: SchoolLevel;
  /** 고른 학교 마스터 id ('' 면 아직 안 고름) */
  schoolId: string;
  /** 꼬리표('옛 항목')가 붙지 않은 원래 이름 */
  schoolName: string;
  /** 학년도 표시값 */
  year: string;
  /** 학년 표시값 ('미지정' 일 수 있다) */
  grade: string;
  /** 학기 표시값 ('미지정' 일 수 있다) */
  semester: string;
  /** 시험 구분 표시값 ('미지정' 일 수 있다) */
  examType: string;
  /** 스캔 제목 — 목록에서 이 스캔을 찾는 이름이자 **프린트 이름의 앞부분**이다 */
  title: string;
}

/**
 * 화면 상태 — 값 + '제목이 아직 자동인가'.
 *
 * 자동 여부를 값과 **한 덩어리로** 들고 있는 이유는 `SourceFormState` 와 같다:
 * 갱신 함수는 순수해야 하는데(React 가 두 번 부를 수 있다) 따로 두면 그 안에서
 * 다른 state 를 만지게 된다.
 */
export interface ScanMetaState {
  values: ScanMetaValues;
  /** 제목을 아직 손으로 치지 않았는가 */
  titleAuto: boolean;
}

/**
 * 첫 상태. 학교는 비워 두고(고르는 순간 다음 단계가 열린다) 나머지는 미지정으로 시작한다.
 * @param defaultYear - 올해 학년도 표시값 (`kstYear()` 를 문자열로)
 * @returns 스캔 정보 상태
 */
export function initialScanMeta(defaultYear: string): ScanMetaState {
  return {
    values: {
      // 운영 마스터가 중등 15 · 고등 5 라 중등이 기본이다(기출 업로드 폼과 같다)
      level: '중등',
      schoolId: '',
      schoolName: '',
      year: defaultYear,
      grade: UNSPECIFIED_OPTION,
      semester: UNSPECIFIED_OPTION,
      examType: UNSPECIFIED_OPTION,
      title: '',
    },
    titleAuto: true,
  };
}

/**
 * 고른 값으로 만드는 스캔 제목.
 *
 * 학교를 고르기 전에는 **빈 문자열**이다 — 학교만 빠진 `"2026"` 같은 제목이 자동으로
 * 박히면 그게 이름인 줄 알고 그대로 두게 된다(제목 칸은 그때까지 안내만 보여 준다).
 * @param values - 지금 고른 값
 * @returns `"2026 상현중 중2 1학기 중간"` 형태. 학교를 안 골랐으면 빈 문자열
 */
export function suggestScanTitle(values: ScanMetaValues): string {
  if (!values.schoolName.trim()) return '';
  const parts = [
    values.year, values.schoolName, values.grade, values.semester, values.examType,
  ].map(toStoredValue).filter(Boolean);
  return normalizeCategoryName(parts.join(' '));
}

/**
 * 값 하나를 고친 결과 (자동 제목 규칙 포함).
 *
 * `applySourcePatch` 의 거울이다. 제목은 **직접 치기 전까지** `suggestScanTitle` 을 따라가고,
 * 직접 치면 그대로 두며, 칸을 비우면 다시 따라간다.
 *
 * 학교급을 바꾸면 **학교와 학년을 비운다** — 다른 급의 학교가 남아 있으면 목록에 없는 값이
 * 고른 채로 저장되고, 중1 이 고등 학교에 붙는다. 학년도·학기·시험은 급과 무관하므로 남긴다.
 * @param state - 지금 상태
 * @param patch - 바꿀 값
 * @returns 새 상태
 */
export function applyScanMetaPatch(
  state: ScanMetaState,
  patch: Partial<ScanMetaValues>,
): ScanMetaState {
  const { values, titleAuto } = state;
  const levelChanged = patch.level !== undefined && patch.level !== values.level;
  const cleared: Partial<ScanMetaValues> = levelChanged
    ? { schoolId: '', schoolName: '', grade: UNSPECIFIED_OPTION }
    : {};

  const nextAuto = patch.title === undefined ? titleAuto : patch.title.trim() === '';
  const merged: ScanMetaValues = { ...values, ...cleared, ...patch };

  return {
    values: nextAuto ? { ...merged, title: suggestScanTitle(merged) } : merged,
    titleAuto: nextAuto,
  };
}

/**
 * 그 학교급에서 고를 수 있는 학교.
 *
 * 마스터에 짝이 없는 **옛 항목**(`level` 이 비어 있다)은 양쪽에 모두 둔다 — 그 학교로
 * 만들어 둔 프린트가 남아 있는데 어느 급에서도 안 보이면 이어서 올릴 수가 없다
 * (`mergeSchoolOptions` 가 옛 항목을 지키는 것과 같은 근거).
 * @param schools - 고를 수 있는 학교 전부
 * @param level - 학교급
 * @returns 그 급의 학교 + 옛 항목
 */
export function schoolsForLevel(
  schools: readonly SelectableSchool[],
  level: SchoolLevel,
): SelectableSchool[] {
  return schools.filter((s) => !s.level || s.level === level);
}

/**
 * 그 학교급의 학년 선택지 (+ '미지정').
 * @param level - 학교급
 * @returns 학년 표시값 목록
 */
export function gradeOptionsForScan(level: SchoolLevel): string[] {
  return gradeOptionsForLevel(level);
}

/**
 * 학기 선택지 (+ 맨 앞 '미지정').
 * @returns 학기 표시값 목록
 */
export function semesterOptionsForScan(): string[] {
  return [UNSPECIFIED_OPTION, ...SEMESTER_OPTIONS];
}

/**
 * 시험 구분 선택지 (+ 맨 앞 '미지정').
 * @returns 시험 표시값 목록
 */
export function examTypeOptionsForScan(): string[] {
  return [UNSPECIFIED_OPTION, ...EXAM_TYPE_OPTIONS];
}

/**
 * 읽기를 시작해도 되는지 — 스캔 쪽 검사.
 *
 * 이름이 아니라 **id** 를 요구한다. 마스터에는 이름 UNIQUE 가 없어 이름으로 id 를 되찾으면
 * 동명 학교가 생기는 순간 조용히 엉뚱한 학교에 붙고, id 가 비면 시험지는 만들어지는데
 * `ensureSchoolMaterial` 이 아무것도 못 해 카테고리 트리에서만 사라진다.
 * @param values - 지금 고른 값
 * @returns 오류 (없으면 빈 객체)
 */
export function validateScanMeta(values: ScanMetaValues): { school?: string } {
  return values.schoolId ? {} : { school: '학교를 골라 주세요.' };
}

/**
 * 저장되는 프린트 이름 — **스캔 제목 + 프린트별 이름**.
 *
 * 이 값 하나가 `print_bundles.name` → `concept_sheets.unit`(시험지 제목·카테고리) →
 * `school_materials.name`(카테고리 트리 잎) → 단어 카테고리까지 그대로 흐른다.
 * 그래서 합치는 자리를 한 곳으로 둔다 — 화면마다 따로 이으면 저장된 이름과 미리보기가 갈라진다.
 *
 * 프린트별 이름은 **비워도 된다**(한 장짜리 스캔). 그때는 스캔 제목이 곧 프린트 이름이다.
 * @param scanTitle - 스캔 제목
 * @param label - 프린트별 이름 (비울 수 있다)
 * @returns 정규화된 이름. 둘 다 비었으면 빈 문자열
 */
export function composePrintName(scanTitle: string, label: string): string {
  const parts = [scanTitle, label].map((s) => s.trim()).filter(Boolean);
  return normalizeCategoryName(parts.join(' '));
}
