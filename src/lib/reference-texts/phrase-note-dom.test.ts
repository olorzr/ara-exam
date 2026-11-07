import { describe, expect, it } from 'vitest';
import { EXPLANATION_NOTE_SELECTOR, layoutPhraseNotes, layoutPhraseNotesForPrint, type NoteMeasure } from './phrase-note-dom';

const LINE = 40;
const GLYPH = 20;
const ROW = 14;

interface Geometry {
  left: number;
  right?: number;
  line?: number;
  width?: number;
  height?: number;
  /** 풀이 한 행 높이 — 글자 크기가 다른 구절 */
  row?: number;
  /** 글자 높이 — 글자 크기가 다른 구절 */
  glyph?: number;
  fragments?: number;
}

function sheet(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

/** 스팬마다 정한 자리로 재는 흉내 — 칸은 폭 500, 세 줄이다 */
function fake(geometry: Geometry[], box = { left: 0, right: 500, top: 0, bottom: LINE * 3, lineHeight: LINE }): NoteMeasure {
  const spans = new Map<HTMLElement, Geometry>();
  const of = (span: HTMLElement) => {
    if (!spans.has(span)) spans.set(span, geometry[spans.size]);
    return spans.get(span)!;
  };
  return {
    fragments: (span) => {
      const g = of(span);
      const top = (g.line ?? 0) * LINE + (LINE - GLYPH) / 2;
      const first = { left: g.left, right: g.right ?? g.left + 40, top, bottom: top + (g.glyph ?? GLYPH) };
      return g.fragments === 2 ? [first, { ...first, left: 0, top: top + LINE, bottom: top + LINE + GLYPH }] : [first];
    },
    note: (span) => {
      const g = of(span);
      const wrapped = span.getAttribute('data-note-fit') === 'wrap';
      return { width: g.width ?? 100, height: wrapped ? g.height ?? ROW * 2 : g.row ?? ROW };
    },
    block: () => box,
  };
}

const vars = (span: Element) => ({
  dx: (span as HTMLElement).style.getPropertyValue('--note-dx'),
  shift: (span as HTMLElement).style.getPropertyValue('--note-shift'),
  dy: (span as HTMLElement).style.getPropertyValue('--note-dy'),
  strut: (span as HTMLElement).style.getPropertyValue('--note-strut'),
  w: (span as HTMLElement).style.getPropertyValue('--note-w'),
});

describe('layoutPhraseNotes', () => {
  it('풀이가 없으면 아무 일도 없다', () => {
    expect(layoutPhraseNotes(sheet('<p>가</p>'))).toEqual({ notes: 0, wrapped: 0, maxRows: 0 });
  });

  it('⚠️ 낱말 뜻풀이는 재지 않는다 — ✦ 는 흐름 안이고 자리 변수가 쓰일 곳이 없다', () => {
    const root = sheet('<p><span data-note="뜻" data-note-kind="vocab">갑</span> <span data-note="나">을</span></p>');
    const [vocab, note] = Array.from(root.querySelectorAll('span'));
    vocab.style.setProperty('--note-dx', '-5px');
    const summary = layoutPhraseNotes(root, fake([{ left: 450 }]));
    expect(summary?.notes).toBe(1);
    expect(vars(note).dx).toBe('-52px');
    expect(vars(vocab).dx).toBe('-5px');
  });

  it('낱말 뜻풀이뿐이면 풀이가 없는 글과 같다', () => {
    const root = sheet('<p><span data-note="뜻" data-note-kind="vocab">갑</span></p>');
    expect(layoutPhraseNotes(root, fake([]))).toEqual({ notes: 0, wrapped: 0, maxRows: 0 });
    expect(root.querySelector('span')!.getAttribute('style')).toBeNull();
  });

  it('갈래 값이 없는 풀이는 해설이다', () => {
    const root = sheet('<p><span data-note="가">갑</span><span data-note-kind="vocab">을</span></p>');
    expect(Array.from(root.querySelectorAll(EXPLANATION_NOTE_SELECTOR)).map((n) => n.textContent)).toEqual(['갑']);
  });

  it('잴 수 없으면 null 이고 아무것도 안 쓴다(jsdom)', () => {
    const root = sheet('<p><span data-note="가">갑</span></p>');
    expect(layoutPhraseNotes(root)).toBeNull();
    expect(root.querySelector('span')!.getAttribute('style')).toBeNull();
  });

  it('못 재는 풀이 하나 때문에 나머지를 포기하지 않는다', () => {
    const root = sheet('<p><span data-note="가">갑</span> <span data-note="나">을</span></p>');
    const measure = fake([{ left: 450, line: 1 }, { left: 450, line: 1 }]);
    const summary = layoutPhraseNotes(root, { ...measure, fragments: (span) => (span.textContent === '갑' ? [] : measure.fragments(span)) });
    expect(summary?.notes).toBe(1);
    expect(vars(root.querySelectorAll('span')[1]).dx).toBe('-52px');
  });

  it('자리가 그대로면 변수를 안 쓴다 — 구절 바로 밑이 기본이다', () => {
    const root = sheet('<p><span data-note="가">갑</span></p>');
    layoutPhraseNotes(root, fake([{ left: 100, line: 1, width: 40 }]));
    expect(vars(root.querySelector('span')!)).toEqual({ dx: '', shift: '', dy: '', strut: '', w: '' });
  });

  it('칸 끝을 넘는 풀이를 당긴다', () => {
    const root = sheet('<p><span data-note="가">갑</span></p>');
    layoutPhraseNotes(root, fake([{ left: 450, line: 1 }]));
    expect(vars(root.querySelector('span')!).dx).toBe('-52px');
  });

  it('풀이는 구절 밑 한가운데에 놓인다', () => {
    const root = sheet('<p><span data-note="가">갑</span></p>');
    layoutPhraseNotes(root, fake([{ left: 100, line: 1 }]));
    expect(vars(root.querySelector('span')!).dx).toBe('-30px');
  });

  it('⚠️ 겹치면 뒤 풀이를 구절 위로 올린다 — 둘 다 가운데에 남고 줄이 안 벌어진다', () => {
    const root = sheet('<p><span data-note="가">갑</span> <span data-note="나">을</span></p>');
    const summary = layoutPhraseNotes(root, fake([{ left: 100, line: 1, width: 150 }, { left: 200, line: 1, width: 150 }]));
    const [first, second] = Array.from(root.querySelectorAll('span'));
    expect(first.getAttribute('data-note-pos')).toBeNull();
    expect(second.getAttribute('data-note-pos')).toBe('over');
    expect(vars(second).shift).toBe('');
    expect(vars(second).dx).toBe('-55px');
    expect(summary?.maxRows).toBe(1);
  });

  it('⚠️ 다시 재면 올린 풀이를 저장된 자리로 되돌린다 — 폭이 바뀌어 안 겹치면 도로 아래다', () => {
    const root = sheet('<p><span data-note="가">갑</span> <span data-note="나">을</span></p>');
    layoutPhraseNotes(root, fake([{ left: 100, line: 1, width: 150 }, { left: 200, line: 1, width: 150 }]));
    layoutPhraseNotes(root, fake([{ left: 0, line: 1, width: 40 }, { left: 300, line: 1, width: 40 }]));
    const second = root.querySelectorAll('span')[1];
    expect(second.getAttribute('data-note-pos')).toBeNull();
    expect(second.getAttribute('data-note-raised')).toBeNull();
  });

  it('저장된 위 풀이는 다시 재도 그대로다', () => {
    const root = sheet('<p><span data-note="가" data-note-pos="over">갑</span></p>');
    layoutPhraseNotes(root, fake([{ left: 100, line: 1 }]));
    layoutPhraseNotes(root, fake([{ left: 100, line: 1 }]));
    expect(root.querySelector('span')!.getAttribute('data-note-pos')).toBe('over');
  });

  it('위쪽에 자리가 없으면 둘째 행으로 내리고, 행간이 모자라 그 줄을 늘린다', () => {
    const root = sheet('<p><span data-note="위">병</span><br><span data-note="가">갑</span> <span data-note="나">을</span></p>');
    const summary = layoutPhraseNotes(root, fake([{ left: 0, line: 0, width: 480 }, { left: 0, line: 1, width: 300 }, { left: 50, line: 1, width: 300 }]));
    const [, first, second] = Array.from(root.querySelectorAll('span'));
    expect(second.getAttribute('data-note-pos')).toBeNull();
    expect(vars(second).shift).toBe('14px');
    // 두 행 30px(2px 숨 포함) − 행간 20px = 10px 늘림, 받침은 줄 높이의 반을 더한 값
    expect(vars(first).strut).toBe('30px');
    expect(vars(second).strut).toBe('');
    expect(summary?.maxRows).toBe(2);
  });

  it('⚠️ 글자 크기가 달라도 행은 띠 하나의 높이로 맞춘다 — 제 크기로 재면 작은 풀이가 옆 행과 겹친다', () => {
    const root = sheet('<p><span data-note="위">병</span><br><span data-note="가">갑</span> <small><span data-note="나">을</span></small></p>');
    layoutPhraseNotes(root, fake([{ left: 0, line: 0, width: 480 }, { left: 0, line: 1, width: 300 }, { left: 50, line: 1, width: 300, row: 11, glyph: 16 }]));
    // 큰 풀이 행 14px + 작은 글자 밑이 큰 글자 밑보다 4px 위
    expect(vars(root.querySelectorAll('span')[2]).shift).toBe('18px');
  });

  it('작은 글자는 큰 글자와 같은 선에서 잰다 — 첫 행이어도 내려간다', () => {
    const root = sheet('<p><span data-note="가">갑</span> <small><span data-note="나">을</span></small></p>');
    layoutPhraseNotes(root, fake([{ left: 0, line: 1, width: 100 }, { left: 300, line: 1, width: 100, row: 11, glyph: 16 }]));
    const [big, small] = Array.from(root.querySelectorAll('span'));
    expect(vars(big).shift).toBe('');
    expect(vars(small).shift).toBe('4px');
  });

  it('바로 이은 줄의 아래·위 풀이가 한 띠면 재 놓은 줄 사이로 늘릴 양을 정한다', () => {
    const root = sheet('<p><span data-note="가">갑</span><br><span data-note="나" data-note-pos="over">을</span></p>');
    layoutPhraseNotes(root, fake([{ left: 0, line: 0, width: 300 }, { left: 10, line: 1, width: 300 }]));
    const [under, over] = Array.from(root.querySelectorAll('span'));
    expect(vars(under).strut).toBe('30px');
    expect(vars(over).strut).toBe('');
    expect(vars(under).shift).toBe('');
    expect(vars(over).shift).toBe('');
  });

  it('칸 맨 아랫줄의 풀이는 줄을 늘려 칸 안에 넣는다 — 아래로는 반쪽 행간뿐이다', () => {
    const root = sheet('<p><span data-note="가">갑</span></p>');
    layoutPhraseNotes(root, fake([{ left: 0, line: 2 }]));
    expect(vars(root.querySelector('span')!).strut).toBe('26px');
  });

  it('칸 맨 윗줄의 위 풀이도 같다', () => {
    const root = sheet('<p><span data-note="가" data-note-pos="over">갑</span></p>');
    layoutPhraseNotes(root, fake([{ left: 0, line: 0 }]));
    expect(vars(root.querySelector('span')!).strut).toBe('26px');
  });

  it('가운뎃줄 풀이 한 행은 행간에 들어가 받침이 없다', () => {
    const root = sheet('<p><span data-note="가">갑</span></p>');
    layoutPhraseNotes(root, fake([{ left: 0, line: 1 }]));
    expect(vars(root.querySelector('span')!).strut).toBe('');
  });

  it('꺾인 구절은 첫 조각이 길면 첫 조각 높이를 적어 그 밑에 놓는다', () => {
    const root = sheet('<p><span data-note="가">갑</span></p>');
    layoutPhraseNotes(root, fake([{ left: 0, line: 1, fragments: 2 }]));
    expect(vars(root.querySelector('span')!).dy).toBe(`${GLYPH}px`);
  });

  it('⚠️ 꺾인 구절은 끝 조각이 길면 그 밑 한가운데다 — `100%` 가 끝 조각 밑이라 세로 값을 안 쓴다', () => {
    const root = sheet('<p><span data-note="가">갑</span></p>');
    layoutPhraseNotes(root, fake([{ left: 300, line: 0, fragments: 2 }]));
    const { dx, dy } = vars(root.querySelector('span')!);
    expect(dy).toBe('');
    expect(dx).toBe('-180px');
  });

  /** 구절은 첫째 줄의 40px, 밑줄 줄은 둘째 줄까지 이어진다 */
  const longLine = (lines: { left: number; right: number; top: number; bottom: number }[]): NoteMeasure => ({
    ...fake([{ left: 300, line: 0 }]), lines: () => lines,
  });
  const ROW_0 = { left: 300, right: 500, top: 10, bottom: 30 };
  const ROW_1 = { left: 0, right: 400, top: 50, bottom: 70 };

  it('⚠️ 풀이의 기준은 밑줄 줄이다 — 낱말에 달렸어도 문장의 긴 줄 밑 한가운데에 놓는다', () => {
    const root = sheet('<p><span data-note="가"><u>갑</u></span><u>을</u></p>');
    layoutPhraseNotes(root, longLine([ROW_0, ROW_1]));
    const { dx, dy } = vars(root.querySelector('span')!);
    expect(dx).toBe('-150px');
    expect(dy).toBe('60px');
  });

  it('밑줄 줄의 첫 줄이 길면 그 밑이다', () => {
    const root = sheet('<p><span data-note="가"><u>갑</u></span><u>을</u></p>');
    layoutPhraseNotes(root, longLine([{ ...ROW_0, left: 0 }, { ...ROW_1, right: 100 }]));
    expect(vars(root.querySelector('span')!).dx).toBe('-100px');
  });

  it('저장된 위 풀이는 제 구절이 기준이다 — 낱말 하나를 가리킨다', () => {
    const root = sheet('<p><span data-note="가" data-note-pos="over"><u>갑</u></span><u>을</u></p>');
    layoutPhraseNotes(root, longLine([ROW_0, ROW_1]));
    expect(vars(root.querySelector('span')!).dx).toBe('-30px');
  });

  it('⚠️ 기준 줄이 구절 첫 조각이 아니면 빈 받침을 밑줄 끝에 넣는다 — `::before` 는 첫 조각 줄만 늘린다', () => {
    const root = sheet('<p><span data-note="가"><u>갑</u></span><u>을</u></p>');
    const measure = longLine([ROW_0, { ...ROW_1, top: 90, bottom: 110 }]);
    layoutPhraseNotes(root, measure);
    const strut = root.querySelector<HTMLElement>('.ref-note-strut')!;
    expect(strut.previousSibling?.textContent).toBe('을');
    expect(strut.style.getPropertyValue('--note-strut')).toBe('26px');
    expect(vars(root.querySelector('span')!).strut).toBe('');
    layoutPhraseNotes(root, measure);
    expect(root.querySelectorAll('.ref-note-strut')).toHaveLength(1);
  });

  it('⚠️ 저장된 위 풀이는 다시 써도 제 구절이 기준이다 — 밑줄 첫 줄로 바뀌면 윗줄 위로 올라간다', () => {
    const root = sheet('<p><u>앞 줄</u><span data-note="가" data-note-pos="over"><u>갑</u></span></p>');
    layoutPhraseNotes(root, { ...fake([{ left: 0, line: 1 }]), lines: () => [{ left: 200, right: 500, top: 10, bottom: 30 }, { left: 0, right: 100, top: 50, bottom: 70 }] });
    expect(vars(root.querySelector('span')!).shift).toBe('');
  });

  it('⚠️ 줄 끝에서 시작한 구절은 폭 0 조각을 기준에서 빼고, 받침은 글자가 있는 줄에 넣는다', () => {
    const root = sheet('<p>앞 <span data-note="가"><u>갑</u></span> 뒤</p>');
    const box = { left: 0, right: 500, top: 0, bottom: LINE * 2, lineHeight: LINE };
    const second = { left: 0, right: 60, top: LINE + 10, bottom: LINE + 30 };
    layoutPhraseNotes(root, {
      fragments: () => [{ left: 300, right: 300, top: 10, bottom: 30 }, second],
      lines: () => [second],
      note: () => ({ width: 100, height: ROW }),
      block: () => box,
    });
    const span = root.querySelector<HTMLElement>('span[data-note]')!;
    expect(vars(span)).toMatchObject({ dx: '-300px', dy: '', strut: '' });
    expect(span.querySelector('.ref-note-strut')?.previousSibling?.textContent).toBe('갑');
  });

  it('⚠️ 줄 끝에서 시작한 위 풀이의 받침은 첫 글자 바로 뒤다 — 앞에 두면 폭 0 조각을 따라 윗줄에 붙는다', () => {
    const root = sheet('<p>앞 <span data-note="가" data-note-pos="over"><u>양반의</u></span></p>');
    const line = { left: 0, right: 60, top: LINE + 10, bottom: LINE + 30 };
    const measure: NoteMeasure = {
      fragments: () => [{ left: 300, right: 300, top: 10, bottom: 30 }, line],
      lines: () => [line],
      note: () => ({ width: 40, height: ROW }),
      block: () => ({ left: 0, right: 500, top: LINE, bottom: LINE * 3, lineHeight: LINE }),
    };
    layoutPhraseNotes(root, measure);
    const u = root.querySelector('u')!;
    expect(Array.from(u.childNodes).map((node) => (node as HTMLElement).className ?? node.textContent)).toEqual(['양', 'ref-note-strut', '반의']);
    expect(u.firstChild?.textContent).toBe('양');
    expect(u.querySelector('.ref-note-strut')!.hasAttribute('data-over')).toBe(true);
    layoutPhraseNotes(root, measure);
    expect(u.querySelectorAll('.ref-note-strut')).toHaveLength(1);
    expect(u.textContent).toBe('양반의');
    expect(u.childNodes).toHaveLength(3);
  });

  it('⚠️ 구절이 공백 글자로 시작해도 받침은 첫 글자 옆이다 — 공백 노드는 줄바꿈 자리라 윗줄에 붙는다', () => {
    const root = sheet('<p>앞 <span data-note="가" data-note-pos="over"> <u>양반의</u></span></p>');
    const line = { left: 0, right: 60, top: LINE + 10, bottom: LINE + 30 };
    layoutPhraseNotes(root, {
      fragments: () => [{ left: 300, right: 300, top: 10, bottom: 30 }, line],
      lines: () => [line],
      note: () => ({ width: 40, height: ROW }),
      block: () => ({ left: 0, right: 500, top: LINE, bottom: LINE * 3, lineHeight: LINE }),
    });
    expect(root.querySelector('u .ref-note-strut')?.previousSibling?.textContent).toBe('양');
  });

  it('⚠️ 받침이 줄을 밀면 구절 밖 줄을 기준 삼은 풀이의 세로 값을 다시 쓴다', () => {
    const root = sheet('<p><span data-note="가"><u>갑</u></span><u>을</u></p>');
    let calls = 0;
    const measure: NoteMeasure = {
      ...fake([{ left: 300, line: 0 }]),
      lines: () => { calls += 1; return [ROW_0, calls === 1 ? ROW_1 : { ...ROW_1, top: 60, bottom: 80 }]; },
    };
    layoutPhraseNotes(root, measure);
    expect(vars(root.querySelector('span')!).dy).toBe('70px');
  });

  it('꺾인 위 구절은 첫 조각 높이가 필요 없다 — 인라인의 위쪽은 첫 조각이다', () => {
    const root = sheet('<p><span data-note="가" data-note-pos="over">갑</span></p>');
    layoutPhraseNotes(root, fake([{ left: 300, line: 1, fragments: 2 }]));
    expect(vars(root.querySelector('span')!).dy).toBe('');
  });

  it('칸보다 긴 풀이만 그 자리에서 꺾고, 꺾인 행 수만큼 자리를 잡는다', () => {
    const root = sheet('<p><span data-note="가">갑</span></p>');
    const summary = layoutPhraseNotes(root, fake([{ left: 0, line: 1, width: 700 }]));
    const span = root.querySelector('span')!;
    expect(span.getAttribute('data-note-fit')).toBe('wrap');
    expect(vars(span).w).toBe('386px');
    expect(summary).toEqual({ notes: 1, wrapped: 1, maxRows: 2 });
  });

  it('다시 돌리면 옛 값을 지우고 새로 잰다', () => {
    const root = sheet('<p><span data-note="가">갑</span></p>');
    layoutPhraseNotes(root, fake([{ left: 0, line: 1, width: 700 }]));
    layoutPhraseNotes(root, fake([{ left: 0, line: 1, width: 100 }]));
    const span = root.querySelector('span')!;
    expect(span.getAttribute('data-note-fit')).toBeNull();
    expect(span.getAttribute('style')).toBeNull();
  });

  it('칸이 다르면 서로 부딪히지 않는다', () => {
    const root = sheet('<p><span data-note="가">갑</span></p><p><span data-note="나">을</span></p>');
    layoutPhraseNotes(root, fake([{ left: 0, line: 1, width: 300 }, { left: 0, line: 1, width: 300 }]));
    root.querySelectorAll('span').forEach((span) => expect(vars(span).shift).toBe(''));
  });
});

describe('layoutPhraseNotesForPrint', () => {
  it('인쇄 치수를 붙인 채 재고 떼어 놓는다', () => {
    const root = sheet('<p><span data-note="가">갑</span></p>');
    const measure = fake([{ left: 450, line: 1 }]);
    let during = false;
    layoutPhraseNotesForPrint(root, {
      ...measure,
      block: (block) => {
        during = root.classList.contains('ref-sheet--print-metrics');
        return measure.block(block);
      },
    });
    expect(during).toBe(true);
    expect(root.classList.contains('ref-sheet--print-metrics')).toBe(false);
    expect(vars(root.querySelector('span')!).dx).toBe('-52px');
  });

  it('재다 터져도 클래스를 남기지 않는다', () => {
    const root = sheet('<p><span data-note="가">갑</span></p>');
    expect(() => layoutPhraseNotesForPrint(root, { ...fake([{ left: 0 }]), block: () => { throw new Error('x'); } })).toThrow();
    expect(root.classList.contains('ref-sheet--print-metrics')).toBe(false);
  });
});
