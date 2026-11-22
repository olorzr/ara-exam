import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { buildPaperBlocks } from '@/lib/problem-paper/blocks';
import { EXPLANATION_INLINE_MAX_CHARS } from '@/lib/problem-paper/answers';
import type { PaperItemSnapshot, PaperSettings } from '@/types/problem-bank';
import { renderPaperBlocks } from './PaperPrintBlocks';

/**
 * 옛한글 글꼴의 범위 — 옛 글자가 든 문단·선지에만 걸린다.
 *
 * 원장님(2026-11-06): "어느 학교 기출인지 써 있는 거나 선지까지 굵기 처리가 되어 있어서 너무 이상해." 문항 뿌리에
 * 클래스가 붙으면 출처 줄·번호·현대어 선지까지 나눔 옛한글(획이 굵은 글꼴)로 바뀐다.
 */

/** ᄒᆞᆫ — 첫가끝 자모로 적은 옛한글 한 음절 */
const YET = 'ᄒᆞᆫ';

const SETTINGS: PaperSettings = { columns: 2, showScore: false, showSource: true, omr: false };

function snapshot(over: Partial<PaperItemSnapshot> = {}): PaperItemSnapshot {
  return {
    number: 1, question_type: '객관식', stem_html: '<p>물음</p>', choices: ['가', '나', '다', '라', '마'], answer: '1',
    score: null, explanation_html: '', area_path: [], work_title: '', render_mode: 'text', image_path: '',
    figure_paths: [], passage: null,
    source: {
      source_type: '내신기출', title: '', school_name: '효문고등학교', year: '2025', grade: '고1',
      semester: '2학기', exam_type: '중간', publisher: '',
    },
    ...over,
  };
}

function draw(item: PaperItemSnapshot, showAnswers = false, range?: { from: number; to: number }) {
  const blocks = buildPaperBlocks([item], showAnswers)
    .map((block) => (block.kind === 'problem' && range ? { ...block, range } : block));
  const nodes = renderPaperBlocks({ blocks, settings: SETTINGS, imageUrls: new Map(), showAnswers });
  return render(<div>{nodes}</div>).container;
}

describe('문제지 문항의 옛한글 글꼴', () => {
  it('문항 뿌리·출처 줄·번호에는 안 걸리고 옛 글자가 든 문단에만 걸린다', () => {
    const c = draw(snapshot({
      stem_html: `<p>중세 국어의 특징은?</p><blockquote data-box="보기"><p>${YET}</p><p>풀이</p></blockquote>`,
    }));
    expect(c.querySelector('.pb-q')?.className).not.toContain('yet-hangul');
    expect(c.querySelector('.pb-q__source')?.className).toBe('pb-q__source');
    expect(c.querySelector('.q-num')?.closest('.yet-hangul')).toBeNull();
    expect([...c.querySelectorAll('.yet-hangul')].map((el) => el.textContent)).toEqual([YET]);
  });

  it('선지는 옛 글자가 든 글자에만 걸리고 기호와 다른 선지는 그대로다', () => {
    const c = draw(snapshot({ choices: ['현대', `${YET}[뜻]`, '다', '라', '마'] }));
    const marked = [...c.querySelectorAll('.pb-q__choice .yet-hangul')];
    expect(marked.map((el) => el.textContent)).toEqual([`${YET}[뜻]`]);
    expect(c.querySelector('.pb-q__choice-glyph.yet-hangul')).toBeNull();
  });

  it('자모로 갈린 현대 글(NFD)에는 안 걸린다', () => {
    const nfd = '한글'.normalize('NFD');
    const c = draw(snapshot({ stem_html: `<p>${nfd}</p>`, choices: [nfd, '나', '다', '라', '마'] }));
    expect(c.querySelector('.yet-hangul')).toBeNull();
  });

  it('갈린 문항의 뒤 조각도 표시를 그대로 가진다', () => {
    const c = draw(snapshot({
      stem_html: `<p>물음</p><blockquote data-box="보기"><p>${YET}</p><p>현대</p></blockquote>`,
    }), false, { from: 1, to: 3 });
    expect([...c.querySelectorAll('blockquote[data-box="보기"] p')].map((p) => p.className)).toEqual(['yet-hangul', '']);
  });

  it('짧은 해설과 주관식 답도 옛 글자가 든 자리에만 걸린다', () => {
    const c = draw(snapshot({
      question_type: '주관식', choices: [], answer: YET, explanation_html: `<p>${YET}</p><p>풀이</p>`,
    }), true);
    expect(c.querySelector('.pb-q__answer .yet-hangul')?.textContent).toBe(YET);
    expect(c.querySelector('.pb-q__answer-label')?.closest('.yet-hangul')).toBeNull();
    expect([...c.querySelectorAll('.pb-q__explanation p')].map((p) => p.className)).toEqual(['yet-hangul', '']);
  });

  it('따로 흘러가는 긴 해설의 조각도 표시를 가진다', () => {
    const long = `<p>${YET}</p><p>${'해'.repeat(EXPLANATION_INLINE_MAX_CHARS + 50)}</p>`;
    const c = draw(snapshot({ explanation_html: long }), true);
    expect(c.querySelectorAll('.pb-q__explanation--part p.yet-hangul')).toHaveLength(1);
  });

  it('행렬 표 선지는 옛 글자가 든 칸에만 걸린다', () => {
    const c = draw(snapshot({
      stem_html: '<p>물음</p><p>㉠ ㉡</p>',
      choices: [`${YET}<br>가`, '나<br>다', '라<br>마', '바<br>사', '아<br>자'],
    }));
    expect([...c.querySelectorAll('.pb-q__paired-choices .yet-hangul')].map((el) => el.textContent)).toEqual([YET]);
    expect(c.querySelector('.pb-q')?.className).not.toContain('yet-hangul');
  });
});

