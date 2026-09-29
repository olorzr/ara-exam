import { normalizeCategoryName } from '@/lib/category-name';
import { toStoredValue } from '@/lib/external-category';
import { composePrintName, validateScanMeta, type ScanMetaValues } from './scan-meta';

/**
 * 직접 입력한 학교 프린트 시험지 (순수 함수, sql/56).
 *
 * 스캔을 읽지 않고 선생님이 편집기에 바로 친다 — 개념지를 만들 때와 같다.
 * 그래도 **스캔 한 건 + 묶음 한 장** 모양으로 저장한다(파일 없는 스캔, 쪽 없는 묶음).
 * 그래야 목록의 스캔 단위 묶기·지우기·카테고리 트리·편집 화면을 그대로 쓴다.
 *
 * 이름·저장값 규칙은 스캔 길과 **같은 함수**를 쓴다(`composePrintName`·`toStoredValue`) —
 * 따로 이으면 같은 프린트가 두 길에서 다른 이름이 되어 카테고리 트리가 갈라진다.
 */

/** 직접 입력 폼의 오류 */
export interface TypedSheetErrors {
  school?: string;
  name?: string;
}

/** 만들 스캔 행 (파일 없음) */
export interface TypedScanInsert {
  title: string;
  file_path: '';
  page_count: 0;
}

/** 만들 묶음 행 */
export interface TypedBundleInsert {
  id: string;
  scan_id: string;
  name: string;
  school_id: string | null;
  school_name: string;
  year: string;
  grade: string;
  semester: string;
  exam_type: string;
  source: 'typed';
  pages: number[];
  /** 읽을 것이 없으니 처음부터 '읽기완료' 다 — '대기' 면 목록이 '읽기' 단추를 내민다 */
  status: '읽기완료';
}

/**
 * 만들어도 되는지.
 *
 * 학교는 스캔 길과 같은 이유로 **id** 를 요구한다(`validateScanMeta`). 이름은 스캔 제목과
 * 프린트 이름을 이은 값이 비지 않아야 한다 — DB 가 빈 이름을 막고, 카테고리 트리의 잎이 된다.
 * @param meta - 학교·학년·시험 (표시값)
 * @param label - 프린트 이름 (작품·단원 등)
 * @returns 오류 (없으면 빈 객체)
 */
export function validateTypedSheet(meta: ScanMetaValues, label: string): TypedSheetErrors {
  const errors: TypedSheetErrors = { ...validateScanMeta(meta) };
  if (!composePrintName(meta.title, label)) errors.name = '프린트 이름을 적어 주세요.';
  return errors;
}

/**
 * 스캔 행 — 목록의 카드 제목이 된다.
 * @param meta - 학교·학년·시험 (표시값)
 * @param label - 프린트 이름
 * @returns insert 행
 */
export function toTypedScanInsert(meta: ScanMetaValues, label: string): TypedScanInsert {
  return { title: composePrintName(meta.title, label), file_path: '', page_count: 0 };
}

/**
 * 묶음 행 — 스캔 길의 `toBundleInsert` 와 같은 값 규칙이다.
 * @param meta - 학교·학년·시험 (표시값)
 * @param label - 프린트 이름
 * @param ids - 묶음·스캔 id (클라이언트가 만든다)
 * @returns insert 행
 */
export function toTypedBundleInsert(
  meta: ScanMetaValues,
  label: string,
  ids: { id: string; scanId: string },
): TypedBundleInsert {
  return {
    id: ids.id,
    scan_id: ids.scanId,
    name: composePrintName(meta.title, label),
    school_id: meta.schoolId || null,
    school_name: normalizeCategoryName(meta.schoolName),
    year: toStoredValue(meta.year),
    grade: toStoredValue(meta.grade),
    semester: toStoredValue(meta.semester),
    exam_type: toStoredValue(meta.examType),
    source: 'typed',
    pages: [],
    status: '읽기완료',
  };
}

/**
 * 직접 입력한 묶음인가 — 원본 쪽·읽기·단어 등록·문답이 없다.
 * @param bundle - 묶음 (옛 행은 source 가 없을 수 있다 — 그러면 스캔이다)
 * @returns 직접 입력이면 true
 */
export function isTypedBundle(bundle: { source?: string | null }): boolean {
  return bundle.source === 'typed';
}
