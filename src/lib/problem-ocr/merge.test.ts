import { beforeEach, describe, it, expect } from 'vitest';
import { mergeOcrDrafts, type DraftWithPages } from './merge';
import type { OcrItem } from './schema';
import { toWarningObject, warningText, type DraftWarning } from './warnings';

let seq = 0;
const newId = () => `id${++seq}`;
beforeEach(() => { seq = 0; });

function passage(over: Partial<OcrItem> = {}): OcrItem {
  return {
    kind: 'passage', ref: 'P1', page: 1, box: null, passage_ref: null, number: null,
    label: '[1~3]', title: '소나기', author: '황순원', html: '<p>지문</p>',
    continued: false, continues: false, question_type: '객관식', stem_html: '',
    choices: [], answer: null, has_figure: false, figures: [], work_title: null,
    area_path: [], unit_path: [], grammar_paths: [], ...over,
  };
}

function problem(over: Partial<OcrItem> = {}): OcrItem {
  return {
    kind: 'problem', ref: 'Q1', page: 1, box: null, passage_ref: null, number: 1,
    label: null, title: null, author: null, html: '', continued: false, continues: false,
    question_type: '객관식', stem_html: '<p>물음</p>', choices: ['가', '나'],
    answer: null, has_figure: false, figures: [], work_title: null, area_path: [], unit_path: [],
    grammar_paths: [], ...over,
  };
}

const batch = (
  items: OcrItem[], pages: number[], warnings: DraftWarning[] = [],
): DraftWithPages => ({ draft: { items, warnings }, pages });

/** 경고를 한 줄로 이어 본다 (대상 이름까지) */
const said = (res: { warnings: Parameters<typeof warningText>[0][] }) =>
  res.warnings.map(warningText).join(' | ');

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

  it('나중 묶음이 빈 정답을 채운다 — 정답표는 뒤쪽 쪽에만 있을 수 있다', () => {
    const res = mergeOcrDrafts([
      batch([problem({ page: 3, number: 5, answer: null })], [1, 2, 3]),
      batch([problem({ page: 3, number: 5, answer: '3', question_type: '객관식' })], [3, 4, 5]),
    ], { newId });
    expect(res.problems[0].answer).toBe('3');
  });

  it('같은 길이의 지문이라도 나중에 알아본 작품·단원은 채운다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ page: 3, title: '', unit_path: [], area_path: [] })], [1, 2, 3]),
      batch([passage({ page: 3, title: '소나기', unit_path: ['1. 문학'], area_path: ['문학'] })], [3, 4, 5]),
    ], { newId });
    expect(res.passages).toHaveLength(1);
    expect(res.passages[0].title).toBe('소나기');
    expect(res.passages[0].unit_path).toEqual(['1. 문학']);
    expect(res.passages[0].area_path).toEqual(['문학']);
  });

  it('이어지는 쪽의 좌표는 앞 지문에 붙이지 않는다 — 좌표와 쪽 번호는 짝이다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ page: 3, label: '[1~3]', continues: true, box: null })], [3]),
      batch([passage({
        page: 4, label: null, continued: true, html: '<p>뒷부분</p>',
        box: { column: 1, top: 0.1, bottom: 0.5 },
      })], [4]),
    ], { newId });
    expect(res.passages[0].page_no).toBe(3);
    expect(res.passages[0].box).toBeNull();
  });

  it('이어지는 조각에서 알아본 분류도 앞 지문에 붙인다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ page: 3, label: '[1~3]', continues: true, unit_path: [] })], [3]),
      batch([passage({
        page: 4, label: null, continued: true, html: '<p>뒷부분</p>',
        title: '소나기', unit_path: ['1. 문학', '(1) 시'],
      })], [4]),
    ], { newId });
    expect(res.passages).toHaveLength(1);
    expect(res.passages[0].unit_path).toEqual(['1. 문학', '(1) 시']);
    expect(res.passages[0].title).toBe('소나기');
    expect(res.passages[0].pageSpan).toBe(2);
  });

  it('나중 묶음이 빈 단원도 채운다 — 앞 묶음에서는 작품을 못 알아봤을 수 있다', () => {
    const res = mergeOcrDrafts([
      batch([problem({ page: 3, number: 5, unit_path: [] })], [1, 2, 3]),
      batch([problem({ page: 3, number: 5, unit_path: ['1. 문학', '(1) 시'] })], [3, 4, 5]),
    ], { newId });
    expect(res.problems[0].unit_path).toEqual(['1. 문학', '(1) 시']);
  });

  it('OCR 은 배점을 읽지 않는다 — 문항 초안의 배점은 늘 비어 있다', () => {
    const res = mergeOcrDrafts([batch([problem()], [1])], { newId });
    expect(res.problems[0].score).toBeNull();
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

  it('한 쪽 안에서 번호가 반복돼도 각각 남는다 — 문제집·프린트는 절마다 1번부터 다시 센다', () => {
    // 코덱스 리뷰 14R: 쪽·번호만으로 키를 만들면 둘째 문항이 통째로 사라졌다
    const res = mergeOcrDrafts([
      batch([
        problem({ ref: 'Q1', page: 2, number: 1, stem_html: '<p>유형A 1번</p>' }),
        problem({ ref: 'Q2', page: 2, number: 1, stem_html: '<p>유형B 1번</p>' }),
      ], [2]),
    ], { newId });
    expect(res.problems).toHaveLength(2);
    expect(res.problems[1].stem_html).toContain('유형B');
  });

  it('겹쳐 읽으면 같은 자리끼리만 합쳐진다 — 반복 번호가 있어도 중복이 안 생긴다', () => {
    const two = () => [
      problem({ ref: 'Q1', page: 2, number: 1, stem_html: '<p>유형A 1번</p>' }),
      problem({ ref: 'Q2', page: 2, number: 1, stem_html: '<p>유형B 1번</p>', answer: '4' }),
    ];
    const res = mergeOcrDrafts([batch(two(), [1, 2]), batch(two(), [2, 3])], { newId });
    expect(res.problems).toHaveLength(2);
    expect(res.problems[1].answer).toBe('4');
  });

  it('쪽이 다르면 같은 번호라도 다른 문항이다 — 문제집은 절마다 번호가 다시 시작한다', () => {
    const res = mergeOcrDrafts([
      batch([problem({ page: 1, number: 1 }), problem({ ref: 'Q2', page: 4, number: 1 })], [1, 4]),
    ], { newId });
    expect(res.problems).toHaveLength(2);
  });
});

