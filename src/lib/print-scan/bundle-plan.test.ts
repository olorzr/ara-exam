import { describe, it, expect } from 'vitest';
import { categoryNaturalKey } from '@/lib/category-key';
import { EXTERNAL_LEVEL } from '@/lib/constants';
import { UNSPECIFIED_OPTION } from '@/lib/external-category';
import type { BundleDraft, PageAssignment } from './bundles';
import type { ScanMetaValues } from './scan-meta';
import {
  bundleBatches, bundleSheetCategory, bundleWordsCategory, printRunConfirmMessage,
  toBundleInsert, totalBatchCount, validateBundles,
} from './bundle-plan';

const draft = (over: Partial<BundleDraft> = {}): BundleDraft => ({
  localId: 'b1', name: '문학 프린트', includeHandwriting: false, registerWords: false, ...over,
});

const scan = (over: Partial<ScanMetaValues> = {}): ScanMetaValues => ({
  level: '중등', schoolId: 's1', schoolName: '상현중',
  year: '2026', grade: '중2', semester: '1학기', examType: '중간',
  title: '2026 상현중 중2 1학기 중간', ...over,
});

describe('validateBundles', () => {
  const map: PageAssignment = new Map([[1, 'b1']]);
  const title = '2026 상현중 중2 1학기 중간';

  it('다 채웠으면 오류가 없다', () => {
    expect(validateBundles([draft()], map, title)).toEqual({ byId: {} });
  });

  it('프린트별 이름을 비워도 된다 — 스캔 제목이 곧 프린트 이름이다(한 장짜리 스캔)', () => {
    expect(validateBundles([draft({ name: '  ' })], map, title)).toEqual({ byId: {} });
  });

  it('스캔 제목까지 비면 막는다 — 읽고 나서 저장이 막히면 ChatGPT 를 이미 쓴 뒤다', () => {
    const errors = validateBundles([draft({ name: '  ' })], map, '');
    expect(errors.byId.b1.name).toBeTruthy();
  });

  it('합친 이름이 겹치면 뒤 묶음을 짚는다 — 겹치면 트리에서 한 자리를 쓰고 제목도 같아진다', () => {
    const both: PageAssignment = new Map([[1, 'b1'], [2, 'b2']]);
    const errors = validateBundles(
      [draft({ name: '' }), draft({ localId: 'b2', name: '' })], both, title,
    );
    expect(errors.byId.b1).toBeUndefined();
    expect(errors.byId.b2.name).toContain('같은 이름');
  });

  it('쪽이 하나도 없는 묶음을 짚어 준다', () => {
    const errors = validateBundles([draft(), draft({ localId: 'b2', name: '독서' })], map, title);
    expect(errors.byId.b2.pages).toBeTruthy();
    expect(errors.byId.b1).toBeUndefined();
  });

  it('묶음이 없거나 고른 쪽이 없으면 전체 오류다', () => {
    expect(validateBundles([], new Map(), title).general).toBeTruthy();
    expect(validateBundles([draft()], new Map(), title).general).toBeTruthy();
  });
});

describe('읽기 횟수', () => {
  it('묶음 안에서 3쪽씩 나누고 겹치지 않는다', () => {
    const map: PageAssignment = new Map([[1, 'b1'], [2, 'b1'], [3, 'b1'], [4, 'b1']]);
    expect(bundleBatches(map, 'b1')).toEqual([[1, 2, 3], [4]]);
  });

  it('묶음마다 따로 센다 — 묶음이 섞이면 안 되므로 한 번에 묶지 않는다', () => {
    const map: PageAssignment = new Map([[1, 'b1'], [2, 'b2']]);
    const bundles = [draft(), draft({ localId: 'b2' })];
    expect(totalBatchCount(bundles, map)).toBe(2);
  });

  it('확인 문구에 프린트 장수와 ChatGPT 횟수를 함께 적는다', () => {
    const message = printRunConfirmMessage({ pageCount: 7, bundleCount: 2, batchCount: 3 });
    expect(message).toContain('7쪽');
    expect(message).toContain('프린트 2장');
    expect(message).toContain('약 3번');
  });
});

