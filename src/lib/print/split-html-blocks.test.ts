import { describe, expect, it } from 'vitest';
import { ROW_EVEN_ATTR, splitHtmlBlocks, splitTableByRows } from './split-html-blocks';

describe('splitHtmlBlocks', () => {
  it('최상위 요소 단위로 나눈다', () => {
    const blocks = splitHtmlBlocks('<h3>제목</h3><p>본문</p><ul><li>가</li></ul>');
    expect(blocks).toEqual(['<h3>제목</h3>', '<p>본문</p>', '<ul><li>가</li></ul>']);
  });

  it('빈 HTML 은 블록이 없다', () => {
    expect(splitHtmlBlocks('')).toEqual([]);
    expect(splitHtmlBlocks('   ')).toEqual([]);
  });

  it('표의 짝수 행에 줄무늬 표시를 남긴다 (표를 쪼개도 무늬가 유지되도록)', () => {
    const [table] = splitHtmlBlocks(
      '<table><tbody><tr><td>1</td></tr><tr><td>2</td></tr><tr><td>3</td></tr><tr><td>4</td></tr></tbody></table>',
    );
    const host = document.createElement('div');
    host.innerHTML = table;
    const marked = Array.from(host.querySelectorAll('tr')).map((row) => row.hasAttribute(ROW_EVEN_ATTR));
    expect(marked).toEqual([false, true, false, true]);
  });
});

describe('splitTableByRows', () => {
  const table =
    '<table><tbody>' +
    '<tr><th>단어</th><th>뜻</th></tr>' +
    '<tr><td>가</td><td>1</td></tr>' +
    '<tr><td>나</td><td>2</td></tr>' +
    '<tr><td>다</td><td>3</td></tr>' +
    '</tbody></table>';

  it('용량에 맞춰 조각 테이블로 나누고 헤더 행을 반복한다', () => {
    // 헤더 20 + 본문 각 30, 용량 60 → 조각당 본문 1행씩
    const chunks = splitTableByRows(table, [20, 30, 30, 30], 55);
    expect(chunks).toHaveLength(3);
    chunks.forEach((chunk) => {
      const host = document.createElement('div');
      host.innerHTML = chunk;
      const rows = host.querySelectorAll('tr');
      expect(rows).toHaveLength(2); // 헤더 + 본문 1행
      expect(rows[0].querySelector('th')?.textContent).toBe('단어');
    });
  });

  it('용량이 넉넉하면 한 조각으로 둔다', () => {
    const chunks = splitTableByRows(table, [20, 30, 30, 30], 500);
    expect(chunks).toHaveLength(1);
  });

  it('행이 하나뿐인 표는 그대로 둔다', () => {
    const single = '<table><tbody><tr><td>가</td></tr></tbody></table>';
    expect(splitTableByRows(single, [30], 10)).toEqual([single]);
  });

  it('조각을 합치면 원래 본문 행이 모두 남아 있다', () => {
    const chunks = splitTableByRows(table, [20, 30, 30, 30], 55);
    const cells = chunks.flatMap((chunk) => {
      const host = document.createElement('div');
      host.innerHTML = chunk;
      return Array.from(host.querySelectorAll('td')).map((cell) => cell.textContent);
    });
    expect(cells).toEqual(['가', '1', '나', '2', '다', '3']);
  });
});
