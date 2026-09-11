import { describe, it, expect } from 'vitest';
import { parseOcrDraft } from './parse';
import { OCR_HTML_MAX } from './constants';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';

const TREE: AreaTreeNode[] = [
  { id: '1', name: '문학', children: [{ id: '2', name: '현대시', children: [] }] },
  { id: '3', name: '독서', children: [] },
];

/** 스키마가 요구하는 모든 키를 채운 기본 항목 */
function item(over: Record<string, unknown> = {}) {
  return {
    kind: 'problem', ref: 'Q1', page: 1, box: null, passage_ref: null, number: 1,
    label: null, title: null, author: null, html: '', continued: false, continues: false,
    question_type: '객관식', stem_html: '<p>물음</p>', choices: ['가', '나', '다', '라', '마'],
    answer: '1', has_figure: false, figures: [], work_title: null, area_path: [], unit_path: [],
    grammar_paths: [],
    ...over,
  };
}

const UNITS: AreaTreeNode[] = [
  { id: 'u1', name: '1. 문학', children: [{ id: 'u2', name: '(1) 시의 화자', children: [] }] },
];

const ctx = { pages: [1, 2, 3], areaTree: TREE, unitTree: UNITS };
const json = (items: unknown[], warnings: string[] = []) => JSON.stringify({ items, warnings });

/** 경고 메시지를 한 줄로 이어 본다 */
const said = (warnings: { message: string }[]) => warnings.map((w) => w.message).join(' | ');

describe('parseOcrDraft — 구조', () => {
  it('JSON 이 아니면 null (형식 오류와 스키마 불일치를 구분하려고 null 로 돌려준다)', () => {
    expect(parseOcrDraft('설명 문장입니다', ctx)).toBeNull();
  });

  it('items 배열이 없으면 null', () => {
    expect(parseOcrDraft('{"warnings":[]}', ctx)).toBeNull();
  });

  it('정상 항목을 그대로 담는다', () => {
    const draft = parseOcrDraft(json([item()]), ctx)!;
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].stem_html).toBe('<p>물음</p>');
    expect(draft.items[0].choices).toHaveLength(5);
  });

  it('모델 경고를 그대로 가져온다', () => {
    const draft = parseOcrDraft(json([item()], ['정답표가 안 보여요']), ctx)!;
    expect(draft.warnings).toEqual([{ message: '정답표가 안 보여요' }]);
  });
});

describe('parseOcrDraft — 항목 관대성', () => {
  it('이상한 항목만 버리고 나머지는 살린다', () => {
    const draft = parseOcrDraft(json([item({ ref: 'Q1' }), 'garbage', item({ ref: 'Q2' })]), ctx)!;
    expect(draft.items.map((i) => i.ref)).toEqual(['Q1', 'Q2']);
  });

  it('보내지 않은 쪽을 가리키면 버리고 경고한다', () => {
    const draft = parseOcrDraft(json([item({ ref: 'Q9', page: 99 })]), ctx)!;
    expect(draft.items).toHaveLength(0);
    expect(said(draft.warnings)).toContain('보내지 않은 쪽(99)');
    // 버린 항목에는 행이 안 생긴다 — ref 를 실으면 병합이 엉뚱한 카드를 짚는다
    expect(draft.warnings[0].ref).toBeUndefined();
  });

  it('경고가 어느 항목인지 데이터로 나른다 — 메시지의 Q3 는 화면 어디에도 없는 이름이다', () => {
    const draft = parseOcrDraft(json([item({ ref: 'Q7', number: 7, choices: ['가', '', '다'] })]), ctx)!;
    expect(draft.warnings[0]).toMatchObject({ ref: 'Q7', kind: 'problem', page: 1, number: 7 });
    expect(draft.warnings[0].message).not.toContain('Q7');
  });

  it('같은 ref 가 두 번이면 먼저 온 것을 남긴다', () => {
    const draft = parseOcrDraft(
      json([item({ ref: 'Q1', number: 1 }), item({ ref: 'Q1', number: 7 })]), ctx,
    )!;
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].number).toBe(1);
  });

  it('버린 중복의 경고는 ref 를 떼고 남긴다 — 살아남은 항목을 짚으면 거짓이 된다', () => {
    const draft = parseOcrDraft(json([
      item({ ref: 'Q1', number: 1 }),
      // 버려질 쪽에만 빈 선지가 있다
      item({ ref: 'Q1', number: 1, choices: ['가', '', '다'] }),
    ]), ctx)!;
    expect(draft.items).toHaveLength(1);
    const blank = draft.warnings.find((w) => w.message.includes('선지'));
    expect(blank).toBeDefined();
    expect(blank!.ref).toBeUndefined();
    expect(blank!.page).toBe(1);
  });
});

