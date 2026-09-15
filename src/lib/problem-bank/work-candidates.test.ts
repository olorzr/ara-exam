import { describe, it, expect } from 'vitest';
import {
  candidateInputValue, describeWorkBasis, printLabelOf, rankWorkCandidates, toWorkHints,
  WORK_CANDIDATE_MAX, workCandidateLabel,
  type BundleWorkRow, type PassageWorkRow, type WorkWanted,
} from './work-candidates';

const wanted = (over: Partial<WorkWanted> = {}): WorkWanted => ({
  year: '2026', grade: '중2', semester: '2학기', examType: '중간', ...over,
});

const bundle = (over: Partial<BundleWorkRow> = {}): BundleWorkRow => ({
  name: '2026 광희중학교 중2 2학기 중간 홍길동전',
  scanTitle: '2026 광희중학교 중2 2학기 중간',
  year: '2026', grade: '중2', semester: '2학기', examType: '중간', ...over,
});

const passage = (over: Partial<PassageWorkRow> = {}): PassageWorkRow => ({
  title: '동백꽃', author: '김유정',
  year: '2026', grade: '중2', semester: '2학기', examType: '중간', ...over,
});

describe('printLabelOf', () => {
  it('스캔 제목 접두를 벗겨 작품 부분만 남긴다', () => {
    expect(printLabelOf('2026 광희중 중2 홍길동전', '2026 광희중 중2')).toBe('홍길동전');
  });

  it('프린트가 한 장뿐이라 이름이 스캔 제목뿐이면 빈 문자열', () => {
    expect(printLabelOf('2026 광희중 중2', '2026 광희중 중2')).toBe('');
  });

  it('표기가 갈려 접두가 안 맞으면 이름을 통째로 쓴다 — 버리는 것보다 낫다', () => {
    expect(printLabelOf('봄봄 학습지', '2026 광희중 중2')).toBe('봄봄 학습지');
  });

  it('정규화를 거친다 — 전각 괄호·겹공백이 달라도 접두가 맞는다', () => {
    expect(printLabelOf('2026  광희중 중2  훈민정음', '2026 광희중 중2')).toBe('훈민정음');
  });

  it('선생님 이름이 괄호로 붙은 스캔 제목도 벗긴다 — 운영에 실제로 있는 모양이다', () => {
    expect(printLabelOf(
      '2026 압구정중학교 중2 2학기 중간(이재하) 훈민정음',
      '2026 압구정중학교 중2 2학기 중간(이재하)',
    )).toBe('훈민정음');
  });

  it('스캔 제목이 없으면 이름 전체가 작품이다', () => {
    expect(printLabelOf('가난한 사랑 노래', '')).toBe('가난한 사랑 노래');
  });
});