describe('mergeOcrDrafts — 지문 합치기', () => {
  it('한 쪽에 같은 라벨의 지문이 둘이면 각각 남는다 — 합치면 문항이 엉뚱한 글에 붙는다', () => {
    // 코덱스 리뷰 16R: 문제집·프린트는 절마다 [1~2] 를 다시 쓴다
    const res = mergeOcrDrafts([
      batch([
        passage({ ref: 'P1', page: 2, label: '[1~2]', html: '<p>가 지문</p>' }),
        passage({ ref: 'P2', page: 2, label: '[1~2]', html: '<p>나 지문</p>' }),
        problem({ ref: 'Q1', page: 2, number: 1, passage_ref: 'P2' }),
      ], [2]),
    ], { newId });

    expect(res.passages).toHaveLength(2);
    expect(res.passages[1].html).toContain('나 지문');
    // 문항은 자기가 가리킨 지문에 붙어야 한다
    expect(res.problems[0].passage_id).toBe(res.passages[1].id);
  });

  it('겹쳐 읽어도 같은 자리 지문끼리만 합쳐진다', () => {
    const two = () => [
      passage({ ref: 'P1', page: 2, label: '[1~2]', html: '<p>가 지문</p>' }),
      passage({ ref: 'P2', page: 2, label: '[1~2]', html: '<p>나 지문 더 길게</p>' }),
    ];
    const res = mergeOcrDrafts([batch(two(), [1, 2]), batch(two(), [2, 3])], { newId });
    expect(res.passages).toHaveLength(2);
  });

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
    expect(said(res)).toContain('이어지는 지문');
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

  it('끝내 안 닫힌 지문이 있으면 알린다 — 어느 지문인지까지 짚는다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ continues: true })], [1]),
    ], { newId });
    expect(said(res)).toContain('이어지는 지문');
    // 개수만 알려 주면 어느 지문인지 찾을 방법이 없다
    expect(toWarningObject(res.warnings[0]).targets).toEqual([
      { kind: 'passage', id: res.passages[0].id, page: 1, label: '1쪽 지문' },
    ]);
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
      batch([problem()], [1], [{ message: '정답표가 안 보여요' }]),
      batch([problem({ page: 2, number: 2 })], [2], [{ message: '정답표가 안 보여요' }]),
    ], { newId });
    expect(res.warnings.filter((w) => warningText(w) === '정답표가 안 보여요')).toHaveLength(1);
  });

  it('메시지가 같아도 대상이 다르면 남긴다 — 문항마다 알려야 한다', () => {
    const res = mergeOcrDrafts([
      batch(
        [problem({ ref: 'Q1', number: 1 }), problem({ ref: 'Q2', number: 2 })],
        [1],
        [
          { message: '선지를 읽지 못했어요.', ref: 'Q1', kind: 'problem', page: 1, number: 1 },
          { message: '선지를 읽지 못했어요.', ref: 'Q2', kind: 'problem', page: 1, number: 2 },
        ],
      ),
    ], { newId });
    expect(res.warnings).toHaveLength(2);
    expect(said(res)).toContain('1번');
    expect(said(res)).toContain('2번');
  });

  it('파서 경고의 ref 가 문항 id 로 풀린다 — 이게 없으면 어느 카드인지 알 수 없다', () => {
    const res = mergeOcrDrafts([
      batch([problem({ ref: 'Q3', page: 2, number: 7 })], [2], [
        { message: '2번 선지를 읽지 못했어요.', ref: 'Q3', kind: 'problem', page: 2, number: 7 },
      ]),
    ], { newId });
    expect(toWarningObject(res.warnings[0]).targets).toEqual([
      { kind: 'problem', id: res.problems[0].id, page: 2, label: '7번' },
    ]);
  });

  it('지문 ref 도 지문 id 로 푼다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 4 })], [4], [
        { message: '작품명을 못 읽었어요.', ref: 'P1', kind: 'passage', page: 4 },
      ]),
    ], { newId });
    expect(toWarningObject(res.warnings[0]).targets?.[0])
      .toMatchObject({ kind: 'passage', id: res.passages[0].id, label: '4쪽 지문' });
  });

  it('겹쳐 읽어 이미 담은 문항의 ref 도 푼다 — 두 번째 묶음의 경고가 길을 잃으면 안 된다', () => {
    const res = mergeOcrDrafts([
      batch([problem({ ref: 'Q1', page: 3, number: 5 })], [1, 2, 3]),
      batch([problem({ ref: 'Q9', page: 3, number: 5 })], [3, 4, 5], [
        { message: '정답을 못 읽었어요.', ref: 'Q9', kind: 'problem', page: 3, number: 5 },
      ]),
    ], { newId });
    expect(res.problems).toHaveLength(1);
    expect(toWarningObject(res.warnings[0]).targets?.[0].id).toBe(res.problems[0].id);
  });

  it('버려진 항목의 경고는 쪽을 가리킨다 — 가리킬 카드가 없다', () => {
    const res = mergeOcrDrafts([
      batch([problem()], [1], [{ message: '같은 항목을 두 번 읽었어요.', page: 5 }]),
    ], { newId });
    expect(toWarningObject(res.warnings[0]).targets)
      .toEqual([{ kind: 'page', page: 5, label: '5쪽' }]);
  });

  it('선행 경고(렌더 실패 등)를 앞에 붙인다', () => {
    const res = mergeOcrDrafts([batch([problem()], [1])], {
      newId, leadingWarnings: ['2묶음을 읽지 못했어요'],
    });
    expect(res.warnings[0]).toBe('2묶음을 읽지 못했어요');
  });

  it('경고 개수에 상한이 있다 — 항목마다 붙으므로 묶음 상한보다 넉넉하다', () => {
    const many = Array.from({ length: 90 }, (_, i) => ({ message: `경고${i}` }));
    const res = mergeOcrDrafts([batch([problem()], [1], many)], { newId });
    expect(res.warnings.length).toBeLessThanOrEqual(60);
    expect(res.warnings.length).toBeGreaterThan(20);
  });
});

