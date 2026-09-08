import { beforeEach, describe, it, expect } from 'vitest';
import { mergeOcrDrafts, type DraftWithPages } from './merge';
import type { OcrItem } from './schema';

let seq = 0;
const newId = () => `id${++seq}`;
beforeEach(() => { seq = 0; });

function passage(over: Partial<OcrItem> = {}): OcrItem {
  return {
    kind: 'passage', ref: 'P1', page: 1, box: null, passage_ref: null, number: null,
    label: '[1~3]', title: '소나기', author: '황순원', html: '<p>지문</p>',
    continued: false, continues: false, question_type: '객관식', stem_html: '',
    choices: [], answer: null, score: null, has_figure: false, work_title: null,
    area_path: [], ...over,
  };
}

function problem(over: Partial<OcrItem> = {}): OcrItem {
  return {
    kind: 'problem', ref: 'Q1', page: 1, box: null, passage_ref: null, number: 1,
    label: null, title: null, author: null, html: '', continued: false, continues: false,
    question_type: '객관식', stem_html: '<p>물음</p>', choices: ['가', '나'],
    answer: null, score: null, has_figure: false, work_title: null, area_path: [], ...over,
  };
}

const batch = (items: OcrItem[], pages: number[], warnings: string[] = []): DraftWithPages =>
  ({ draft: { items, warnings }, pages });

describe('mergeOcrDrafts — 기본', () => {
  it('지문과 문항을 담고 참조를 id 로 잇는다', () => {
    const res = mergeOcrDrafts(
      [batch([passage(), problem({ passage_ref: 'P1' })], [1])],
      { newId },
    );
    expect(res.passages).toHaveLength(1);
    expect(res.problems).toHaveLength(1);
    expect(res.problems[0].passage_id).toBe(res.passages[0].id);
  });

  it('지문 없는 문항은 passage_id 가 null', () => {
    const res = mergeOcrDrafts([batch([problem()], [1])], { newId });
    expect(res.problems[0].passage_id).toBeNull();
  });

  it('ref 는 묶음 안에서만 유효하다 — 다른 묶음의 같은 이름에 붙지 않는다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 1, label: '[1~2]' })], [1]),
      // 두 번째 묶음의 Q9 가 P1 을 가리키지만 이 묶음엔 P1 이 없다
      batch([problem({ ref: 'Q9', page: 5, number: 9, passage_ref: 'P1' })], [5]),
    ], { newId });
    expect(res.problems[0].passage_id).toBeNull();
  });
});

describe('mergeOcrDrafts — 겹쳐 읽은 중복', () => {
  it('같은 문항이 두 묶음에 나와도 하나만 남는다', () => {
    const res = mergeOcrDrafts([
      batch([problem({ page: 3, number: 5 })], [1, 2, 3]),
      batch([problem({ page: 3, number: 5 })], [3, 4, 5]),
    ], { newId });
    expect(res.problems).toHaveLength(1);
  });

  it('나중 묶음이 빈 칸(정답·배점)을 채운다 — 정답표는 뒤쪽 쪽에만 있을 수 있다', () => {
    const res = mergeOcrDrafts([
      batch([problem({ page: 3, number: 5, answer: null, score: null })], [1, 2, 3]),
      batch([problem({ page: 3, number: 5, answer: '3', score: 4, question_type: '객관식' })], [3, 4, 5]),
    ], { newId });
    expect(res.problems[0].answer).toBe('3');
    expect(res.problems[0].score).toBe(4);
  });

  it('이미 채워진 값은 나중 묶음이 덮어쓰지 않는다', () => {
    const res = mergeOcrDrafts([
      batch([problem({ page: 3, number: 5, answer: '1', stem_html: '<p>먼저</p>' })], [3]),
      batch([problem({ page: 3, number: 5, answer: '4', stem_html: '<p>나중</p>' })], [3]),
    ], { newId });
    expect(res.problems[0].answer).toBe('1');
    expect(res.problems[0].stem_html).toBe('<p>먼저</p>');
  });

  it('정답과 유형은 한 덩어리로 옮긴다 — 유형이 바뀌면 정답의 의미가 달라진다', () => {
    const res = mergeOcrDrafts([
      batch([problem({ number: 5, answer: null, question_type: '객관식' })], [3]),
      batch([problem({ number: 5, answer: '역설법', question_type: '주관식' })], [3]),
    ], { newId });
    expect(res.problems[0].answer).toBe('역설법');
    expect(res.problems[0].question_type).toBe('주관식');
  });

  it('번호가 없으면 발문으로 중복을 가린다', () => {
    const res = mergeOcrDrafts([
      batch([problem({ number: null, stem_html: '<p>같은 물음</p>' })], [1]),
      batch([problem({ number: null, stem_html: '<p>같은 물음</p>' })], [1]),
    ], { newId });
    expect(res.problems).toHaveLength(1);
  });

  it('쪽이 다르면 같은 번호라도 다른 문항이다 — 문제집은 절마다 번호가 다시 시작한다', () => {
    const res = mergeOcrDrafts([
      batch([problem({ page: 1, number: 1 }), problem({ ref: 'Q2', page: 4, number: 1 })], [1, 4]),
    ], { newId });
    expect(res.problems).toHaveLength(2);
  });
});

