import { describe, it, expect } from 'vitest';
import { OCR_HTML_MAX } from '@/lib/problem-ocr/constants';
import { finalizePrintHtml, joinPageHtml, parsePrintOcrDraft } from './parse';

const raw = (value: unknown) => JSON.stringify(value);

describe('parsePrintOcrDraft', () => {
  it('쪽별 본문과 경고를 그대로 가져온다', () => {
    const draft = parsePrintOcrDraft(
      raw({ pages: [{ page: 2, html: '<p>나</p>' }, { page: 1, html: '<p>가</p>' }], warnings: ['흐려요'] }),
      { pages: [1, 2] },
    );
    expect(draft?.pages.map((p) => p.page)).toEqual([1, 2]);
    expect(draft?.warnings).toEqual(['흐려요']);
  });

  it('모양이 깨지면 null — 부분만 저장하지 않는다', () => {
    expect(parsePrintOcrDraft('{', { pages: [1] })).toBeNull();
    expect(parsePrintOcrDraft(raw({ warnings: [] }), { pages: [1] })).toBeNull();
  });

  it('보내지 않은 쪽은 버리고 알린다 — 본 적 없는 쪽은 지어낸 것이다', () => {
    const draft = parsePrintOcrDraft(
      raw({ pages: [{ page: 1, html: '<p>가</p>' }, { page: 9, html: '<p>없음</p>' }], warnings: [] }),
      { pages: [1] },
    );
    expect(draft?.pages).toHaveLength(1);
    expect(draft?.warnings.join()).toContain('9쪽');
  });

  it('빠진 쪽은 빈 자리를 만들고 알린다 — 조용히 건너뛰면 시험지에서만 사라진다', () => {
    const draft = parsePrintOcrDraft(raw({ pages: [{ page: 1, html: '<p>가</p>' }], warnings: [] }), {
      pages: [1, 2],
    });
    expect(draft?.pages.map((p) => p.page)).toEqual([1, 2]);
    expect(draft?.pages[1].html).toBe('');
    expect(draft?.warnings.join()).toContain('2쪽 내용을 받지 못했어요');
    // 자리만 만든 쪽은 표시해 둔다 — 뒤에서 같은 쪽을 또 경고하면 같은 말이 두 번 나간다
    expect(draft?.pages[1].missing).toBe(true);
    expect(draft?.pages[0].missing).toBeUndefined();
  });

  it('빠진 쪽 경고는 맨 앞에 둔다 — 상한에 잘리면 그 사실이 어디에도 안 남는다', () => {
    const many = Array.from({ length: 30 }, (_, i) => `모델 경고 ${i}`);
    const draft = parsePrintOcrDraft(
      raw({ pages: [{ page: 1, html: '<p>가</p>' }], warnings: many }),
      { pages: [1, 2] },
    );
    expect(draft?.warnings[0]).toContain('2쪽 내용을 받지 못했어요');
  });

  it('같은 쪽이 두 번 오면 먼저 온 것을 쓴다', () => {
    const draft = parsePrintOcrDraft(
      raw({ pages: [{ page: 1, html: '<p>먼저</p>' }, { page: 1, html: '<p>나중</p>' }], warnings: [] }),
      { pages: [1] },
    );
    expect(draft?.pages).toHaveLength(1);
    expect(draft?.pages[0].html).toContain('먼저');
  });

  it('너무 긴 본문은 자르고 **반드시** 알린다', () => {
    const long = `<p>${'가'.repeat(OCR_HTML_MAX + 500)}</p>`;
    const draft = parsePrintOcrDraft(raw({ pages: [{ page: 1, html: long }], warnings: [] }), {
      pages: [1],
    });
    expect(draft?.pages[0].html.length).toBeLessThanOrEqual(OCR_HTML_MAX);
    expect(draft?.warnings.join()).toContain('잘렸어요');
  });

  it('빈 문단 표기를 통일한다 — 인쇄에서 한 줄 높이를 주려면 모양이 같아야 한다', () => {
    const draft = parsePrintOcrDraft(
      raw({ pages: [{ page: 1, html: '<p>가</p><p> </p><p><br></p>' }], warnings: [] }),
      { pages: [1] },
    );
    expect(draft?.pages[0].html).toBe('<p>가</p><p></p><p></p>');
  });
});

describe('joinPageHtml', () => {
  it('여러 번에 나눠 읽은 결과를 쪽 번호 순서로 잇는다 — 온 순서를 믿지 않는다', () => {
    const joined = joinPageHtml([
      { pages: [{ page: 3, html: '<p>다</p>' }], warnings: [] },
      { pages: [{ page: 1, html: '<p>가</p>' }, { page: 2, html: '<p>나</p>' }], warnings: [] },
    ]);
    expect(joined).toBe('<p>가</p>\n<p>나</p>\n<p>다</p>');
  });

  it('빈 쪽은 건너뛴다 — 빈 문단만 남으면 시험지 끝에 빈 장이 생긴다', () => {
    expect(joinPageHtml([{ pages: [{ page: 1, html: '' }, { page: 2, html: '<p>나</p>' }], warnings: [] }]))
      .toBe('<p>나</p>');
  });
});

describe('finalizePrintHtml', () => {
  it('개념지가 쓰는 서식은 남긴다', () => {
    const html = finalizePrintHtml(
      '<h3>제목</h3><p><u>밑줄</u> <strong>굵게</strong></p>'
      + '<table><tbody><tr><td>칸</td></tr></tbody></table><blockquote>상자</blockquote>',
    );
    expect(html).toContain('<u>밑줄</u>');
    expect(html).toContain('<table>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<h3>');
  });

  it('편집기가 못 받는 것은 지운다 — 프롬프트가 금지한 것과 같은 목록이다', () => {
    const html = finalizePrintHtml(
      '<p class="x">글</p><img src="x"><figure data-figure="1"></figure>'
      + '<blockquote data-box="보기">상자</blockquote><script>alert(1)</script>',
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<figure');
    expect(html).not.toContain('class=');
    expect(html).not.toContain('data-box');
    expect(html).not.toContain('<script');
    // 내용 자체는 살아 있어야 한다
    expect(html).toContain('글');
    expect(html).toContain('상자');
  });
});