describe('mergeOcrDrafts — 모델이 이어짐 표시를 빠뜨릴 때', () => {
  it("앞 지문이 continues 를 안 냈어도 바로 앞 쪽에서 끝났으면 이어 붙인다", () => {
    // 모델은 쪽 끝에서 '다음 쪽으로 이어진다' 를 자주 빠뜨린다. 그때마다 뒷부분이
    // 주인 없는 지문으로 떨어져 나가면 문항이 어느 쪽에도 온전히 붙지 않는다
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 3, html: '<p>앞부분</p>', continues: false })], [3]),
      batch([passage({ ref: 'P1', page: 4, label: null, html: '<p>뒷부분</p>', continued: true })], [4]),
    ], { newId });

    expect(res.passages).toHaveLength(1);
    expect(res.passages[0].html).toContain('앞부분');
    expect(res.passages[0].html).toContain('뒷부분');
    expect(res.passages[0].pageSpan).toBe(2);
  });

  it('앞 묶음이 이미 뒷부분까지 읽어 뒀으면 두 번 붙이지 않는다', () => {
    // 겹쳐 읽은 묶음이 같은 뒷부분을 '이어지는 조각' 으로 다시 내놓는 흔한 경우다.
    // 그대로 이어 붙이면 같은 글이 두 번 인쇄된다
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 3, html: '<p>앞부분</p><p>뒷부분이 여기 다 있다</p>' })], [3, 4]),
      batch([passage({ ref: 'P1', page: 4, label: null, html: '<p>뒷부분이 여기 다 있다</p>', continued: true })], [4, 5]),
    ], { newId });

    expect(res.passages).toHaveLength(1);
    expect(res.passages[0].html.match(/뒷부분이 여기 다 있다/g)).toHaveLength(1);
  });

  it('앞 묶음이 다음 쪽 **첫 문단까지만** 읽어 뒀으면 뒷부분을 붙인다', () => {
    // 앞 40자가 맞는다고 통째로 버리면 되찾은 뒷부분이 사라진다
    const res = mergeOcrDrafts([
      batch([passage({
        ref: 'P1', page: 3,
        html: '<p>앞 쪽 글</p><p>다음 쪽 첫 문단이 여기까지만 읽혔다</p>',
      })], [3, 4]),
      batch([passage({
        ref: 'P1', page: 4, label: null, continued: true,
        html: '<p>다음 쪽 첫 문단이 여기까지만 읽혔다</p><p>그리고 이어지는 뒷문단이 더 있다</p>',
      })], [4, 5]),
    ], { newId });

    expect(res.passages).toHaveLength(1);
    expect(res.passages[0].html).toContain('이어지는 뒷문단');
    expect(said(res)).toContain('앞부분이 겹쳐 보일 수 있어요');
  });

  it('중복이라 안 붙여도 그 조각을 가리킨 문항은 이 지문에 붙는다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 3, html: '<p>앞</p><p>뒤가 여기 다 있다</p>' })], [3, 4]),
      batch([
        passage({ ref: 'P9', page: 4, label: null, html: '<p>뒤가 여기 다 있다</p>', continued: true }),
        problem({ ref: 'Q9', page: 4, number: 9, passage_ref: 'P9' }),
      ], [4, 5]),
    ], { newId });

    expect(res.passages).toHaveLength(1);
    expect(res.problems[0].passage_id).toBe(res.passages[0].id);
  });

  it('머리글 표기가 달라도 같은 지문이다 — 물결표 하나로 지문이 둘이 되면 안 된다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 2, label: '[1~3]', html: '<p>온전한 지문 본문</p>' })], [1, 2]),
      batch([passage({ ref: 'P1', page: 2, label: '[1 ∼ 3]', html: '<p>지문</p>' })], [2, 3]),
    ], { newId });

    expect(res.passages).toHaveLength(1);
    expect(res.passages[0].html).toContain('온전한 지문 본문');
  });

  it('멀리 떨어진 쪽에는 여전히 안 붙는다 — 닫힌 지문이라도 마찬가지다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 1, html: '<p>가</p>', continues: false })], [1]),
      batch([passage({ ref: 'P2', page: 4, label: null, html: '<p>나</p>', continued: true })], [4]),
    ], { newId });
    expect(res.passages).toHaveLength(2);
  });
});

