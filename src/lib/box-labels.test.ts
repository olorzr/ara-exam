import { describe, it, expect } from 'vitest';
import { BOX_LABEL_OPTIONS, boxKind, isBoxLabel, normalizeBoxAttributes, normalizeBoxLabel } from './box-labels';

describe('normalizeBoxLabel', () => {
  it('시험지 표기의 괄호를 벗긴다', () => {
    expect(normalizeBoxLabel('(가)')).toBe('가');
    expect(normalizeBoxLabel('[A]')).toBe('A');
    expect(normalizeBoxLabel('〈보기〉')).toBe('보기');
    expect(normalizeBoxLabel('【자료】')).toBe('자료');
  });

  it('전각·소문자를 표준으로 바꾼다', () => {
    expect(normalizeBoxLabel('（Ａ）')).toBe('A');
    expect(normalizeBoxLabel('[b]')).toBe('B');
  });

  it('번호가 붙은 〈보기 1〉을 살린다 — 발문에 보기가 둘 나오는 문항이 있다', () => {
    expect(normalizeBoxLabel('〈보기 1〉')).toBe('보기 1');
    expect(normalizeBoxLabel('보기1')).toBe('보기 1');
    expect(normalizeBoxLabel('〈보 기〉')).toBe('보기');
  });

  it('허용 목록 밖은 null — 인쇄 라벨에 임의 문구가 못 들어온다', () => {
    expect(normalizeBoxLabel('ⓐ')).toBeNull();
    expect(normalizeBoxLabel('아무거나')).toBeNull();
    expect(normalizeBoxLabel('F')).toBeNull();
    expect(normalizeBoxLabel('')).toBeNull();
    expect(normalizeBoxLabel('보기 0')).toBeNull();
  });
});

describe('isBoxLabel / boxKind', () => {
  it('세 종류를 가른다 — 인쇄 CSS 선택자와 1:1', () => {
    expect(boxKind('보기')).toBe('box');
    expect(boxKind('보기 2')).toBe('box');
    expect(boxKind('나')).toBe('paren');
    expect(boxKind('C')).toBe('bracket');
    expect(boxKind('(가)')).toBeNull();
  });

  it('정화기가 쓰는 검증기와 같은 목록이다', () => {
    expect(isBoxLabel('조건')).toBe(true);
    expect(isBoxLabel('카')).toBe(false);
  });

  it('(바)·(사)도 글 구분이다 — 실제 시험지가 (마)를 넘겨 쓴다', () => {
    expect(normalizeBoxLabel('(바)')).toBe('바');
    expect(boxKind('사')).toBe('paren');
    expect(boxKind('차')).toBe('paren');
    expect(normalizeBoxLabel('(카)')).toBeNull();
  });
});

describe('normalizeBoxAttributes', () => {
  it('본문 안 data-box 값을 다듬는다', () => {
    expect(normalizeBoxAttributes('<blockquote data-box="(가)"><p>글</p></blockquote>'))
      .toBe('<blockquote data-box="가"><p>글</p></blockquote>');
  });

  it('작은따옴표도 다룬다', () => {
    expect(normalizeBoxAttributes("<blockquote data-box='[A]'>글</blockquote>"))
      .toBe('<blockquote data-box="A">글</blockquote>');
  });

  it('여러 상자를 모두 다듬는다', () => {
    const out = normalizeBoxAttributes(
      '<blockquote data-box="〈보기 1〉">가</blockquote><blockquote data-box="(나)">나</blockquote>',
    );
    expect(out).toContain('data-box="보기 1"');
    expect(out).toContain('data-box="나"');
  });

  it('못 다듬는 값은 속성만 지우고 상자와 내용은 남긴다', () => {
    const out = normalizeBoxAttributes('<blockquote data-box="ⓐ"><p>글</p></blockquote>');
    expect(out).toBe('<blockquote><p>글</p></blockquote>');
  });

  it('따옴표 없는 값도 다듬는다 — HTML 로는 유효해서 정화기가 그 값을 읽고 지운다', () => {
    expect(normalizeBoxAttributes('<blockquote data-box=(가)><p>글</p></blockquote>'))
      .toBe('<blockquote data-box="가"><p>글</p></blockquote>');
    expect(normalizeBoxAttributes('<blockquote data-box=보기><p>글</p></blockquote>'))
      .toBe('<blockquote data-box="보기"><p>글</p></blockquote>');
    // 못 다듬는 값은 따옴표가 있을 때와 같이 속성만 지운다 → 발문이면 기본값(〈보기〉)이 받는다
    expect(normalizeBoxAttributes('<blockquote data-box=ⓐ><p>글</p></blockquote>'))
      .toBe('<blockquote><p>글</p></blockquote>');
  });

  it('빈 값·값 없는 속성은 지운다 — 정화기가 지우기 전에 걷어야 발문 기본값이 받는다(코덱스 4R)', () => {
    expect(normalizeBoxAttributes('<blockquote data-box=><p>글</p></blockquote>')).toBe('<blockquote><p>글</p></blockquote>');
    expect(normalizeBoxAttributes('<blockquote data-box=""><p>글</p></blockquote>')).toBe('<blockquote><p>글</p></blockquote>');
    expect(normalizeBoxAttributes('<blockquote data-box><p>글</p></blockquote>')).toBe('<blockquote><p>글</p></blockquote>');
    expect(normalizeBoxAttributes('<blockquote data-box = "(나)" class="x"><p>글</p></blockquote>'))
      .toBe('<blockquote data-box="나" class="x"><p>글</p></blockquote>');
  });

  it('본문 글자 data-box 는 건드리지 않는다 — 속성은 여는 태그 안에만 있다(코덱스 5R)', () => {
    const html = '<p>속성 이름은 <code> data-box </code> 이고 data-box= 라고도 쓴다</p><blockquote data-box=(가)><p>글</p></blockquote>';
    expect(normalizeBoxAttributes(html))
      .toBe('<p>속성 이름은 <code> data-box </code> 이고 data-box= 라고도 쓴다</p><blockquote data-box="가"><p>글</p></blockquote>');
  });

  it('data-box 가 없으면 원문 그대로 (흔한 경우라 빨리 빠진다)', () => {
    const html = '<p>보통 문단</p>';
    expect(normalizeBoxAttributes(html)).toBe(html);
  });
});

describe('BOX_LABEL_OPTIONS', () => {
  it('편집기 선택지는 인쇄 모양을 그대로 보여 준다', () => {
    expect(BOX_LABEL_OPTIONS[0]).toEqual({ value: '보기', label: '〈보기〉' });
    expect(BOX_LABEL_OPTIONS.map((o) => o.value)).toContain('A');
    expect(BOX_LABEL_OPTIONS.every((o) => isBoxLabel(o.value))).toBe(true);
  });
});
