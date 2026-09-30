import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from './html-entities';

describe('decodeHtmlEntities', () => {
  it('다섯 엔티티를 글자로 되돌린다', () => {
    expect(decodeHtmlEntities('&lt;보기&gt;')).toBe('<보기>');
    expect(decodeHtmlEntities('A&amp;B')).toBe('A&B');
    expect(decodeHtmlEntities('가&nbsp;나')).toBe('가 나');
    expect(decodeHtmlEntities('&quot;봄&quot;')).toBe('"봄"');
    expect(decodeHtmlEntities('&#39;봄&#39;')).toBe("'봄'");
  });

  it('& 를 마지막에 푼다 — &amp;lt; 는 한 번만 풀려 &lt; 로 남는다', () => {
    expect(decodeHtmlEntities('&amp;lt;')).toBe('&lt;');
  });

  it('엔티티가 없으면 그대로', () => {
    expect(decodeHtmlEntities('〈보기〉 「봄봄」')).toBe('〈보기〉 「봄봄」');
    expect(decodeHtmlEntities('')).toBe('');
  });
});