describe('mergeOcrDrafts — 문항의 그림', () => {
  const fig = (n: number) => `<figure data-figure="${n}"></figure>`;
  const box = (top: number) => ({ column: 1 as const, top, bottom: top + 0.1 });

  it('빈 발문을 갈아 끼울 때 그림도 함께 간다 — 발문만 갈면 1번 자리에 딴 그림이 그려진다', () => {
    const res = mergeOcrDrafts([
      // 첫 판은 그림 자리표시자만 있고 글이 없다
      batch([problem({ ref: 'Q1', number: 5, stem_html: fig(1), figures: [box(0.2)] })], [1]),
      // 겹쳐 읽은 판이 발문을 읽었고 그림도 다시 잡았다
      batch([problem({
        ref: 'Q1', number: 5, stem_html: `<p>다음 그래프는?</p>${fig(1)}`, figures: [box(0.6)],
      })], [1, 2]),
    ], { newId });

    expect(res.problems[0].stem_html).toContain('다음 그래프는?');
    expect(res.problems[0].figures).toEqual([{ page: 1, box: box(0.6) }]);
  });

  it('발문이 멀쩡하면 그림만 따로 채운다 — 자리표시자가 있을 때만', () => {
    const res = mergeOcrDrafts([
      batch([problem({ ref: 'Q1', number: 5, stem_html: `<p>물음</p>${fig(1)}`, figures: [] })], [1]),
      batch([problem({ ref: 'Q1', number: 5, stem_html: `<p>물음</p>${fig(1)}`, figures: [box(0.3)] })], [1, 2]),
    ], { newId });
    expect(res.problems[0].figures).toEqual([{ page: 1, box: box(0.3) }]);
  });

  it('자리표시자가 없으면 그림을 받지 않는다 — 받아 봐야 그릴 자리가 없다', () => {
    const res = mergeOcrDrafts([
      batch([problem({ ref: 'Q1', number: 5, stem_html: '<p>물음</p>', figures: [] })], [1]),
      batch([problem({ ref: 'Q1', number: 5, stem_html: '<p>물음</p>', figures: [box(0.3)] })], [1, 2]),
    ], { newId });
    expect(res.problems[0].figures).toEqual([]);
  });
});

