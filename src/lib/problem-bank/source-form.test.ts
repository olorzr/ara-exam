import { describe, it, expect } from 'vitest';
import {
  requiresSchool,
  suggestTitle,
  toSourcePayload,
  validateSourceForm,
  visibleFields,
  type SourceFormValues,
} from './source-form';
import { UNSPECIFIED_OPTION } from '@/lib/external-category';

function values(over: Partial<SourceFormValues> = {}): SourceFormValues {
  return {
    source_type: '내신기출', title: '상현중 중간고사', school_name: '상현중',
    year: '2026', grade: '중2', semester: '1학기', exam_type: '중간', publisher: '',
    ...over,
  };
}

describe('validateSourceForm', () => {
  it('정상 값은 오류가 없다', () => {
    expect(validateSourceForm(values())).toEqual({});
  });

  it('제목은 필수다', () => {
    expect(validateSourceForm(values({ title: '   ' })).title).toBeTruthy();
  });

  it('내신 기출은 학교가 필수다 — 없으면 나중에 아무도 못 찾는다', () => {
    expect(validateSourceForm(values({ school_name: '' })).school_name).toBeTruthy();
    expect(validateSourceForm(values({ school_name: UNSPECIFIED_OPTION })).school_name).toBeTruthy();
  });

  it('문제집은 학교가 없어도 된다', () => {
    const v = values({ source_type: '문제집', school_name: '', publisher: '천재' });
    expect(validateSourceForm(v).school_name).toBeUndefined();
  });

  it('학년도는 네 자리 숫자여야 한다', () => {
    expect(validateSourceForm(values({ year: '26' })).year).toBeTruthy();
    expect(validateSourceForm(values({ year: UNSPECIFIED_OPTION })).year).toBeUndefined();
  });
});

describe('toSourcePayload', () => {
  it("'미지정' 센티널을 빈 문자열로 되돌린다", () => {
    const p = toSourcePayload(values({ grade: UNSPECIFIED_OPTION, semester: UNSPECIFIED_OPTION }));
    expect(p.grade).toBe('');
    expect(p.semester).toBe('');
  });

  it('이름을 정규화한다 — 표기가 갈리면 필터가 둘로 쪼개진다', () => {
    const p = toSourcePayload(values({ school_name: '상현중 ', publisher: '천재 (정호웅)' }));
    expect(p.school_name).toBe('상현중');
    expect(p.publisher).toBe('천재(정호웅)');
  });

  it('user_id 를 넣지 않는다 — DB 트리거가 auth.uid() 로 채운다', () => {
    expect(Object.keys(toSourcePayload(values()))).not.toContain('user_id');
  });
});

describe('visibleFields / requiresSchool', () => {
  it('유형마다 묻는 것이 다르다', () => {
    expect(visibleFields('내신기출')).toContain('exam_type');
    expect(visibleFields('내신기출')).not.toContain('publisher');
    expect(visibleFields('문제집')).toContain('publisher');
    expect(visibleFields('문제집')).not.toContain('exam_type');
  });

  it('내신 기출만 학교가 필수다', () => {
    expect(requiresSchool('내신기출')).toBe(true);
    expect(requiresSchool('모의고사')).toBe(false);
  });
});

describe('suggestTitle', () => {
  it('고른 값으로 제목을 만들어 준다', () => {
    expect(suggestTitle(values())).toBe('2026 상현중 중2 1학기 중간');
  });

  it('학교가 없으면 출판사를 쓴다', () => {
    const v = values({ source_type: '모의고사', school_name: '', publisher: '교육청', semester: '', exam_type: '' });
    expect(suggestTitle(v)).toBe('2026 교육청 중2');
  });

  it('아무것도 안 골랐으면 빈 문자열', () => {
    const v = values({ year: '', school_name: '', grade: '', semester: '', exam_type: '', publisher: '' });
    expect(suggestTitle(v)).toBe('');
  });
});