describe('parseOcrDraft — 정답·선지', () => {
  it('① 을 1 로 정규화한다 — 없으면 실제 시험지 대부분이 주관식으로 강등된다', () => {
    const draft = parseOcrDraft(json([item({ answer: '①' })]), ctx)!;
    expect(draft.items[0].answer).toBe('1');
    expect(draft.items[0].question_type).toBe('객관식');
  });

  it('(3) · 3번 · 전각 숫자도 알아본다', () => {
    for (const raw of ['(3)', '3번', '３', '3.']) {
      const draft = parseOcrDraft(json([item({ answer: raw })]), ctx)!;
      expect(draft.items[0].answer).toBe('3');
    }
  });

  it('선지 앞에 남은 번호 표시를 지운다 — 렌더가 기호를 다시 붙인다', () => {
    const draft = parseOcrDraft(
      json([item({ choices: ['① 가나', '(2) 다라', '3. 마바', '④사아', '⑤ 자차'] })]), ctx,
    )!;
    expect(draft.items[0].choices).toEqual(['가나', '다라', '마바', '사아', '자차']);
  });

  it('가운데 빈 선지의 자리를 지킨다 — 압축하면 정답이 다른 선지를 가리킨다', () => {
    // 코덱스 리뷰 13R: ['A','','C','D','E'] 를 압축하면 정답 '3' 이 D 를 가리킨다
    const draft = parseOcrDraft(json([item({ choices: ['가', '', '다', '라', '마'] })]), ctx)!;
    expect(draft.items[0].choices).toEqual(['가', '', '다', '라', '마']);
    expect(said(draft.warnings)).toContain('2번 선지');
  });

  it('뒤쪽 빈 선지는 잘라 낸다', () => {
    const draft = parseOcrDraft(json([item({ choices: ['가', '나', '', ''] })]), ctx)!;
    expect(draft.items[0].choices).toEqual(['가', '나']);
  });

  it('객관식인데 정답이 선지 번호가 아니면 주관식으로 내린다', () => {
    const draft = parseOcrDraft(json([item({ answer: '역설법' })]), ctx)!;
    expect(draft.items[0].question_type).toBe('주관식');
    expect(draft.items[0].answer).toBe('역설법');
    expect(said(draft.warnings)).toContain('역설법');
  });

  it('정답이 없으면 null 로 둔다 — 추측으로 채우지 않는다', () => {
    const draft = parseOcrDraft(json([item({ answer: null })]), ctx)!;
    expect(draft.items[0].answer).toBeNull();
  });

  it('모델이 배점을 보내도 무시한다 — 스키마에서 뺀 값이다', () => {
    const draft = parseOcrDraft(json([item({ score: 4 })]), ctx)!;
    expect(draft.items[0]).not.toHaveProperty('score');
  });
});

describe('parseOcrDraft — 서식 다듬기', () => {
  it('모델이 괄호째 보낸 구역 말머리를 살린다 — 정화기만 거치면 통째로 사라진다', () => {
    const draft = parseOcrDraft(
      json([item({ kind: 'passage', ref: 'P1', html: '<blockquote data-box="(가)"><p>시</p></blockquote>' })]),
      ctx,
    )!;
    expect(draft.items[0].html).toContain('data-box="가"');
  });

  it('빈 문단 모양을 통일한다 — 인쇄 CSS 가 공백 든 문단을 못 잡는다', () => {
    const draft = parseOcrDraft(
      json([item({ kind: 'passage', ref: 'P1', html: '<p>연 하나</p><p> </p><p>연 둘</p>' })]),
      ctx,
    )!;
    expect(draft.items[0].html).toContain('<p></p>');
  });

  it('발문 끝에 딸려 온 배점 표기를 지운다', () => {
    const draft = parseOcrDraft(json([item({ stem_html: '<p>물음? (3.4점)</p>' })]), ctx)!;
    expect(draft.items[0].stem_html).toBe('<p>물음?</p>');
  });

  it('밑줄은 그대로 통과한다', () => {
    const draft = parseOcrDraft(json([item({ stem_html: '<p>㉠<u>밑줄</u> 부분은?</p>' })]), ctx)!;
    expect(draft.items[0].stem_html).toContain('<u>밑줄</u>');
  });
});