/**
 * 〈보기〉 속 긴 줄바꿈 문단은 줄 묶음 단위로 나뉘어 그려진다(2026-11-15, 압구정중 17번). 묶음 사이 간격을 떼는
 * 표시(`pb-q__unit--joined`)는 같은 문단의 다음 묶음이 바로 뒤에 오는 단위에만 붙는다.
 */
describe('문제지 문항의 줄 묶음', () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => `줄${i + 1}`).join('<br>');

  it('긴 문단은 묶음마다 단위이고 마지막 묶음 말고는 이어짐 표시가 있다', () => {
    const c = draw(snapshot({ stem_html: `<p>물음</p><blockquote data-box="보기"><p>${lines(6)}</p></blockquote>` }));
    const units = [...c.querySelectorAll('.pb-q__stem > .pb-q__unit')];
    expect(units.map((el) => el.classList.contains('pb-q__unit--joined'))).toEqual([false, true, true, false]);
    expect(units.slice(1).map((el) => el.querySelector('blockquote')?.className)).toEqual([
      'pb-box-part pb-box-part--first', 'pb-box-part', 'pb-box-part pb-box-part--last',
    ]);
    expect(units.slice(1).map((el) => el.textContent).join('')).toBe('줄1줄2줄3줄4줄5줄6');
  });

  it('갈린 뒤 조각도 묶음 표시를 그대로 가진다', () => {
    const c = draw(snapshot({ stem_html: `<p>물음</p><blockquote data-box="보기"><p>${lines(6)}</p></blockquote>` }), false, { from: 2, to: 9 });
    const units = [...c.querySelectorAll('.pb-q__stem > .pb-q__unit')];
    expect(units.map((el) => el.classList.contains('pb-q__unit--joined'))).toEqual([true, false]);
  });

  it('짧은 문단에는 표시가 없다', () => {
    const c = draw(snapshot({ stem_html: `<p>물음</p><blockquote data-box="보기"><p>${lines(3)}</p></blockquote>` }));
    expect(c.querySelector('.pb-q__unit--joined')).toBeNull();
  });
});

/** 〈보기〉 안의 (가)(나) 처럼 겹친 상자도 문단마다 단위가 된다(0.9.92) — 단위마다 두 겹 틀이다 */
describe('문제지 문항의 겹친 상자', () => {
  const stem = '<p>물음</p><blockquote data-box="보기"><p>머리</p>'
    + '<blockquote data-box="가"><p>1</p><p>2</p></blockquote><blockquote data-box="나"><p>3</p></blockquote></blockquote>';

  it('안쪽 문단마다 단위이고 두 겹 틀을 두른다', () => {
    const c = draw(snapshot({ stem_html: stem }));
    const units = [...c.querySelectorAll('.pb-q__stem > .pb-q__unit')];
    expect(units).toHaveLength(5);
    expect(c.querySelectorAll('.pb-q [data-q-unit]').length).toBeGreaterThanOrEqual(5);
    expect(units.slice(2).map((el) => {
      const outer = el.querySelector(':scope > blockquote');
      const inner = outer?.querySelector(':scope > blockquote');
      return [outer?.getAttribute('data-box'), outer?.className, inner?.getAttribute('data-box'), inner?.className, inner?.textContent];
    })).toEqual([
      ['보기', 'pb-box-part pb-box-part--holds', '가', 'pb-box-part pb-box-part--first', '1'],
      ['보기', 'pb-box-part', '가', 'pb-box-part pb-box-part--last', '2'],
      ['보기', 'pb-box-part pb-box-part--last', '나', 'pb-box-part pb-box-part--first pb-box-part--last', '3'],
    ]);
  });

  it('안 겹친 단위에는 안쪽 틀이 없다', () => {
    const c = draw(snapshot({ stem_html: stem }));
    const second = c.querySelectorAll('.pb-q__stem > .pb-q__unit')[1];
    expect(second.querySelector(':scope > blockquote > blockquote')).toBeNull();
  });
});