describe('mergeOcrDrafts — 지문 합치기', () => {
  it('겹쳐 읽어 더 완전한 지문이 이긴다 — 잘린 쪽을 남기면 안 된다', () => {
    const res = mergeOcrDrafts([
      // 첫 묶음은 쪽 끝에서 잘렸다
      batch([passage({ page: 3, html: '<p>앞부분</p>', continues: true })], [1, 2, 3]),
      // 겹친 묶음은 통째로 봤다
      batch([passage({ page: 3, html: '<p>앞부분</p><p>뒷부분</p>', continues: false })], [3, 4, 5]),
    ], { newId });
    expect(res.passages).toHaveLength(1);
    expect(res.passages[0].html).toContain('뒷부분');
    expect(res.passages[0].open).toBe(false);
  });

  it('짧은 쪽이 나중에 와도 긴 쪽을 유지한다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ page: 3, html: '<p>앞부분</p><p>뒷부분</p>' })], [3]),
      batch([passage({ page: 3, html: '<p>앞부분</p>', continues: true })], [3]),
    ], { newId });
    expect(res.passages[0].html).toContain('뒷부분');
  });

  it('묶음보다 긴 지문은 이어 붙인다 (continued 조각)', () => {
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 3, html: '<p>1편</p>', continues: true })], [1, 2, 3]),
      batch([passage({ ref: 'P1', page: 4, label: null, html: '<p>2편</p>', continued: true })], [4, 5, 6]),
    ], { newId });
    expect(res.passages).toHaveLength(1);
    expect(res.passages[0].html).toContain('1편');
    expect(res.passages[0].html).toContain('2편');
    expect(res.passages[0].lastPage).toBe(4);
  });

  it('붙일 앞부분이 없으면 따로 두고 경고한다 — 조용히 버리지 않는다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ page: 4, label: null, html: '<p>조각</p>', continued: true })], [4]),
    ], { newId });
    expect(res.passages).toHaveLength(1);
    expect(res.warnings.join()).toContain('이어지는 지문');
  });

  it('바로 앞 쪽에서 끊긴 지문에만 붙인다 — 멀리 있는 글에 잘못 붙으면 두 글이 섞인다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 1, html: '<p>가</p>', continues: true })], [1]),
      // 4쪽 조각은 1쪽 지문의 다음 쪽이 아니다
      batch([passage({ ref: 'P2', page: 4, label: null, html: '<p>나</p>', continued: true })], [4]),
    ], { newId });
    expect(res.passages).toHaveLength(2);
  });

  it('이어 붙인 뒤 그 조각의 더 완전한 판이 와도 앞부분을 잃지 않는다', () => {
    // 코덱스 리뷰 2R: 합쳐 둔 글에 "더 긴 쪽이 이긴다"를 적용하면
    // 조각 하나가 합본과 길이를 겨루게 되어 앞부분이 통째로 날아갔다
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 3, html: '<p>1편 앞부분</p>', continues: true })], [1, 2, 3]),
      batch([passage({ ref: 'P1', page: 4, label: null, html: '<p>2편</p>', continued: true })], [4, 5]),
      // 겹쳐 읽은 묶음이 2편을 더 온전히 봤다
      batch([passage({ ref: 'P1', page: 4, label: null, html: '<p>2편 온전한 뒷부분</p>', continued: true })], [4, 5]),
    ], { newId });

    expect(res.passages).toHaveLength(1);
    expect(res.passages[0].html).toContain('1편 앞부분');
    expect(res.passages[0].html).toContain('2편 온전한 뒷부분');
  });

  it('짧은 판이 나중에 와도 조각을 되돌리지 않는다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 3, html: '<p>앞</p>', continues: true })], [3]),
      batch([passage({ ref: 'P1', page: 4, label: null, html: '<p>뒤 온전한 문장</p>', continued: true })], [4]),
      batch([passage({ ref: 'P1', page: 4, label: null, html: '<p>뒤</p>', continued: true })], [4]),
    ], { newId });
    expect(res.passages[0].html).toContain('뒤 온전한 문장');
  });

  it('몇 쪽에 걸쳐 있는지 센다 — 잘라 둔 이미지가 전체를 담았는지 판단한다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 3, html: '<p>앞</p>', continues: true })], [3]),
      batch([passage({ ref: 'P1', page: 4, label: null, html: '<p>뒤</p>', continued: true })], [4]),
    ], { newId });
    expect(res.passages[0].pageSpan).toBe(2);
  });

  it('한 쪽짜리 지문의 pageSpan 은 1', () => {
    const res = mergeOcrDrafts([batch([passage()], [1])], { newId });
    expect(res.passages[0].pageSpan).toBe(1);
  });

  it('끝내 안 닫힌 지문이 있으면 알린다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ continues: true })], [1]),
    ], { newId });
    expect(res.warnings.join()).toContain('이어지는 지문');
  });

  it('문항이 뒤늦게 온전해진 지문에 연결된다', () => {
    const res = mergeOcrDrafts([
      batch([
        passage({ ref: 'P1', page: 3, html: '<p>앞</p>', continues: true }),
        problem({ ref: 'Q1', page: 3, number: 1, passage_ref: 'P1' }),
      ], [1, 2, 3]),
    ], { newId });
    expect(res.problems[0].passage_id).toBe(res.passages[0].id);
  });
});

describe('mergeOcrDrafts — 경고', () => {
  it('묶음 경고를 모으고 중복은 한 번만 남긴다', () => {
    const res = mergeOcrDrafts([
      batch([problem()], [1], ['정답표가 안 보여요']),
      batch([problem({ page: 2, number: 2 })], [2], ['정답표가 안 보여요']),
    ], { newId });
    expect(res.warnings.filter((w) => w === '정답표가 안 보여요')).toHaveLength(1);
  });

  it('선행 경고(렌더 실패 등)를 앞에 붙인다', () => {
    const res = mergeOcrDrafts([batch([problem()], [1])], {
      newId, leadingWarnings: ['2묶음을 읽지 못했어요'],
    });
    expect(res.warnings[0]).toBe('2묶음을 읽지 못했어요');
  });

  it('경고 개수에 상한이 있다', () => {
    const many = Array.from({ length: 40 }, (_, i) => `경고${i}`);
    const res = mergeOcrDrafts([batch([problem()], [1], many)], { newId });
    expect(res.warnings.length).toBeLessThanOrEqual(20);
  });
});
