import { describe, expect, it } from 'vitest';
import {
  INTAKE_SOURCE_LABEL_MAX, intakeSourceLabel, parseReportTags, reportSourceInput, reportSourceLabel, reportTagLines,
} from './display';

const mock = {
  source_type: '모의고사', title: '2026학년도 수능 (언어와 매체)', school_name: '', year: '2026', grade: '고3',
  semester: '', exam_type: '수능', publisher: '',
};
const school = {
  source_type: '내신기출', title: '상현중 기출', school_name: '상현중', year: '2026', grade: '중2',
  semester: '1학기', exam_type: '중간', publisher: '',
};

describe('reportSourceLabel', () => {
  it('모의고사는 제목으로 — 저장된 줄(칸 이음)은 과목이 뭉개진다', () => {
    expect(reportSourceLabel(mock, '2026 고3 수능')).toBe('2026학년도 수능 (언어와 매체)');
  });

  it('내신은 카드와 같은 칸 이음', () => {
    expect(reportSourceLabel(school, null)).toBe('2026 중2 상현중 1학기 중간');
  });

  it('스냅샷 출처를 못 읽으면 저장된 줄', () => {
    expect(reportSourceLabel(undefined, '2025 중1 압구정중학교 2학기 기말')).toBe('2025 중1 압구정중학교 2학기 기말');
    // 원본 출처가 없던 문항 — 칸이 전부 null 인 객체로 굳는다
    expect(reportSourceLabel({ source_type: null, title: null }, '저장된 줄')).toBe('저장된 줄');
    expect(reportSourceLabel({ source_type: '내신기출', title: null }, null)).toBe('');
    expect(reportSourceLabel(null, null)).toBe('');
  });

  it('입력은 모르는 유형·배열을 거른다', () => {
    expect(reportSourceInput({ ...school, source_type: '엉뚱' })).toBeNull();
    expect(reportSourceInput([school])).toBeNull();
    expect(reportSourceInput({ ...school, year: 2026 })?.year).toBe('');
  });
});

describe('신고 때의 태그', () => {
  it('객체가 아니면 null, 칸은 글 목록만 남긴다', () => {
    expect(parseReportTags(null)).toBeNull();
    expect(parseReportTags([])).toBeNull();
    expect(parseReportTags({ work_titles: ['동백꽃', '', 3], unit_path: 'x' })).toEqual({
      work_titles: ['동백꽃'], unit_path: [], area_path: [], grammar_paths: [],
    });
  });

  it('줄은 값이 있는 것만, 작품 · 단원 · 영역 · 문법 차례', () => {
    expect(reportTagLines({
      work_titles: ['동백꽃', '봄봄'], unit_path: ['1. 문학', '(1) 동백꽃'], area_path: [],
      grammar_paths: ['단어 > 품사 > 명사', '문장 > 문장 성분'],
    })).toEqual([
      { label: '작품', value: '동백꽃, 봄봄' },
      { label: '단원', value: '1. 문학 > (1) 동백꽃' },
      { label: '문법', value: '단어 > 품사 > 명사, 문장 > 문장 성분' },
    ]);
    expect(reportTagLines({ work_titles: [], unit_path: [], area_path: [], grammar_paths: [] })).toEqual([]);
  });
});

describe('intakeSourceLabel', () => {
  it('짧으면 원래 번호를 붙인 그대로', () => {
    expect(intakeSourceLabel('2026 중2 상현중 1학기 중간', 17)).toBe('2026 중2 상현중 1학기 중간 · 원래 17번');
    expect(intakeSourceLabel('', 3)).toBe('원래 3번');
    expect(intakeSourceLabel('제목', null)).toBe('제목');
  });

  it('길면 앞 출처만 줄이고 원래 번호 꼬리는 지킨다(인테이크 상한 안)', () => {
    const title = '가'.repeat(120);
    const out = intakeSourceLabel(title, 35);
    expect(out.length).toBe(INTAKE_SOURCE_LABEL_MAX);
    expect(out.endsWith('… · 원래 35번')).toBe(true);
    const noNumber = intakeSourceLabel(title, null);
    expect(noNumber.length).toBe(INTAKE_SOURCE_LABEL_MAX);
    expect(noNumber.endsWith('…')).toBe(true);
  });
});
