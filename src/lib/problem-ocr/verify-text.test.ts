import { describe, it, expect } from 'vitest';
import { matchRatio, verifyAgainstText } from './verify-text';
import { warningText } from './warnings';
import type { PassageDraft, ProblemDraft } from './merge';
import type { PageText } from './page-text';

let seq = 0;
const id = () => `id${++seq}`;

function problem(over: Partial<ProblemDraft> = {}): ProblemDraft {
  return {
    id: id(), passage_id: null, number: 1, question_type: '객관식',
    stem_html: '', choices: [], answer: '1', score: null,
    work_titles: [], area_path: [], unit_path: [], grammar_paths: [],
    page_no: 1, box: null, has_figure: false, figures: [], ...over,
  };
}

function passage(over: Partial<PassageDraft> = {}): PassageDraft {
  return {
    id: id(), label: '', works: [], html: '', page_no: 1, box: null,
    area_path: [], unit_path: [], has_figure: false, figures: [], lastPage: 1, open: false,
    pageSpan: 1, ...over,
  };
}

const page = (text: string, n = 1): PageText => ({ page: n, text, source: 'layer' });

/** 대조를 돌릴 만큼 긴 글 */
const LONG = '소나기가 그치고 개울물이 불어난 그날 오후에 소년은 징검다리 앞에서 소녀를 다시 만났다. '
  + '소녀는 조약돌을 만지작거리다 개울 건너 산 너머를 한참 바라보았고 소년은 아무 말도 못 한 채 서 있었다.';
const said = (w: ReturnType<typeof verifyAgainstText>) => w.map(warningText).join(' | ');

describe('matchRatio', () => {
  it('그대로 옮겼으면 1', () => {
    expect(matchRatio(LONG, LONG)).toBe(1);
  });

  it('공백·문장부호가 달라도 맞는 것으로 본다', () => {
    expect(matchRatio(LONG, LONG.replace(/ /g, ''))).toBe(1);
  });

  it('전혀 다른 글은 낮다', () => {
    const other = '문법 문항의 선지는 피동 표현과 사동 표현을 나란히 견주도록 짜여 있어서 어렵다. '
      + '어문 규정을 묻는 문항은 표준 발음법과 한글 맞춤법을 함께 물어 범위가 넓은 편이다.';
    expect(matchRatio(LONG, other)!).toBeLessThan(0.5);
  });

  it('너무 짧으면 견주지 않는다 — 표본이 적어 비율이 못 믿을 값이 된다', () => {
    expect(matchRatio('짧다', LONG)).toBeNull();
  });
});

describe('verifyAgainstText', () => {
  it('참고 텍스트가 없으면 아무것도 안 한다 — 스캔본이 정상이다', () => {
    expect(verifyAgainstText({ passages: [], problems: [] }, [])).toEqual([]);
  });

  it('그대로 옮긴 지문에는 경고가 없다', () => {
    const merged = { passages: [passage({ html: `<p>${LONG}</p>` })], problems: [] };
    expect(verifyAgainstText(merged, [page(LONG)])).toEqual([]);
  });

  it('PDF 글자와 크게 다른 지문을 짚는다 — 지어냈거나 통째로 빠뜨린 것이다', () => {
    const merged = {
      passages: [passage({
        html: '<p>문법 문항의 선지는 피동 표현과 사동 표현을 견주도록 짜여 있어 어렵다. '
          + '어문 규정을 묻는 문항은 표준 발음법과 한글 맞춤법을 함께 물어 범위가 넓다.</p>',
      })],
      problems: [],
    };
    const text = said(verifyAgainstText(merged, [page(LONG)]));
    expect(text).toContain('PDF 에 박힌 글자와 다른');
    expect(text).toContain('1쪽 지문');
  });

  it('문항은 발문과 선지를 함께 견준다', () => {
    const merged = {
      passages: [],
      problems: [problem({
        number: 7,
        stem_html: '<p>전혀 다른 발문이 여기 들어 있고 이것은 원본 시험지 어디에도 없는 문장이다</p>',
        choices: ['아무 데도 없는 선지 하나입니다', '역시 원본에 없는 선지 둘입니다', '세 번째 없는 선지'],
      })],
    };
    expect(said(verifyAgainstText(merged, [page(LONG)]))).toContain('7번');
  });

  it('참고 텍스트가 없는 쪽의 항목은 건너뛴다', () => {
    const merged = { passages: [passage({ page_no: 5, html: '<p>딴 글</p>' })], problems: [] };
    expect(verifyAgainstText(merged, [page(LONG, 1)])).toEqual([]);
  });

  it('여러 쪽에 걸친 지문은 건너뛴다 — 시작 쪽 글자만으로는 뒷부분이 다 어긋나 보인다', () => {
    const merged = {
      passages: [passage({
        pageSpan: 2,
        html: `<p>${LONG}</p><p>다음 쪽에서 이어진 아주 다른 내용이 길게 이어지는데 여기에는 참고 텍스트가 없다</p>`,
      })],
      problems: [],
    };
    expect(verifyAgainstText(merged, [page(LONG)])).toEqual([]);
  });

  it('짧은 본문은 견주지 않는다 — 잘못된 경고가 섞이면 경고 전체를 못 믿는다', () => {
    const merged = { passages: [], problems: [problem({ stem_html: '<p>맞는 것은?</p>' })] };
    expect(verifyAgainstText(merged, [page(LONG)])).toEqual([]);
  });
});