describe('parseOcrDraft — 단원', () => {
  it('단원 트리에 있는 경로를 담는다', () => {
    const draft = parseOcrDraft(json([item({ unit_path: ['1. 문학', '(1) 시의 화자'] })]), ctx)!;
    expect(draft.items[0].unit_path).toEqual(['1. 문학', '(1) 시의 화자']);
  });

  it('트리에 없는 소단원은 잘라 내고 알린다 — 대단원까지는 멀쩡한 정보다', () => {
    const draft = parseOcrDraft(json([item({ unit_path: ['1. 문학', '없는 소단원'] })]), ctx)!;
    expect(draft.items[0].unit_path).toEqual(['1. 문학']);
    expect(said(draft.warnings)).toContain('단원');
  });

  it('트리에 아예 없으면 빈 배열', () => {
    const draft = parseOcrDraft(json([item({ unit_path: ['엉뚱한 단원'] })]), ctx)!;
    expect(draft.items[0].unit_path).toEqual([]);
  });

  it('단원 트리를 못 읽었으면 검증 없이 두 단계까지만 받는다 — DB 제약이 2단이다', () => {
    const draft = parseOcrDraft(
      json([item({ unit_path: ['가', '나', '다'] })]),
      { pages: [1, 2, 3], areaTree: TREE },
    )!;
    expect(draft.items[0].unit_path).toEqual(['가', '나']);
  });

  it('단원을 안 보내면 빈 배열', () => {
    const draft = parseOcrDraft(json([item()]), ctx)!;
    expect(draft.items[0].unit_path).toEqual([]);
  });
});

describe('parseOcrDraft — 문법', () => {
  it('마디 배열을 저장 모양인 경로 문자열로 접는다', () => {
    const draft = parseOcrDraft(
      json([item({ grammar_paths: [['단어', '품사', '명사']] })]), ctx,
    )!;
    expect(draft.items[0].grammar_paths).toEqual(['단어 > 품사 > 명사']);
  });

  it('여러 개를 그대로 담는다 — 한 문항이 개념 둘을 걸친다', () => {
    const draft = parseOcrDraft(json([item({
      grammar_paths: [['문장', '문법 요소', '피동 표현'], ['문장', '문법 요소', '사동 표현']],
    })]), ctx)!;
    expect(draft.items[0].grammar_paths).toEqual([
      '문장 > 문법 요소 > 피동 표현', '문장 > 문법 요소 > 사동 표현',
    ]);
  });

  it('지어낸 마지막 마디는 잘라 내고 남은 앞부분을 살린다', () => {
    const draft = parseOcrDraft(
      json([item({ grammar_paths: [['단어', '품사', '없는품사']] })]), ctx,
    )!;
    expect(draft.items[0].grammar_paths).toEqual(['단어 > 품사']);
  });

  it('트리에 아예 없으면 빼고 알린다', () => {
    const draft = parseOcrDraft(
      json([item({ grammar_paths: [['엉뚱한분류', '개념']] })]), ctx,
    )!;
    expect(draft.items[0].grammar_paths).toEqual([]);
    expect(said(draft.warnings)).toContain('문법 분류');
  });

  it('같은 경로를 두 번 내면 한 번만 담는다', () => {
    const draft = parseOcrDraft(json([item({
      grammar_paths: [['담화', '담화의 맥락'], ['담화', '담화의 맥락']],
    })]), ctx)!;
    expect(draft.items[0].grammar_paths).toEqual(['담화 > 담화의 맥락']);
  });

  it('문법을 안 보내면 빈 배열', () => {
    expect(parseOcrDraft(json([item()]), ctx)!.items[0].grammar_paths).toEqual([]);
  });
});

