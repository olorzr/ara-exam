import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INTAKE_SOURCE_LABEL_MAX, REPORT_INVISIBLE_CHARS, REPORT_SPACE_RUNS, categoryShowsState, normalizeReportText, intakeSourceLabel, reportSourceFields, sliceUnits, parseReportState, parseReportTags, reportSourceInput, reportSourceLabel, reportTagGroups,
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

  it('갈래는 값이 있는 것만, 작품 · 단원 · 영역 · 문법 차례 — 값은 낱낱이(이어 붙이지 않는다)', () => {
    expect(reportTagGroups({
      work_titles: ['동백꽃', '봄봄'], unit_path: ['1. 문학', '(1) 동백꽃'], area_path: [],
      grammar_paths: ['단어 > 품사 > 명사'],
    })).toEqual([
      { label: '작품', values: ['동백꽃', '봄봄'], path: false },
      { label: '단원', values: ['1. 문학', '(1) 동백꽃'], path: true },
      { label: '문법', values: ['단어 > 품사 > 명사'], path: false },
    ]);
    expect(reportTagGroups({ work_titles: [], unit_path: [], area_path: [], grammar_paths: [] })).toEqual([]);
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
    // 끝의 과목 꼬리는 지킨다 — 같은 시험의 화작·언매가 같은 글이 되지 않게
    const mockTitle = `${'2026학년도 대학수학능력시험 국어영역 '.repeat(3)}(언어와 매체)`;
    const withSection = intakeSourceLabel(mockTitle, 35);
    expect(withSection.length).toBeLessThanOrEqual(INTAKE_SOURCE_LABEL_MAX);
    expect(withSection.endsWith('… (언어와 매체) · 원래 35번')).toBe(true);
    expect(intakeSourceLabel(mockTitle.replace('언어와 매체', '화법과 작문'), 35)).not.toBe(withSection);
    // 꼬리가 너무 길어 앞이 안 남으면 꼬리를 포기한다
    const longSection = `시험 (${'가'.repeat(80)})`;
    expect(intakeSourceLabel(longSection, 3).startsWith('시험 (')).toBe(true);
    const noNumber = intakeSourceLabel(title, null);
    expect(noNumber.length).toBe(INTAKE_SOURCE_LABEL_MAX);
    expect(noNumber.endsWith('…')).toBe(true);
  });
});

describe('지금 상태', () => {
  it('태그·지문이 있어야 읽는다', () => {
    const state = parseReportState({ tags: { work_titles: ['동백꽃'] }, source: school, number: 17, token: 'abc' });
    expect(state?.token).toBe('abc');
    expect(state?.number).toBe(17);
    expect(state?.tags?.work_titles).toEqual(['동백꽃']);
    expect(reportSourceInput(state?.source)?.school_name).toBe('상현중');
    expect(parseReportState({ tags: {}, token: '' })).toBeNull();
    // 원본이 지워진 문제지 항목 — 태그는 없고 출처·번호는 있다
    expect(parseReportState({ tags: null, source: school, number: '3', token: 'abc' })).toMatchObject({ tags: null, number: null });
    expect(parseReportState(null)).toBeNull();
  });

  it('태그·출처 신고만 지금 상태를 보여 주고 지문을 싣는다', () => {
    expect(categoryShowsState('tag')).toBe(true);
    expect(categoryShowsState('source')).toBe(true);
    expect(categoryShowsState('answer')).toBe(false);
    expect(categoryShowsState('')).toBe(false);
  });
});

describe('글자 경계 자르기', () => {
  it('보충 평면 글자(이모지)를 반으로 가르지 않는다', () => {
    expect(sliceUnits('가😀나', 2)).toBe('가');
    expect(sliceUnits('가😀나', 3)).toBe('가😀');
    const out = intakeSourceLabel(`${'가'.repeat(60)}😀${'나'.repeat(40)}`, 3);
    expect(out.length).toBeLessThanOrEqual(INTAKE_SOURCE_LABEL_MAX);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out)).toBe(false);
  });
});

describe('reportSourceFields', () => {
  it('출처의 칸을 이름표와 함께 낱낱이(빈 칸은 뺀다), 객체가 아니면 null', () => {
    expect(reportSourceFields(mock)).toEqual([
      { label: '유형', value: '모의고사' }, { label: '제목', value: '2026학년도 수능 (언어와 매체)' },
      { label: '학년도', value: '2026' }, { label: '학년', value: '고3' }, { label: '시험', value: '수능' },
    ]);
    expect(reportSourceFields({ ...mock, school_name: '서울시교육청' })).not.toEqual(reportSourceFields({ ...mock, publisher: '서울시교육청' }));
    expect(reportSourceFields({ source_type: '엉뚱', title: '제목' })).toEqual([{ label: '유형', value: '엉뚱' }, { label: '제목', value: '제목' }]);
    expect(reportSourceFields({})).toEqual([]);
    expect(reportSourceFields(null)).toBeNull();
  });
});

describe('normalizeReportText — sql/114 와 같은 규칙', () => {
  it('보이지 않는 글자·NBSP·풀어 쓴 한글·탭/줄바꿈을 화면과 같게 접는다', () => {
    expect(normalizeReportText('\uFEFF')).toBe('');
    expect(normalizeReportText('가\u200B나')).toBe('가나');
    expect(normalizeReportText('수\u00A0능')).toBe('수 능');
    expect(normalizeReportText('\t수\n\n능\u3000')).toBe('수 능');
    expect(normalizeReportText('한글'.normalize('NFD'))).toBe('한글');
    // 이모지 잇기(ZWJ)는 남긴다 — 보이는 모양을 바꾼다
    expect(normalizeReportText('👨\u200D👩')).toBe('👨\u200D👩');
  });

  it('출처 칸·태그 목록이 이 규칙으로 읽힌다(빈 출판사 = BOM 만 든 출판사)', () => {
    expect(reportSourceFields({ publisher: '\uFEFF', title: '수\u00A0능' })).toEqual([{ label: '제목', value: '수 능' }]);
    expect(parseReportTags({ work_titles: ['\uFEFF', '동백꽃\u200B'] })?.work_titles).toEqual(['동백꽃']);
  });

  it('두 정규식은 sql/114 의 problem_report_norm_text 와 글자 그대로 같다', () => {
    const sql = readFileSync(join(process.cwd(), 'sql/114_problem_report_tag_source_categories.sql'), 'utf8');
    const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION exam.problem_report_norm_text'));
    const body = fn.slice(0, fn.indexOf('$$;'));
    expect(body).toContain(`'${REPORT_INVISIBLE_CHARS.source}', ''`);
    expect(body).toContain(`'${REPORT_SPACE_RUNS.source}', ' '`);
    expect(body).toContain('NFC');
  });
});
