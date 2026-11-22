import { describe, expect, it } from 'vitest';
import type { PaperItemSnapshot } from '@/types/problem-bank';
import {
  UNIT_CHARS_PER_LINE, UNSPLITTABLE_OVERFLOW_LINES, auditRecords, estimateLines, passageUnsplittables,
  questionUnsplittables, summarizeAudit,
} from './unsplittable-audit';

/** 한 줄을 꽉 채우는 글 */
const fullLine = (n: number) => '가'.repeat(UNIT_CHARS_PER_LINE * n);
const paras = (count: number) => Array.from({ length: count }, (_, i) => `<p>${'운봉 영장이 거동을 보고 '.repeat(3)}${i}</p>`).join('');

const snapshot = (over: Partial<PaperItemSnapshot> = {}): PaperItemSnapshot => ({
  number: 1, question_type: '객관식', stem_html: '<p>물음</p>', choices: ['가', '나'], answer: '1', score: null,
  explanation_html: '', area_path: [], work_title: '', render_mode: 'text', image_path: '', figure_paths: [], passage: null,
  source: { source_type: '내신기출', title: '', school_name: '성수고', year: '2026', grade: '고1', exam_type: '중간', publisher: '' },
  ...over,
});

describe('estimateLines', () => {
  it('줄바꿈과 문단마다 줄이 새로 시작하고, 긴 줄은 꺾인다', () => {
    expect(estimateLines(`<p>${fullLine(2)}</p><p>짧다<br>또</p>`)).toEqual({ chars: UNIT_CHARS_PER_LINE * 2 + 3, lines: 4 });
  });

  it('빈 문단은 세지 않는다', () => {
    expect(estimateLines('<p></p><p> </p>')).toEqual({ chars: 0, lines: 0 });
  });
});

describe('passageUnsplittables', () => {
  it('「춘향전」 꼴 — (가) 안의 [A] 는 이제 문단마다 갈려 큰 덩어리가 없다', () => {
    const html = `<blockquote data-box="가"><blockquote data-box="A">${paras(32)}</blockquote><p>뒤</p></blockquote>`;
    expect(passageUnsplittables(html)).toEqual([]);
  });

  it('문단 아닌 것이 낀 큰 안쪽 상자는 남은 덩어리로 잡는다', () => {
    const html = `<blockquote data-box="가"><blockquote data-box="A">${paras(30)}<ul><li>목록</li></ul></blockquote></blockquote>`;
    const [hit] = passageUnsplittables(html);
    expect(hit).toMatchObject({ where: 'passage', reason: 'nested-box' });
    expect(hit.estLines).toBeGreaterThanOrEqual(30);
  });

  it('재서 자를 수 있는 긴 문단은 덩어리가 아니다', () => {
    expect(passageUnsplittables(`<p>${'긴 문장이다. '.repeat(200)}</p>`)).toEqual([]);
  });

  it('자를 자리가 있어도 그 사이 조각이 크면 덩어리다 — 4천 자 첫 문장 뒤의 마침표 하나로 넘어가지 않는다(코덱스 1R)', () => {
    const [hit] = passageUnsplittables(`<p>${'가'.repeat(4000)}. 끝</p>`);
    expect(hit).toMatchObject({ where: 'passage', reason: 'prose' });
    expect(hit.estLines).toBeGreaterThan(UNSPLITTABLE_OVERFLOW_LINES);
  });

  it('자를 자리가 없는 긴 산문은 덩어리다', () => {
    expect(passageUnsplittables(`<p>${fullLine(40)}</p>`)[0]).toMatchObject({ reason: 'prose', estLines: 40 });
  });

  it('큰 표도 덩어리다', () => {
    const rows = Array.from({ length: 20 }, (_, i) => `<tr><td>${i}</td><td>칸</td></tr>`).join('');
    expect(passageUnsplittables(`<table><tbody>${rows}</tbody></table>`)[0]).toMatchObject({ reason: 'table', estLines: 20 });
  });
});

describe('questionUnsplittables', () => {
  it('발문의 〈보기〉 안 (가) 도 문단마다 단위라 덩어리가 없다', () => {
    const stem = `<p>물음</p><blockquote data-box="보기"><blockquote data-box="가">${paras(20)}</blockquote></blockquote>`;
    expect(questionUnsplittables(snapshot({ stem_html: stem }))).toEqual([]);
  });

  it('긴 선지도 한 덩어리로 잡는다', () => {
    const [hit] = questionUnsplittables(snapshot({ choices: ['가', fullLine(16)] }));
    expect(hit).toMatchObject({ where: 'choice', index: 1, reason: 'choice', estLines: 16 });
  });

  it('번호 머리와 다음 단위는 못 떼므로 더해서 잰다 — 25줄 둘이 50줄 한 덩어리다(코덱스 1R)', () => {
    const stem = `<p>${fullLine(25)}</p><p>${fullLine(25)}</p><p>짧은 끝</p>`;
    const [hit] = questionUnsplittables(snapshot({ stem_html: stem }));
    expect(hit).toMatchObject({ where: 'stem', index: 0, reason: 'prose', estLines: 50 });
  });

  it('머리 다음이 선지면 그 선지와 함께 잰다', () => {
    const [hit] = questionUnsplittables(snapshot({ choices: [fullLine(16), '나'] }));
    expect(hit).toMatchObject({ where: 'choice', index: 0, estLines: 17 });
  });
});

describe('auditRecords · summarizeAudit', () => {
  it('큰 것부터 늘어놓고 까닭별로 센다(넘침 문턱 이상은 따로)', () => {
    const findings = auditRecords([
      { key: 'a', passage: { html: `<p>${fullLine(20)}</p>` } },
      { key: 'b', passage: { html: `<p>${fullLine(UNSPLITTABLE_OVERFLOW_LINES + 2)}</p>` } },
      { key: 'c', question: snapshot() },
    ]);
    expect(findings.map((f) => f.key)).toEqual(['b', 'a']);
    expect(summarizeAudit(findings)).toEqual({ prose: { warn: 1, overflow: 1 } });
  });
});