describe('parseOcrDraft — 좌표', () => {
  it('정상 좌표를 통과시킨다', () => {
    const draft = parseOcrDraft(
      json([item({ box: { column: 1, top: 0.1, bottom: 0.4 } })]), ctx,
    )!;
    expect(draft.items[0].box).toEqual({ column: 1, top: 0.1, bottom: 0.4 });
  });

  it('범위를 벗어난 값은 가둔다', () => {
    const draft = parseOcrDraft(
      json([item({ box: { column: 0, top: -0.5, bottom: 3 } })]), ctx,
    )!;
    expect(draft.items[0].box).toEqual({ column: 0, top: 0, bottom: 1 });
  });

  it('뒤집힌 좌표는 버리되 항목은 살린다 — 크롭만 못 할 뿐 본문은 멀쩡하다', () => {
    const draft = parseOcrDraft(
      json([item({ box: { column: 1, top: 0.8, bottom: 0.2 } })]), ctx,
    )!;
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].box).toBeNull();
  });

  it('모르는 단 번호는 버린다', () => {
    const draft = parseOcrDraft(json([item({ box: { column: 7, top: 0, bottom: 1 } })]), ctx)!;
    expect(draft.items[0].box).toBeNull();
  });
});

describe('parseOcrDraft — 영역·지문 참조', () => {
  it('트리에 있는 만큼만 남긴다 — 통째로 버리면 사람이 처음부터 다시 골라야 한다', () => {
    const draft = parseOcrDraft(
      json([item({ area_path: ['문학', '현대시', '심상'] })]), ctx,
    )!;
    expect(draft.items[0].area_path).toEqual(['문학', '현대시']);
    expect(said(draft.warnings)).toContain('심상');
  });

  it('트리에 없는 영역은 비운다', () => {
    const draft = parseOcrDraft(json([item({ area_path: ['화법과작문'] })]), ctx)!;
    expect(draft.items[0].area_path).toEqual([]);
  });

  it('트리가 비었으면 검증을 건너뛴다 — 마스터를 못 읽어도 태깅은 살린다', () => {
    const draft = parseOcrDraft(json([item({ area_path: ['문법'] })]), { pages: [1] })!;
    expect(draft.items[0].area_path).toEqual(['문법']);
  });

  it('묶음 안에 없는 지문을 가리키면 끊는다 — 엉뚱한 지문에 붙는 것보다 낫다', () => {
    const draft = parseOcrDraft(json([item({ ref: 'Q4', passage_ref: 'P9' })]), ctx)!;
    expect(draft.items[0].passage_ref).toBeNull();
    // 가리킬 카드는 **그 문항**이다(못 찾은 지문이 아니라)
    expect(draft.warnings[0]).toMatchObject({ ref: 'Q4', kind: 'problem' });
    expect(said(draft.warnings)).toContain('딸린 지문');
  });

  it('같은 묶음의 지문 참조는 유지한다', () => {
    const passage = item({ kind: 'passage', ref: 'P1', html: '<p>지문</p>', number: null });
    const draft = parseOcrDraft(json([passage, item({ ref: 'Q1', passage_ref: 'P1' })]), ctx)!;
    expect(draft.items[1].passage_ref).toBe('P1');
  });
});

describe('parseOcrDraft — 정화', () => {
  it('본문 HTML 을 정화한다 — AI 출력은 신뢰 경계 밖이다', () => {
    const draft = parseOcrDraft(
      json([item({ stem_html: '<p onclick="alert(1)">물음</p><script>x</script>' })]), ctx,
    )!;
    expect(draft.items[0].stem_html).not.toContain('onclick');
    expect(draft.items[0].stem_html).not.toContain('script');
    expect(draft.items[0].stem_html).toContain('물음');
  });

  it('선지에서 블록 태그를 벗긴다', () => {
    const draft = parseOcrDraft(json([item({ choices: ['<p>가</p>'] })]), ctx)!;
    expect(draft.items[0].choices[0]).toBe('가');
  });
});

describe('parseOcrDraft — 길이', () => {
  const long = (n: number) => `<p>${'가'.repeat(n)}</p>`;

  it('상한을 넘는 지문은 자르되 **반드시 알린다** — 말없이 자르면 안 읽은 것과 구분이 안 된다', () => {
    const draft = parseOcrDraft(
      json([item({ kind: 'passage', ref: 'P1', number: null, html: long(OCR_HTML_MAX + 100) })]),
      ctx,
    )!;
    // 정화기가 열린 태그를 닫아 주므로 딱 상한은 아니다 — 잘렸다는 사실만 본다
    expect(draft.items[0].html.length).toBeLessThan(OCR_HTML_MAX + 100);
    expect(said(draft.warnings)).toContain('뒷부분이 잘렸어요');
    // 어느 지문 얘기인지 데이터로 나른다 — 병합이 카드 id 로 바꾼다
    expect(draft.warnings[0]).toMatchObject({ ref: 'P1', kind: 'passage', page: 1 });
  });

  it('발문이 길어도 같은 경고를 낸다', () => {
    const draft = parseOcrDraft(json([item({ stem_html: long(OCR_HTML_MAX + 1) })]), ctx)!;
    expect(said(draft.warnings)).toContain('뒷부분이 잘렸어요');
  });

  it('상한 안이면 아무 말도 하지 않는다', () => {
    const draft = parseOcrDraft(json([item({ kind: 'passage', ref: 'P1', number: null, html: long(100) })]), ctx)!;
    expect(said(draft.warnings)).not.toContain('잘렸어요');
  });
});