describe('toBundleInsert', () => {
  const map: PageAssignment = new Map([[3, 'b1'], [1, 'b1']]);

  it('스캔 제목 뒤에 프린트별 이름을 붙이고, 정규화하고, 쪽을 정렬한다', () => {
    const row = toBundleInsert(draft({ name: '천재 (정호웅)  프린트' }), map, 'uuid-1', scan());
    expect(row.name).toBe('2026 상현중 중2 1학기 중간 천재(정호웅) 프린트');
    expect(row.pages).toEqual([1, 3]);
    expect(row.status).toBe('대기');
    expect(row.id).toBe('uuid-1');
  });

  it('학교·학년도·학년·학기·시험을 스캔에서 복사한다 — 화면은 한 번만 물었다', () => {
    const row = toBundleInsert(draft(), map, 'uuid-1', scan());
    expect(row.school_id).toBe('s1');
    expect(row.school_name).toBe('상현중');
    expect(row.year).toBe('2026');
    expect(row.grade).toBe('중2');
    expect(row.semester).toBe('1학기');
    expect(row.exam_type).toBe('중간');
  });

  it("'미지정' 표시값은 빈 문자열로 저장한다", () => {
    const row = toBundleInsert(draft(), map, 'uuid-1', scan({
      year: UNSPECIFIED_OPTION, grade: UNSPECIFIED_OPTION,
      semester: UNSPECIFIED_OPTION, examType: UNSPECIFIED_OPTION,
    }));
    expect(row.year).toBe('');
    expect(row.grade).toBe('');
    expect(row.semester).toBe('');
    expect(row.exam_type).toBe('');
  });

  it('학교를 안 골랐으면 school_id 는 null 이다 (FK 가 아니라 스냅샷이다)', () => {
    expect(toBundleInsert(draft(), map, 'u', scan({ schoolId: '' })).school_id).toBeNull();
  });

  it('손글씨·단어 등록은 묶음마다 다르다 — 초안에서 그대로 온다', () => {
    const row = toBundleInsert(
      draft({ includeHandwriting: true, registerWords: true }), map, 'u', scan(),
    );
    expect(row.include_handwriting).toBe(true);
    expect(row.register_words).toBe(true);
  });
});

describe('bundleSheetCategory', () => {
  it('프린트는 외부지문 레벨이고 프린트명이 단원이 된다', () => {
    const cat = bundleSheetCategory({
      name: '문학 프린트', school_name: '상현중', year: '2026', grade: '중2',
    });
    expect(cat.level).toBe(EXTERNAL_LEVEL);
    expect(cat.unit).toBe('문학 프린트');
    expect(cat.schoolName).toBe('상현중');
    expect(cat.publisher).toBe('');
    expect(cat.semester).toBe('');
  });
});

describe('bundleWordsCategory', () => {
  const bundle = {
    name: '천재 (정호웅) 프린트', school_name: '상현중', year: '2026', grade: '중2',
  };

  it('시험지와 **같은 자연키**를 낸다 — 어긋나면 시험지와 단어가 다른 폴더로 갈라진다', () => {
    const sheet = bundleSheetCategory(bundle);
    const words = bundleWordsCategory(bundle);
    expect(categoryNaturalKey({
      level: words.level,
      year: words.year,
      grade: words.grade,
      publisher: words.publisher,
      semester: words.semester,
      chapter: words.chapter,
      sub_chapter: words.subChapter,
      school_name: words.schoolName,
    })).toBe(categoryNaturalKey({
      level: sheet.level,
      year: sheet.year,
      grade: sheet.grade,
      publisher: sheet.publisher,
      semester: sheet.semester,
      chapter: sheet.unit,
      sub_chapter: sheet.subunit,
      school_name: sheet.schoolName,
    }));
  });

  it('프린트명이 chapter 로, 학교가 schoolName 으로 간다 (ensureCategoryId 가 쓰는 이름)', () => {
    const words = bundleWordsCategory(bundle);
    expect(words.level).toBe(EXTERNAL_LEVEL);
    expect(words.chapter).toBe('천재 (정호웅) 프린트');
    expect(words.subChapter).toBe('');
    expect(words.schoolName).toBe('상현중');
  });
});
