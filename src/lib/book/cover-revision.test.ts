import { describe, expect, it } from 'vitest';
import { bookCoverSignature } from './cover-revision';

describe('bookCoverSignature', () => {
  const base = bookCoverSignature({ student: { pages: 80, key: 'k1' } }, [{ paperId: 'p1', revision: 'v1' }]);

  it('같은 값이면 같다', () => {
    expect(bookCoverSignature({ student: { pages: 80, key: 'k1' } }, [{ paperId: 'p1', revision: 'v1' }])).toBe(base);
  });

  it('쪽 수가 비워지거나 담긴 문제지가 고쳐지면 달라진다', () => {
    expect(bookCoverSignature({}, [{ paperId: 'p1', revision: 'v1' }])).not.toBe(base);
    expect(bookCoverSignature({ student: { pages: 80, key: 'k1' } }, [{ paperId: 'p1', revision: 'v2' }])).not.toBe(base);
  });

  it('내지 화면(쪽 수 null)은 쪽 수가 바뀌어도 같고, 담긴 문제지가 고쳐지면 달라진다', () => {
    const inner = bookCoverSignature(null, [{ paperId: 'p1', revision: 'v1' }]);
    expect(bookCoverSignature(null, [{ paperId: 'p1', revision: 'v1' }])).toBe(inner);
    expect(bookCoverSignature(null, [{ paperId: 'p1', revision: 'v2' }])).not.toBe(inner);
  });
});