describe('rankWorkCandidates', () => {
  it('프린트 이름에서 작품을 뽑는다', () => {
    const out = rankWorkCandidates({ bundles: [bundle()], passages: [], wanted: wanted() });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('홍길동전');
    expect(out[0].basis).toBe('학교 프린트 2026 중2 2학기 중간');
  });

  it('기출 지문의 제목·지은이를 함께 준다', () => {
    const out = rankWorkCandidates({ bundles: [], passages: [passage()], wanted: wanted() });
    expect(out[0]).toMatchObject({ title: '동백꽃', author: '김유정' });
    expect(out[0].basis).toContain('이 학교 기출');
  });

  it('작품명이 비는 줄은 버린다 — 한 장짜리 스캔의 프린트 이름', () => {
    const out = rankWorkCandidates({
      bundles: [bundle({ name: '2026 광희중학교 중2 2학기 중간' })], passages: [], wanted: wanted(),
    });
    expect(out).toEqual([]);
  });

  it('감싸는 기호를 벗겨 표준 표기로 담는다 — 트리가 갈라지면 안 된다', () => {
    const out = rankWorkCandidates({
      bundles: [], passages: [passage({ title: '「동백꽃」' })], wanted: wanted(),
    });
    expect(out[0].title).toBe('동백꽃');
  });

  it('학년이 다르면 아예 뺀다 — 작품은 학년마다 통째로 다르다', () => {
    const out = rankWorkCandidates({
      bundles: [bundle({ grade: '중1', name: '2026 광희중학교 중1 하늘은 맑건만', scanTitle: '2026 광희중학교 중1' })],
      passages: [],
      wanted: wanted(),
    });
    expect(out).toEqual([]);
  });

  it('학년을 안 골랐으면 어느 학년이든 후보다', () => {
    const out = rankWorkCandidates({
      bundles: [bundle({ grade: '중1' })], passages: [], wanted: wanted({ grade: '' }),
    });
    expect(out).toHaveLength(1);
  });

  it('학년도·학기·시험이 맞는 것이 앞에 온다', () => {
    const out = rankWorkCandidates({
      bundles: [
        bundle({ name: '2026 광희중 중2 옛작품', scanTitle: '2026 광희중 중2', year: '2024' }),
        bundle({ name: '2026 광희중 중2 이번작품', scanTitle: '2026 광희중 중2' }),
      ],
      passages: [],
      wanted: wanted(),
    });
    expect(out.map((c) => c.title)).toEqual(['이번작품', '옛작품']);
  });

  it('같은 작품이 두 곳에 있으면 하나로 묶고, 지은이가 있는 쪽을 남긴다', () => {
    const out = rankWorkCandidates({
      bundles: [bundle({ name: '2026 광희중 중2 동백꽃', scanTitle: '2026 광희중 중2' })],
      passages: [passage()],
      wanted: wanted(),
    });
    expect(out).toHaveLength(1);
    expect(out[0].author).toBe('김유정');
  });

  it('지은이 없는 줄을 합칠 때 가까운 쪽의 등급·근거를 가져온다 — 밀려나면 상한에 잘린다', () => {
    const out = rankWorkCandidates({
      // 올해 이 시험 프린트의 '동백꽃'(가장 가까움) + 작년 기출의 '동백꽃 (김유정)'
      bundles: [bundle({ name: '2026 광희중 중2 동백꽃', scanTitle: '2026 광희중 중2' })],
      passages: [
        passage({ title: '동백꽃', year: '2024' }),
        // 등급 1(시험만 다름) · 한글 사전순으로 '동백꽃' 보다 앞이다
        passage({ title: '가나다', author: '', examType: '기말' }),
      ],
      wanted: wanted(),
    });
    const 동백꽃 = out.find((c) => c.title === '동백꽃')!;
    expect(동백꽃.author).toBe('김유정');
    // 근거가 작년 기출로 바뀌면 안 된다 — 가장 가까운 자료는 올해 프린트다
    expect(동백꽃.basis).toContain('학교 프린트');
    // 등급까지 가져와야 맨 앞에 선다. 작년 것(등급 4)으로 남으면 '가나다' 에 밀린다
    expect(out[0].title).toBe('동백꽃');
  });

  it('같은 제목에 지은이가 둘이면 합치지 않는다 — 지은이 없는 줄이 누구 것인지 알 수 없다', () => {
    const out = rankWorkCandidates({
      bundles: [bundle({ name: '2026 광희중 중2 봄', scanTitle: '2026 광희중 중2' })],
      passages: [passage({ title: '봄', author: '이성부' }), passage({ title: '봄', author: '김수영' })],
      wanted: wanted(),
    });
    expect(out.filter((c) => c.title === '봄')).toHaveLength(3);
  });

  it('같은 제목이라도 지은이가 다르면 따로 둔다 — 지은이가 어느 작품인지 가리는 단서다', () => {
    const out = rankWorkCandidates({
      bundles: [],
      passages: [passage({ title: '봄', author: '이성부' }), passage({ title: '봄', author: '김수영' })],
      wanted: wanted(),
    });
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.author).sort()).toEqual(['김수영', '이성부']);
  });

  it('상한을 넘기지 않는다 — 칸이 한 줄이라 더 넣으면 아무도 안 읽는다', () => {
    const many = Array.from({ length: WORK_CANDIDATE_MAX + 5 }, (_, i) => passage({
      title: `작품${i}`, author: '',
    }));
    expect(rankWorkCandidates({ bundles: [], passages: many, wanted: wanted() }))
      .toHaveLength(WORK_CANDIDATE_MAX);
  });
});

describe('표시', () => {
  it('지은이가 있으면 괄호로 붙인다', () => {
    expect(workCandidateLabel({ title: '동백꽃', author: '김유정', basis: '' })).toBe('동백꽃 (김유정)');
    expect(workCandidateLabel({ title: '훈민정음', author: '', basis: '' })).toBe('훈민정음');
  });

  it('칸 값은 쉼표로 잇는다', () => {
    const out = candidateInputValue([
      { title: '홍길동전', author: '', basis: 'a' },
      { title: '동백꽃', author: '김유정', basis: 'a' },
    ]);
    expect(out).toBe('홍길동전, 동백꽃 (김유정)');
  });

  it('같은 근거는 한 번만 밝힌다', () => {
    const out = describeWorkBasis([
      { title: 'ㄱ', author: '', basis: '학교 프린트 2026 중2' },
      { title: 'ㄴ', author: '', basis: '학교 프린트 2026 중2' },
      { title: 'ㄷ', author: '', basis: '이 학교 기출 2026 중2' },
    ]);
    expect(out).toBe('학교 프린트 2026 중2 · 이 학교 기출 2026 중2');
  });
});

describe('toWorkHints', () => {
  it('쉼표·가운뎃점·줄바꿈을 모두 구분자로 본다 — 선생님이 셋 다 쓴다', () => {
    expect(toWorkHints('봄봄, 동백꽃 · 홍길동전\n훈민정음'))
      .toEqual(['봄봄', '동백꽃', '홍길동전', '훈민정음']);
  });

  it('빈 조각과 중복을 없앤다', () => {
    expect(toWorkHints('봄봄,, 봄봄 ,  ')).toEqual(['봄봄']);
  });

  it('괄호 안 지은이는 그대로 둔다 — 동명이작을 가릴 단서다', () => {
    expect(toWorkHints('동백꽃 (김유정)')).toEqual(['동백꽃(김유정)']);
  });

  it('비었으면 빈 배열', () => {
    expect(toWorkHints('')).toEqual([]);
  });
});
