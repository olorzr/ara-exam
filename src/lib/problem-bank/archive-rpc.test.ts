import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { splitArchiveRpc } from './archive-rpc';
import { SOURCE_EQ_AXES, sourceAxisArgs } from './source-axes';

describe('splitArchiveRpc — 출처 칸은 전부 함수가 거른다', () => {
  it('⚠️ 평가문제집 책 제목(source_title)도 나머지에 남지 않고 함수 인자 title 로 간다 — 남으면 운영 PostgREST 가 거절한다', () => {
    const split = splitArchiveRpc({ work_title: '어쩌면', source_type: '평가문제집', source_title: '동아 중2-1 평가문제집 2-(1) 시와 화자' });
    expect(split?.rest).not.toHaveProperty('source_title');
    expect(split?.rest).not.toHaveProperty('source_type');
    expect(split?.args.p_source).toEqual({ source_type: '평가문제집', title: '동아 중2-1 평가문제집 2-(1) 시와 화자' });
  });
});

describe('splitArchiveRpc — 작품·문법 축이 있을 때만 함수에서 출발한다', () => {
  it('작품·문법이 없으면 표에서 출발한다(null)', () => {
    expect(splitArchiveRpc({})).toBeNull();
    expect(splitArchiveRpc({ area_path: ['문학'], unit_path: ['1단원'], search: '화자' })).toBeNull();
    // 빈 작품명·빈 문법 배열은 조건이 아니다(지금 체인의 truthy 규칙 그대로)
    expect(splitArchiveRpc({ work_title: '', grammar_paths: [] })).toBeNull();
  });

  it('작품 — 쉼표 든 이름을 그대로 싣고, 함수가 거른 칸은 나머지에서 뺀다', () => {
    const split = splitArchiveRpc({
      work_title: '소녀, 두드리다', only_work: true, area_path: ['문학'], passage_areas: ['문학'],
      question_types: ['객관식'], search: '화자', page: 3,
    });
    expect(split?.args).toEqual({
      p_work_title: '소녀, 두드리다', p_only_work: true, p_grammar_paths: null, p_source: {},
    });
    expect(split?.rest).toEqual({
      area_path: ['문학'], passage_areas: ['문학'], question_types: ['객관식'], search: '화자', page: 3,
    });
  });

  it("'그 작품만' 은 작품이 있을 때만 켠다 — 문법 축에는 뜻이 없다", () => {
    expect(splitArchiveRpc({ grammar_paths: ['음운'], only_work: true })?.args.p_only_work).toBe(false);
  });

  it('문법 경로는 배열 그대로, 작품과 함께면 둘 다 싣는다', () => {
    expect(splitArchiveRpc({ grammar_paths: ['단어 > 품사, 혼합'] })?.args).toMatchObject({
      p_work_title: null, p_grammar_paths: ['단어 > 품사, 혼합'],
    });
    expect(splitArchiveRpc({ work_title: '동백꽃', grammar_paths: ['음운'] })?.args).toMatchObject({
      p_work_title: '동백꽃', p_grammar_paths: ['음운'],
    });
  });

  it('출처 칸은 p_source 로 옮기고 나머지에서는 빠진다 — \'\' 은 값(미지정만)이다', () => {
    const split = splitArchiveRpc({
      work_title: '동백꽃', source_type: '내신기출', school_name: '', year: '2025', grade: '중2',
      grades: ['중1', '중2', '중3'], semester: '1학기', exam_type: '중간', textbook: '',
    });
    expect(split?.args.p_source).toEqual({
      source_type: '내신기출', school_name: '', year: '2025', grade: '중2',
      grades: ['중1', '중2', '중3'], semester: '1학기', exam_type: '중간', textbook: '',
    });
    expect(split?.rest).toEqual({});
  });
});

describe('sourceAxisArgs — applySourceAxes 와 같은 규칙', () => {
  it('없는 칸(undefined)과 빈 학년 목록은 싣지 않는다', () => {
    expect(sourceAxisArgs({ year: undefined, grades: [] })).toEqual({});
    expect(sourceAxisArgs({ grade: '' })).toEqual({ grade: '' });
  });
});

describe('sql/82 거울 (problems_for_archive 의 정식 정의 — sql/72 를 대신한다)', () => {
  it('함수가 받는 출처 키 목록이 SOURCE_EQ_AXES + grades 와 같다 — 어긋나면 조건이 빠지거나 목록이 오류를 낸다', () => {
    const sql = readFileSync(path.resolve(__dirname, '../../../sql/82_problem_bank_source_title_axis.sql'), 'utf8');
    const match = sql.match(/WHERE k NOT IN \(([^)]*)\)/);
    expect(match).not.toBeNull();
    const keys = [...(match?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(keys).toEqual([...SOURCE_EQ_AXES, 'title', 'grades'].sort());
  });

  it('함수 매개변수 이름이 인자 객체의 키와 같다 — PostgREST 는 이름으로 짝짓는다', () => {
    const sql = readFileSync(path.resolve(__dirname, '../../../sql/82_problem_bank_source_title_axis.sql'), 'utf8');
    const head = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION exam.problems_for_archive('));
    const params = [...head.slice(0, head.indexOf(')')).matchAll(/\b(p_[a-z_]+)\b/g)].map((m) => m[1]);
    const args = splitArchiveRpc({ work_title: '동백꽃' })?.args ?? {};
    expect(params).toEqual(Object.keys(args));
  });
});
