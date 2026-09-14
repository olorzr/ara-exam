import { describe, it, expect } from 'vitest';
import { categoryNaturalKey } from '@/lib/category-key';
import { EXTERNAL_LEVEL } from '@/lib/constants';
import { UNSPECIFIED_OPTION } from '@/lib/external-category';
import type { BundleDraft, PageAssignment } from './bundles';
import {
  bundleBatches, bundleSheetCategory, bundleWordsCategory, printRunConfirmMessage,
  toBundleInsert, totalBatchCount, validateBundles,
} from './bundle-plan';

const draft = (over: Partial<BundleDraft> = {}): BundleDraft => ({
  localId: 'b1', name: '문학 프린트', schoolId: 's1', schoolName: '상현중',
  year: '2026', grade: '중2', includeHandwriting: false, registerWords: false, ...over,
});

describe('validateBundles', () => {
  const map: PageAssignment = new Map([[1, 'b1']]);

  it('다 채웠으면 오류가 없다', () => {
    expect(validateBundles([draft()], map)).toEqual({ byId: {} });
  });

  it('프린트명·학교가 비면 막는다 — 읽고 나서 저장이 막히면 ChatGPT 를 이미 쓴 뒤다', () => {
    const errors = validateBundles([draft({ name: '  ', schoolId: '', schoolName: '' })], map);
    expect(errors.byId.b1.name).toBeTruthy();
    expect(errors.byId.b1.school).toBeTruthy();
  });

  it('학교 이름만 있고 id 가 없으면 막는다 — 그 상태로 저장하면 카테고리 트리에 안 올라간다', () => {
    // 학교 거울(exam.schools)과 프린트 마스터가 id 로 붙는다. 이름만 남은 묶음은
    // 시험지는 멀쩡히 만들어지는데 `ensureSchoolMaterial` 이 아무것도 못 한다.
    const errors = validateBundles([draft({ schoolId: '', schoolName: '상현중학교' })], map);
    expect(errors.byId.b1.school).toBeTruthy();
  });

  it('쪽이 하나도 없는 묶음을 짚어 준다', () => {
    const errors = validateBundles([draft(), draft({ localId: 'b2' })], map);
    expect(errors.byId.b2.pages).toBeTruthy();
    expect(errors.byId.b1).toBeUndefined();
  });

  it('묶음이 없거나 고른 쪽이 없으면 전체 오류다', () => {
    expect(validateBundles([], new Map()).general).toBeTruthy();
    expect(validateBundles([draft()], new Map()).general).toBeTruthy();
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

  it('이름을 정규화하고 쪽을 정렬한다', () => {
    const row = toBundleInsert(draft({ name: '천재 (정호웅)  프린트' }), map, 'uuid-1');
    expect(row.name).toBe('천재(정호웅) 프린트');
    expect(row.pages).toEqual([1, 3]);
    expect(row.status).toBe('대기');
    expect(row.id).toBe('uuid-1');
  });

  it("'미지정' 표시값은 빈 문자열로 저장한다", () => {
    const row = toBundleInsert(
      draft({ year: UNSPECIFIED_OPTION, grade: UNSPECIFIED_OPTION }), map, 'uuid-1',
    );
    expect(row.year).toBe('');
    expect(row.grade).toBe('');
  });

  it('학교를 안 골랐으면 school_id 는 null 이다 (FK 가 아니라 스냅샷이다)', () => {
    expect(toBundleInsert(draft({ schoolId: '' }), map, 'u').school_id).toBeNull();
  });

  it('단어 등록 여부를 그대로 싣는다 — 읽기가 끝난 뒤 이 값으로 단어 단계를 돈다', () => {
    expect(toBundleInsert(draft(), map, 'u').register_words).toBe(false);
    expect(toBundleInsert(draft({ registerWords: true }), map, 'u').register_words).toBe(true);
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