describe('mergeOcrDrafts — 쪽을 넘어가는 지문의 그림', () => {
  const fig = (n: number) => `<figure data-figure="${n}"></figure>`;
  const box = (top: number) => ({ column: 1 as const, top, bottom: top + 0.1 });

  it('조각마다 그림을 자기 쪽 번호와 함께 든다 — 시작 쪽에서 찾으면 엉뚱한 데를 자른다', () => {
    const res = mergeOcrDrafts([
      batch([passage({
        ref: 'P1', page: 3, html: `<p>앞</p>${fig(1)}`, figures: [box(0.2)], continues: true,
      })], [3]),
      batch([passage({
        ref: 'P1', page: 4, label: null, html: `<p>뒤</p>${fig(1)}`,
        figures: [box(0.5)], continued: true,
      })], [4]),
    ], { newId });

    expect(res.passages).toHaveLength(1);
    expect(res.passages[0].figures).toEqual([
      { page: 3, box: box(0.2) },
      { page: 4, box: box(0.5) },
    ]);
  });

  it('이어 붙일 때 자리표시자 번호를 민다 — 안 밀면 뒤 조각이 앞 그림을 가리킨다', () => {
    const res = mergeOcrDrafts([
      batch([passage({
        ref: 'P1', page: 3, html: `<p>앞</p>${fig(1)}`, figures: [box(0.2)], continues: true,
      })], [3]),
      batch([passage({
        ref: 'P1', page: 4, label: null, html: `<p>뒤</p>${fig(1)}`,
        figures: [box(0.5)], continued: true,
      })], [4]),
    ], { newId });

    expect(res.passages[0].html).toContain('data-figure="1"');
    expect(res.passages[0].html).toContain('data-figure="2"');
  });

  it('그림 없는 조각은 번호를 건드리지 않는다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 3, html: '<p>앞</p>', continues: true })], [3]),
      batch([passage({
        ref: 'P1', page: 4, label: null, html: `<p>뒤</p>${fig(1)}`,
        figures: [box(0.5)], continued: true,
      })], [4]),
    ], { newId });
    expect(res.passages[0].html).toContain('data-figure="1"');
    expect(res.passages[0].figures).toEqual([{ page: 4, box: box(0.5) }]);
  });

  it('겹쳐 읽어 더 온전한 판으로 갈아 끼워도 그림 번호 밀기가 풀리지 않는다', () => {
    // 모델이 낸 원문은 늘 1번부터 센다 — 밀기를 다시 안 걸면 뒤 조각이 앞 그림을 가리킨다
    const res = mergeOcrDrafts([
      batch([passage({
        ref: 'P1', page: 3, html: `<p>앞</p>${fig(1)}`, figures: [box(0.2)], continues: true,
      })], [3]),
      batch([passage({
        ref: 'P1', page: 4, label: null, html: `<p>뒤</p>${fig(1)}`,
        figures: [box(0.5)], continued: true,
      })], [4]),
      // 같은 4쪽 조각을 더 온전히 읽은 묶음
      batch([passage({
        ref: 'P1', page: 4, label: null, html: `<p>뒤가 더 온전하게 읽힌 판이다</p>${fig(1)}`,
        figures: [box(0.5)], continued: true,
      })], [4, 5]),
    ], { newId });

    expect(res.passages[0].html).toContain('더 온전하게');
    expect(res.passages[0].html).toContain('data-figure="1"');
    expect(res.passages[0].html).toContain('data-figure="2"');
  });

  it('그림만 이어지는 조각도 새 조각으로 본다 — 글이 없다고 버리면 그 그림이 사라진다', () => {
    const res = mergeOcrDrafts([
      batch([passage({
        ref: 'P1', page: 3, html: '<p>앞 글</p>', continues: true,
      })], [3]),
      // 쪽 머리에 도표만 이어지는 지문이 실제로 있다
      batch([passage({
        ref: 'P1', page: 4, label: null, html: fig(1), figures: [box(0.1)], continued: true,
      })], [4]),
    ], { newId });

    expect(res.passages).toHaveLength(1);
    expect(res.passages[0].figures).toEqual([{ page: 4, box: box(0.1) }]);
    expect(res.passages[0].html).toContain('data-figure="1"');
  });

  it('겹쳐 읽은 판에서 새로 알아본 그림을 살린다 — 글만 갈면 그 그림이 사라진다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 3, html: '<p>앞</p>', continues: true })], [3]),
      // 처음에는 그림을 못 알아봤다
      batch([passage({
        ref: 'P1', page: 4, label: null, html: '<p>뒤</p>', figures: [], continued: true,
      })], [4]),
      // 겹쳐 읽은 묶음이 같은 조각을 더 온전히 보며 도표를 알아봤다
      batch([passage({
        ref: 'P1', page: 4, label: null, html: `<p>뒤가 더 온전하게 읽혔다</p>${fig(1)}`,
        figures: [box(0.5)], continued: true,
      })], [4, 5]),
    ], { newId });

    expect(res.passages[0].figures).toEqual([{ page: 4, box: box(0.5) }]);
    expect(res.passages[0].html).toContain('data-figure="1"');
  });

  it('글이 똑같아도 이번에만 알아본 그림은 살린다 — 길이만 보면 못 알아챈다', () => {
    // textOf 가 자리표시자를 지우므로 두 판의 글 길이가 똑같다
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 2, html: '<p>같은 지문 본문</p>', figures: [] })], [1, 2]),
      batch([passage({
        ref: 'P1', page: 2, html: `<p>같은 지문 본문</p>${fig(1)}`, figures: [box(0.4)],
      })], [2, 3]),
    ], { newId });

    expect(res.passages[0].figures).toEqual([{ page: 2, box: box(0.4) }]);
    expect(res.passages[0].html).toContain('data-figure="1"');
  });

  it('글이 더 온전한 판이 그림을 덜 알아봤으면 **글·그림을 함께 갈고 알린다**', () => {
    // 짝이 어긋나면 1번 자리에 딴 그림이 그려진다 — 없는 것보다 나쁘다
    const res = mergeOcrDrafts([
      batch([passage({
        ref: 'P1', page: 2, html: `<p>지문</p>${fig(1)}${fig(2)}`,
        figures: [box(0.2), box(0.5)],
      })], [1, 2]),
      batch([passage({
        ref: 'P1', page: 2, html: `<p>지문이 더 온전하게 읽혔다</p>${fig(1)}`,
        figures: [box(0.5)],
      })], [2, 3]),
    ], { newId });

    expect(res.passages[0].html).toContain('더 온전하게');
    // 그림 목록도 새 판의 것이다 — 개수와 자리표시자가 맞는다
    expect(res.passages[0].figures).toEqual([{ page: 2, box: box(0.5) }]);
    expect(said(res)).toContain('그림을 덜 알아봤어요');
  });

  it('겹쳐 읽은 그림은 같은 쪽에서 읽은 것만 받는다 — 좌표와 쪽은 짝이다', () => {
    const res = mergeOcrDrafts([
      batch([passage({ ref: 'P1', page: 2, html: '<p>지문</p>', figures: [] })], [1, 2]),
      // 3쪽에서 본 좌표를 2쪽 지문에 붙이면 엉뚱한 자리를 자른다
      batch([passage({ ref: 'P1', page: 3, label: null, html: '<p>딴글</p>', figures: [box(0.5)] })], [3]),
    ], { newId });
    expect(res.passages[0].figures).toEqual([]);
  });
});