describe('parseOcrDraft — 본문 속 그림', () => {
  const fig = (n: number) => `<figure data-figure="${n}"></figure>`;
  const box = (top: number) => ({ column: 1, top, bottom: top + 0.1 });

  it('그림 좌표와 자리표시자를 함께 담는다', () => {
    const draft = parseOcrDraft(json([item({
      stem_html: `<p>다음 그래프는?</p>${fig(1)}`,
      figures: [box(0.2)],
    })]), ctx)!;
    expect(draft.items[0].figures).toEqual([{ column: 1, top: 0.2, bottom: 0.30000000000000004 }]);
    expect(draft.items[0].stem_html).toContain('data-figure="1"');
  });

  it('좌표만 내고 자리표시자를 빠뜨리면 본문 끝에 붙인다 — 자리를 모르는 것보다 낫다', () => {
    const draft = parseOcrDraft(json([item({
      stem_html: '<p>물음</p>', figures: [box(0.2)],
    })]), ctx)!;
    expect(draft.items[0].stem_html).toContain('data-figure="1"');
  });

  it('자리표시자만 내고 좌표가 없으면 지운다 — 빈칸이 남으면 안 된다', () => {
    const draft = parseOcrDraft(json([item({
      stem_html: `<p>물음</p>${fig(1)}`, figures: [],
    })]), ctx)!;
    expect(draft.items[0].stem_html).not.toContain('figure');
  });

  it('지문 자리표시자는 html 에서 맞춘다 — 발문이 아니다', () => {
    const draft = parseOcrDraft(json([item({
      kind: 'passage', ref: 'P1', number: null,
      html: `<p>지문</p>${fig(1)}`, stem_html: '', figures: [box(0.3)],
    })]), ctx)!;
    expect(draft.items[0].html).toContain('data-figure="1"');
  });

  it('앞 그림의 좌표만 못 읽으면 **뒷 그림의 번호를 옮겨 붙인다** — 안 그러면 1번 자리에 2번이 그려진다', () => {
    const draft = parseOcrDraft(json([item({
      stem_html: `<p>물음</p>${fig(1)}<p>사이</p>${fig(2)}`,
      figures: [{ column: 1, top: 0.8, bottom: 0.2 }, box(0.5)],
    })]), ctx)!;

    expect(draft.items[0].figures).toEqual([{ column: 1, top: 0.5, bottom: 0.6 }]);
    // 살아남은 그림은 **자기 자리**(원래 2번 자리)에 남는다
    expect(draft.items[0].stem_html).toBe('<p>물음</p><p>사이</p><figure data-figure="1"></figure>');
    expect(said(draft.warnings)).toContain('그림 위치를 못 읽어');
  });

  it('뒤집힌 좌표는 버리고 자리표시자도 함께 지운다', () => {
    const draft = parseOcrDraft(json([item({
      stem_html: `<p>물음</p>${fig(1)}`,
      figures: [{ column: 1, top: 0.8, bottom: 0.2 }],
    })]), ctx)!;
    expect(draft.items[0].figures).toEqual([]);
    expect(draft.items[0].stem_html).not.toContain('figure');
  });

  it('그림이 있으면 has_figure 를 켠다 — 모델이 빠뜨려도 우리가 안다', () => {
    const draft = parseOcrDraft(json([item({
      has_figure: false, stem_html: '<p>물음</p>', figures: [box(0.2)],
    })]), ctx)!;
    expect(draft.items[0].has_figure).toBe(true);
  });

  it('상한을 넘는 그림은 잘라 낸다 — 크롭이 폭주하면 업로드가 그만큼 나간다', () => {
    const draft = parseOcrDraft(json([item({
      stem_html: '<p>물음</p>', figures: [box(0.1), box(0.2), box(0.3), box(0.4), box(0.5)],
    })]), ctx)!;
    expect(draft.items[0].figures).toHaveLength(3);
  });
});