describe('verifyAgainstText — 옛한글은 견주지 않는다', () => {
  const YET = '\u1112\u119E\u11AB';
  /** 대조 문턱을 넘길 만큼 긴 중세국어 지문 */
  const MIDDLE = `나랏말\u110A\u119E미 듕귁에 달아 문\u110D\u119E\u11BC와로 서르 \u1109\u119E\u1106\u119E\u11BA디 `
    + `아니\u1112\u119E\u11AF\u110A\u11A1 이런 젼\u110E\u11A5로 어린 百姓이 니르고져 홂배 이셔도 `
    + `\u1106\u119E\u110A\u119E \u1109\u119E\u11B7디 몯\u1112\u119E\u11AF 노미 하니라`;

  it('모델이 옛한글로 적었으면 건너뛴다 — 글자 레이어는 한양 PUA 라 조각이 절대 안 맞는다', () => {
    const p = passage({ html: MIDDLE, page_no: 1 });
    expect(verifyAgainstText({ passages: [p], problems: [] }, [page(LONG)])).toEqual([]);
  });

  it('참고 텍스트에 옛 글자가 섞였어도 **현대 항목은 그대로 대조한다** — 한 지문이 그 쪽의 검사를 통째로 끄면 안 된다', () => {
    const p = passage({ html: LONG, page_no: 1 });
    const source = page(`${LONG} \u3014옛\u3015 ${MIDDLE}`);
    // 본문이 참고 텍스트 안에 그대로 있으므로 경고가 없어야 한다(면제가 아니라 대조를 통과한 것)
    expect(verifyAgainstText({ passages: [p], problems: [] }, [source])).toEqual([]);

    const off = passage({ html: LONG, page_no: 1 });
    const unrelated = page(`\u3014옛\u3015 문법 문항의 선지는 피동 표현과 사동 표현을 나란히 견주도록 짜여 있어서 `
      + '어렵다. 어문 규정을 묻는 문항은 표준 발음법과 한글 맞춤법을 함께 물어 범위가 넓은 편이다.');
    expect(said(verifyAgainstText({ passages: [off], problems: [] }, [unrelated])))
      .toContain('PDF 에 박힌 글자와 다른 대목');
  });

  it('자모로 갈린 현대 글자(NFD)는 대조 전에 접는다 — 접지 않으면 조각이 하나도 안 맞는다', () => {
    const q = problem({ stem_html: LONG.normalize('NFD'), page_no: 1 });
    expect(verifyAgainstText({ passages: [], problems: [q] }, [page(LONG)])).toEqual([]);
  });

  it('문항도 같은 규칙이다 — 발문·선지 어디에 있든 건너뛴다', () => {
    const q = problem({ stem_html: MIDDLE, page_no: 1 });
    expect(verifyAgainstText({ passages: [], problems: [q] }, [page(LONG)])).toEqual([]);
  });

  it('현대 국어끼리는 그대로 대조한다 — 건너뛰기가 검사를 통째로 끄면 안 된다', () => {
    const q = problem({ stem_html: LONG, page_no: 1 });
    const other = '문법 문항의 선지는 피동 표현과 사동 표현을 나란히 견주도록 짜여 있어서 어렵다. '
      + '어문 규정을 묻는 문항은 표준 발음법과 한글 맞춤법을 함께 물어 범위가 넓은 편이다.';
    expect(said(verifyAgainstText({ passages: [], problems: [q] }, [page(other)])))
      .toContain('PDF 에 박힌 글자와 다른 대목');
    expect(YET).toHaveLength(3);
  });
});
