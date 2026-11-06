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
