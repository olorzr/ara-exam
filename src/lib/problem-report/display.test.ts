import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REPORT_HTML_SPACE_RUNS, categoryShowsState, normalizeReportText, reportVisibleSegments, reportSourceFields, parseReportState, parseReportTags, reportSourceInput, reportSourceLabel, reportTagGroups,
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
  const ch = (cp: number) => String.fromCodePoint(cp);

  it('HTML 이 접는 공백만 접고, NFC 로 합친다', () => {
    expect(normalizeReportText(`${ch(9)}수${ch(10)}${ch(10)}능${ch(13)}  `)).toBe('수 능');
    expect(normalizeReportText('한글'.normalize('NFD'))).toBe('한글');
  });

  it('화면이 다르게 그리는 글자는 걷지 않는다 — BOM·NBSP·전각 공백·방향 제어', () => {
    expect(normalizeReportText(ch(0xfeff))).toBe(ch(0xfeff));
    expect(normalizeReportText(`수${ch(0xa0)}능`)).toBe(`수${ch(0xa0)}능`);
    expect(normalizeReportText(`수${ch(0x3000)}`)).toBe(`수${ch(0x3000)}`);
    const rtl = `2026 시험 ${ch(0x202e)}AB${ch(0x202c)}`;
    expect(normalizeReportText(rtl)).toBe(rtl);
  });

  it('옛한글 채움 글자는 그대로, 이모지 잇기·이체자 선택자·깃발 태그는 늘 드러낸다(글꼴 지원을 모른다)', () => {
    expect(reportVisibleSegments(`${ch(0x1100)}${ch(0x1160)}`)).toEqual([{ text: `${ch(0x1100)}${ch(0x1160)}`, hidden: false }]);
    expect(reportVisibleSegments(`${ch(0x1f468)}${ch(0x200d)}${ch(0x1f469)}`)).toEqual([
      { text: ch(0x1f468), hidden: false }, { text: 'U+200D', hidden: true }, { text: ch(0x1f469), hidden: false },
    ]);
    expect(reportVisibleSegments(`${ch(0x2764)}${ch(0xfe0f)}`)).toEqual([
      { text: ch(0x2764), hidden: false }, { text: 'U+FE0F', hidden: true },
    ]);
    expect(reportVisibleSegments(`${ch(0x1f3f4)}${ch(0xe0067)}`)).toEqual([
      { text: ch(0x1f3f4), hidden: false }, { text: 'U+E0067', hidden: true },
    ]);
  });

  it('기본 무시 글자(결합 글자 잇기)도 드러낸다', () => {
    expect(reportVisibleSegments(`가${ch(0x034f)}나`)).toEqual([
      { text: '가', hidden: false }, { text: 'U+034F', hidden: true }, { text: '나', hidden: false },
    ]);
  });

  it('창은 그런 글자를 U+XXXX 로 드러낸다(띄어쓰기는 그대로)', () => {
    expect(reportVisibleSegments(`2026 시험 ${ch(0x202e)}AB${ch(0x202c)}`)).toEqual([
      { text: '2026 시험 ', hidden: false }, { text: 'U+202E', hidden: true },
      { text: 'AB', hidden: false }, { text: 'U+202C', hidden: true },
    ]);
    expect(reportVisibleSegments(ch(0xfeff))).toEqual([{ text: 'U+FEFF', hidden: true }]);
    expect(reportVisibleSegments(`수${ch(0xa0)}능`)).toEqual([
      { text: '수', hidden: false }, { text: 'U+00A0', hidden: true }, { text: '능', hidden: false },
    ]);
    expect(reportVisibleSegments('보통 글')).toEqual([{ text: '보통 글', hidden: false }]);
  });

  it('출처 칸·태그 목록이 이 규칙으로 읽힌다(BOM 만 든 출판사는 빈 칸이 아니다)', () => {
    expect(reportSourceFields({ publisher: ch(0xfeff), title: ` 수능${ch(9)}` })).toEqual([
      { label: '제목', value: '수능' }, { label: '출판사', value: ch(0xfeff) },
    ]);
    expect(parseReportTags({ work_titles: ['  ', `동백꽃${ch(10)}`] })?.work_titles).toEqual(['동백꽃']);
  });

  it('공백 정규식은 sql/114 의 problem_report_norm_text 와 글자 그대로 같다', () => {
    const sql = readFileSync(join(process.cwd(), 'sql/114_problem_report_tag_source_categories.sql'), 'utf8');
    const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION exam.problem_report_norm_text'));
    const body = fn.slice(0, fn.indexOf('$$;'));
    expect(body).toContain(`'${REPORT_HTML_SPACE_RUNS.source}', ' '`);
    expect(body).toContain('NFC');
  });
});
