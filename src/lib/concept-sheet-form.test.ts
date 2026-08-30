import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONCEPT_CATEGORY,
  buildConceptSheetPayload,
  generateConceptTitle,
  isCategoryIncomplete,
} from './concept-sheet-form';
import { EXTERNAL_LEVEL } from './constants';
import type { BuilderCategory } from '@/components/exam-builder';

const cat = (overrides: Partial<BuilderCategory> = {}): BuilderCategory => ({
  ...DEFAULT_CONCEPT_CATEGORY,
  ...overrides,
});

const middle = cat({ grade: '중1', publisher: '천재(정호웅)', semester: '1학기', unit: '1단원' });
const external = cat({ level: EXTERNAL_LEVEL, schoolName: '상현중학교', year: '2026', grade: '중2', unit: '소나기' });

describe('generateConceptTitle', () => {
  it('중등/고등은 학년·출판사·학기·단원을 이어 붙인다', () => {
    expect(generateConceptTitle(middle)).toBe('중1 천재(정호웅) 1학기 1단원 개념지');
  });

  it('소단원이 있으면 뒤에 붙인다', () => {
    expect(generateConceptTitle({ ...middle, subunit: '소나기' }))
      .toBe('중1 천재(정호웅) 1학기 1단원 소나기 개념지');
  });

  it('외부지문은 학교명·년도를 쓰고 출판사·학기는 쓰지 않는다', () => {
    expect(generateConceptTitle(external)).toBe('상현중학교 2026 중2 소나기 개념지');
    expect(generateConceptTitle({ ...external, publisher: '무시됨', semester: '2학기' }))
      .toBe('상현중학교 2026 중2 소나기 개념지');
  });

  it('빈 값은 건너뛴다 (공백만 남지 않는다)', () => {
    expect(generateConceptTitle(cat({ grade: '중1', unit: '1단원' }))).toBe('중1 1단원 개념지');
  });

  it('채워진 값이 하나도 없으면 빈 문자열', () => {
    expect(generateConceptTitle(DEFAULT_CONCEPT_CATEGORY)).toBe('');
  });
});

describe('isCategoryIncomplete', () => {
  it('중등/고등은 학년·출판사·단원이 모두 있어야 통과한다', () => {
    expect(isCategoryIncomplete(middle)).toBe(false);
    expect(isCategoryIncomplete({ ...middle, grade: '' })).toBe(true);
    expect(isCategoryIncomplete({ ...middle, publisher: '' })).toBe(true);
    expect(isCategoryIncomplete({ ...middle, unit: '' })).toBe(true);
  });

  it('중등/고등은 소단원·학기가 없어도 통과한다 (선택 항목)', () => {
    expect(isCategoryIncomplete({ ...middle, subunit: '', semester: '' })).toBe(false);
  });

  it('외부지문은 출판사가 없어도 통과한다 — 항상 빈 값이라 요구하면 저장이 막힌다', () => {
    expect(external.publisher).toBe('');
    expect(isCategoryIncomplete(external)).toBe(false);
  });

  it('외부지문은 학교명·단원이 필수다', () => {
    expect(isCategoryIncomplete({ ...external, schoolName: '' })).toBe(true);
    expect(isCategoryIncomplete({ ...external, unit: '' })).toBe(true);
  });

  it('unit 이 비면 막는다 — 통과시키면 인쇄 제목이 공백만 남는다', () => {
    expect(isCategoryIncomplete({ ...middle, unit: '' })).toBe(true);
    expect(isCategoryIncomplete({ ...external, unit: '' })).toBe(true);
  });
});

describe('buildConceptSheetPayload', () => {
  const base = { title: '제목', category: middle, html: '<p>본문</p>', marks: [] };

  it('이름 필드를 표준 표기로 정규화한다', () => {
    const payload = buildConceptSheetPayload({
      ...base,
      category: cat({
        grade: '중1',
        publisher: '천재 (정호웅)',
        unit: '1. 문학 ( 상 )',
        subunit: '소나기　(황순원)',
        schoolName: '상현 (중)',
      }),
    });
    expect(payload.publisher).toBe('천재(정호웅)');
    expect(payload.unit).toBe('1. 문학(상)');
    expect(payload.subunit).toBe('소나기(황순원)');
    expect(payload.school_name).toBe('상현(중)');
  });

  it('level·year·grade·semester 는 Select 고정값이라 그대로 넘긴다', () => {
    const payload = buildConceptSheetPayload({ ...base, category: external });
    expect(payload.level).toBe(EXTERNAL_LEVEL);
    expect(payload.year).toBe('2026');
    expect(payload.grade).toBe('중2');
  });

  it('제목의 앞뒤 공백을 자른다', () => {
    expect(buildConceptSheetPayload({ ...base, title: '  개념지  ' }).title).toBe('개념지');
  });

  it('제목이 비거나 공백뿐이면 "제목 없음" 으로 저장한다', () => {
    expect(buildConceptSheetPayload({ ...base, title: '' }).title).toBe('제목 없음');
    expect(buildConceptSheetPayload({ ...base, title: '   ' }).title).toBe('제목 없음');
  });

  it('html 과 marks 는 그대로 전달한다 (sanitize 는 호출부 책임)', () => {
    const marks = [{ text: '은유', pos: 3, len: 2 }];
    const payload = buildConceptSheetPayload({ ...base, html: '<p>x</p>', marks });
    expect(payload.editor_html).toBe('<p>x</p>');
    expect(payload.marks).toEqual(marks);
  });
});
