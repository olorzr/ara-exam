import { describe, it, expect } from 'vitest';
import {
  applySourceHint, applySourcePatch, emptySourceFormValues, initialSourceFormState,
  type SourceFormState,
} from './source-form-state';
import type { SourceFormValues } from './source-form';

function values(over: Partial<SourceFormValues> = {}): SourceFormValues {
  return {
    source_type: '내신기출', level: '중등', title: '상현중 중간고사', school_name: '상현중',
    school_id: 'school-uuid', textbook: '', year: '2026', grade: '중2',
    semester: '1학기', exam_type: '중간', publisher: '', works: '',
    ...over,
  };
}

function state(
  v: SourceFormValues = values(),
  over: Partial<SourceFormState> = {},
): SourceFormState {
  return { ...initialSourceFormState(v), ...over };
}

describe('emptySourceFormValues', () => {
  it('학년도만 채우고 나머지는 비운다', () => {
    const v = emptySourceFormValues();
    expect(v.year).toMatch(/^\d{4}$/);
    expect(v.title).toBe('');
    expect(v.works).toBe('');
    expect(v.source_type).toBe('내신기출');
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

  it('학교급을 바꾸면 학교·학년·교과서·작품을 비운다 — 다른 급 학교가 남으면 안 된다', () => {
    const start = state(values({ textbook: '천재(노미숙)', works: '동백꽃' }));
    const next = applySourcePatch(start, { level: '고등' });
    expect(next.values.school_id).toBe('');
    expect(next.values.school_name).toBe('');
    expect(next.values.grade).toBe('');
    expect(next.values.textbook).toBe('');
    expect(next.values.works).toBe('');
    expect(next.values.level).toBe('고등');
  });

  it('같은 학교급을 다시 고르면 아무것도 비우지 않습니다', () => {
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
    expect(applySourceHint(cleared, { textbook: '천재(노미숙)' })).toBe(cleared);
  });

  it('학교급을 바꾸면 교과서 자동이 다시 켜진다 — 칸도 함께 비우므로 덮을 것이 없다', () => {
    const picked = applySourcePatch(state(), { textbook: '동아' });
    expect(applySourcePatch(picked, { level: '고등' }).textbookAuto).toBe(true);
  });
});

describe('applySourcePatch — 작품 자동 채움', () => {
  it('작품을 직접 치면 자동이 꺼진다', () => {
    expect(applySourcePatch(state(), { works: '봄봄' }).worksAuto).toBe(false);
  });

  it('작품 칸을 비우는 것도 직접 고른 값이다 — "작품 없음" 을 말할 수 있어야 한다', () => {
    const typed = applySourcePatch(state(), { works: '봄봄' });
    const cleared = applySourcePatch(typed, { works: '' });
    expect(cleared.worksAuto).toBe(false);
    expect(applySourceHint(cleared, { works: '홍길동전' })).toBe(cleared);
  });

  it('학교급을 바꾸면 작품 자동이 다시 켜진다 — 칸도 함께 비우므로 덮을 것이 없다', () => {
    const cleared = applySourcePatch(applySourcePatch(state(), { works: '봄봄' }), { works: '' });
    expect(applySourcePatch(cleared, { level: '고등' }).worksAuto).toBe(true);
  });

  it('학교를 바꾸면 작품을 비운다 — 옛 학교 작품이 남으면 후보가 물러난다', () => {
    const start = state(values({ works: '동백꽃' }), { worksAuto: false });
    const next = applySourcePatch(start, { school_id: 'other-uuid', school_name: '수지중' });
    expect(next.values.works).toBe('');
    expect(next.worksAuto).toBe(true);
  });
});

describe('applySourceHint', () => {
  it('비어 있으면 교과서를 힌트로 채운다', () => {
    const next = applySourceHint(state(), { textbook: '천재(노미숙)' });
    expect(next.values.textbook).toBe('천재(노미숙)');
    expect(next.textbookAuto).toBe(true);
  });

  it('직접 고른 교과서는 힌트가 덮지 않는다 — 같은 칸을 두 번 고치게 된다', () => {
    const picked = applySourcePatch(state(), { textbook: '동아' });
    expect(applySourceHint(picked, { textbook: '천재(노미숙)' })).toBe(picked);
  });

  it('자동으로 채운 값은 다음 힌트가 바꾼다 — 학년을 바꾸면 그 학년 책이어야 한다', () => {
    const filled = applySourceHint(state(), { textbook: '천재(노미숙)' });
    expect(applySourceHint(filled, { textbook: '동아' }).values.textbook).toBe('동아');
  });

  it('새 조건에 교과서가 없으면 자동으로 채운 값을 비운다 — 칸과 안내가 어긋나면 안 된다', () => {
    const filled = applySourceHint(state(), { textbook: '천재(노미숙)' });
    expect(applySourceHint(filled, { textbook: null }).values.textbook).toBe('');
  });

  it('작품 후보로 칸을 채운다', () => {
    const next = applySourceHint(state(), { works: '홍길동전, 동백꽃 (김유정)' });
    expect(next.values.works).toBe('홍길동전, 동백꽃 (김유정)');
  });

  it('직접 친 작품은 후보가 덮지 않는다', () => {
    const typed = applySourcePatch(state(), { works: '내가 적은 작품' });
    expect(applySourceHint(typed, { works: '홍길동전' })).toBe(typed);
  });

  it('한 칸만 넘기면 다른 칸은 건드리지 않는다 — 교과서 힌트가 작품을 지우면 안 된다', () => {
    const filled = applySourceHint(state(), { works: '홍길동전' });
    const next = applySourceHint(filled, { textbook: '동아' });
    expect(next.values.works).toBe('홍길동전');
    expect(next.values.textbook).toBe('동아');
  });

  it('힌트로 채워도 제목 자동 채움은 건드리지 않는다', () => {
    const typed = applySourcePatch(state(values({ title: '' })), { title: '내가 쓴 제목' });
    const filled = applySourceHint(typed, { textbook: '천재(노미숙)' });
    expect(filled.titleAuto).toBe(false);
    expect(filled.values.title).toBe('내가 쓴 제목');
  });

  it('바뀐 게 없으면 같은 객체를 돌려준다 — StrictMode 는 효과를 두 번 돌린다', () => {
    const filled = applySourceHint(state(), { textbook: '천재(노미숙)' });
    expect(applySourceHint(filled, { textbook: '천재(노미숙)' })).toBe(filled);
    const empty = state();
    expect(applySourceHint(empty, { textbook: null })).toBe(empty);
    expect(applySourceHint(empty, { works: '' })).toBe(empty);
  });
});
