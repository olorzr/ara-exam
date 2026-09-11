import { describe, it, expect } from 'vitest';
import {
  applySourcePatch,
  applyTextbookHint,
  initialSourceFormState,
  gradeOptionsForLevel,
  levelFromGrade,
  requiresSchool,
  suggestTitle,
  toSourcePayload,
  validateSourceForm,
  visibleFields,
  type SourceFormState,
  type SourceFormValues,
} from './source-form';
import { UNSPECIFIED_OPTION } from '@/lib/external-category';

function values(over: Partial<SourceFormValues> = {}): SourceFormValues {
  return {
    source_type: '내신기출', level: '중등', title: '상현중 중간고사', school_name: '상현중',
    school_id: 'school-uuid', textbook: '', year: '2026', grade: '중2',
    semester: '1학기', exam_type: '중간', publisher: '',
    ...over,
  };
}

function state(
  v: SourceFormValues = values(),
  over: Partial<SourceFormState> = {},
): SourceFormState {
  return { ...initialSourceFormState(v), ...over };
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

describe('toSourcePayload — 새 컬럼', () => {
  it('학교 id 와 교과서를 함께 담는다', () => {
    const p = toSourcePayload(values({ textbook: '천재 (노미숙)' }));
    expect(p.school_id).toBe('school-uuid');
    expect(p.textbook).toBe('천재(노미숙)');
  });

  it('학교를 손으로 고르지 않았으면 school_id 는 null 이다 — 빈 문자열은 uuid 가 아니다', () => {
    expect(toSourcePayload(values({ school_id: '' })).school_id).toBeNull();
  });

  it('학교급은 저장하지 않는다 — 학년에서 파생한다', () => {
    expect(Object.keys(toSourcePayload(values()))).not.toContain('level');
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

describe('gradeOptionsForLevel / levelFromGrade', () => {
  it('학교급을 고르면 그 급의 학년만 보인다', () => {
    expect(gradeOptionsForLevel('중등')).toEqual(['중1', '중2', '중3', UNSPECIFIED_OPTION]);
    expect(gradeOptionsForLevel('고등')).toEqual(['고1', '고2', '고3', UNSPECIFIED_OPTION]);
  });

  it('학년에서 학교급을 되찾는다 — DB 에는 학교급 컬럼이 없다', () => {
    expect(levelFromGrade('중2')).toBe('중등');
    expect(levelFromGrade('고1')).toBe('고등');
    expect(levelFromGrade('')).toBeNull();
  });
});

describe('applySourcePatch — 제목 자동 채움', () => {
  it('안 건드린 제목은 고른 값을 따라간다 — 버튼을 안 눌러도 채워진다', () => {
    const start = state(values({ title: '', year: '2026', school_name: '', grade: '', semester: '', exam_type: '' }));
    const first = applySourcePatch(start, { school_name: '상현중' });
    expect(first.values.title).toBe('2026 상현중');
    const second = applySourcePatch(first, { grade: '중2' });
    expect(second.values.title).toBe('2026 상현중 중2');
  });

  it('직접 친 제목은 다른 칸을 바꿔도 그대로다', () => {
    const typed = applySourcePatch(state(values({ title: '' })), { title: '내가 쓴 제목' });
    expect(typed.titleAuto).toBe(false);
    expect(applySourcePatch(typed, { grade: '중3' }).values.title).toBe('내가 쓴 제목');
  });

  it('제목을 비우면 다시 자동으로 돌아간다', () => {
    const typed = applySourcePatch(state(), { title: '손으로' });
    const cleared = applySourcePatch(typed, { title: '' });
    expect(cleared.titleAuto).toBe(true);
    expect(cleared.values.title).toBe('2026 상현중 중2 1학기 중간');
  });

  it('학교급을 바꾸면 학교·학년·교과서를 비운다 — 다른 급 학교가 남으면 안 된다', () => {
    const next = applySourcePatch(state(values({ textbook: '천재(노미숙)' })), { level: '고등' });
    expect(next.values.school_id).toBe('');
    expect(next.values.school_name).toBe('');
    expect(next.values.grade).toBe('');
    expect(next.values.textbook).toBe('');
    expect(next.values.level).toBe('고등');
  });

  it('같은 학교급을 다시 고르면 아무것도 비우지 않는다', () => {
    expect(applySourcePatch(state(), { level: '중등' }).values.school_name).toBe('상현중');
  });
});

describe('applySourcePatch — 교과서 자동 채움', () => {
  it('학교를 바꾸면 교과서를 비운다 — 옛 학교 교과서가 남으면 힌트가 물러난다', () => {
    const start = state(values({ textbook: '천재(노미숙)' }), { textbookAuto: false });
    const next = applySourcePatch(start, { school_id: 'other-uuid', school_name: '수지중' });
    expect(next.values.textbook).toBe('');
    expect(next.textbookAuto).toBe(true);
  });

  it('같은 학교를 다시 고르면 교과서를 비우지 않는다', () => {
    const start = state(values({ textbook: '천재(노미숙)' }));
    expect(applySourcePatch(start, { school_id: 'school-uuid' }).values.textbook).toBe('천재(노미숙)');
  });

  it('교과서를 직접 고르면 자동이 꺼진다', () => {
    expect(applySourcePatch(state(), { textbook: '동아' }).textbookAuto).toBe(false);
  });

  it("'미지정'도 직접 고른 값이라 자동을 끈다 — 다시 켜면 힌트가 곧바로 되돌려 놓는다", () => {
    const picked = applySourcePatch(state(), { textbook: '동아' });
    const cleared = applySourcePatch(picked, { textbook: '' });
    expect(cleared.textbookAuto).toBe(false);
    expect(applyTextbookHint(cleared, '천재(노미숙)')).toBe(cleared);
  });

  it('학교급을 바꾸면 교과서 자동이 다시 켜진다 — 칸도 함께 비우므로 덮을 것이 없다', () => {
    const picked = applySourcePatch(state(), { textbook: '동아' });
    expect(applySourcePatch(picked, { level: '고등' }).textbookAuto).toBe(true);
  });
});

describe('applyTextbookHint', () => {
  it('비어 있으면 힌트로 채운다', () => {
    const next = applyTextbookHint(state(), '천재(노미숙)');
    expect(next.values.textbook).toBe('천재(노미숙)');
    expect(next.textbookAuto).toBe(true);
  });

  it('직접 고른 교과서는 힌트가 덮지 않는다 — 같은 칸을 두 번 고치게 된다', () => {
    const picked = applySourcePatch(state(), { textbook: '동아' });
    expect(applyTextbookHint(picked, '천재(노미숙)')).toBe(picked);
  });

  it('자동으로 채운 값은 다음 힌트가 바꾼다 — 학년을 바꾸면 그 학년 책이어야 한다', () => {
    const filled = applyTextbookHint(state(), '천재(노미숙)');
    expect(applyTextbookHint(filled, '동아').values.textbook).toBe('동아');
  });

  it('새 조건에 교과서가 없으면 자동으로 채운 값을 비운다 — 칸과 안내가 어긋나면 안 된다', () => {
    const filled = applyTextbookHint(state(), '천재(노미숙)');
    expect(applyTextbookHint(filled, null).values.textbook).toBe('');
  });

  it('힌트로 채워도 제목 자동 채움은 건드리지 않는다', () => {
    const typed = applySourcePatch(state(values({ title: '' })), { title: '내가 쓴 제목' });
    const filled = applyTextbookHint(typed, '천재(노미숙)');
    expect(filled.titleAuto).toBe(false);
    expect(filled.values.title).toBe('내가 쓴 제목');
  });

  it('바뀐 게 없으면 같은 객체를 돌려준다 — StrictMode 는 효과를 두 번 돌린다', () => {
    const filled = applyTextbookHint(state(), '천재(노미숙)');
    expect(applyTextbookHint(filled, '천재(노미숙)')).toBe(filled);
    const empty = state();
    expect(applyTextbookHint(empty, null)).toBe(empty);
  });
});
