import { describe, expect, it } from 'vitest';
import { ROW_EVEN_ATTR, splitHtmlBlocks, splitTableByRows } from './split-html-blocks';

/** 조각 HTML 에서 행별 셀 텍스트를 뽑는다 */
function rowsOf(chunk: string): string[][] {
  const host = document.createElement('div');
  host.innerHTML = chunk;
  return Array.from(host.querySelectorAll('tr')).map((row) =>
    Array.from(row.children).map((cell) => cell.textContent ?? ''),
  );
}

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
    // 헤더 20 + 본문 각 30, 용량 55 → 조각당 본문 1행씩
    const chunks = splitTableByRows(table, [20, 30, 30, 30], 55);
    expect(chunks).toHaveLength(3);
    chunks.forEach((chunk) => {
      const rows = rowsOf(chunk);
      expect(rows).toHaveLength(2); // 헤더 + 본문 1행
      expect(rows[0][0]).toBe('단어');
    });
  });

  it('용량이 넉넉하면 한 조각으로 둔다', () => {
    const chunks = splitTableByRows(table, [20, 30, 30, 30], 500);
    expect(chunks).toEqual([table]);
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

  it('세로 병합(rowspan) 묶음을 가르지 않고 묶음 경계에서 자른다', () => {
    const merged =
      '<table><tbody>' +
      '<tr><th>구분</th><th>내용</th></tr>' +
      '<tr><td rowspan="2">묶음</td><td>가</td></tr>' +
      '<tr><td>나</td></tr>' +
      '<tr><td>따로</td><td>다</td></tr>' +
      '</tbody></table>';
    const chunks = splitTableByRows(merged, [20, 30, 30, 30], 85);
    expect(chunks).toHaveLength(2);
    // 병합 묶음(묶음/가 + 나)이 한 조각에 통째로 들어간다
    expect(rowsOf(chunks[0])).toEqual([['구분', '내용'], ['묶음', '가'], ['나']]);
    expect(rowsOf(chunks[1])).toEqual([['구분', '내용'], ['따로', '다']]);
    expect(chunks[0]).toContain('rowspan="2"');
  });

  it('굵은 글씨만 있는 첫 행도 제목으로 보고 반복한다 (편집기는 th 를 넣지 않는다)', () => {
    const strongHeader =
      '<table><tbody>' +
      '<tr><td><p><strong>단어</strong></p></td><td><p><strong>뜻</strong></p></td></tr>' +
      '<tr><td>가</td><td>1</td></tr>' +
      '<tr><td>나</td><td>2</td></tr>' +
      '</tbody></table>';
    const chunks = splitTableByRows(strongHeader, [20, 30, 30], 55);
    expect(chunks).toHaveLength(2);
    chunks.forEach((chunk) => expect(rowsOf(chunk)[0]).toEqual(['단어', '뜻']));
  });

  it('일부만 굵은 첫 행은 제목으로 보지 않는다', () => {
    const keyValue =
      '<table><tbody>' +
      '<tr><td><strong>갈래</strong></td><td>서정시</td></tr>' +
      '<tr><td><strong>성격</strong></td><td>서사적</td></tr>' +
      '<tr><td><strong>주제</strong></td><td>그리움</td></tr>' +
      '</tbody></table>';
    const chunks = splitTableByRows(keyValue, [30, 30, 30], 65);
    expect(chunks).toHaveLength(2);
    expect(rowsOf(chunks[0])).toEqual([['갈래', '서정시'], ['성격', '서사적']]);
    expect(rowsOf(chunks[1])).toEqual([['주제', '그리움']]);
  });

  it('제목 셀이 본문으로 뻗으면(rowspan) 반복하지 않는다', () => {
    const spanningHeader =
      '<table><tbody>' +
      '<tr><th rowspan="2">구분</th><th>내용</th></tr>' +
      '<tr><td>가</td></tr>' +
      '<tr><td>나</td><td>다</td></tr>' +
      '</tbody></table>';
    const chunks = splitTableByRows(spanningHeader, [30, 30, 30], 65);
    expect(chunks).toHaveLength(2);
    expect(rowsOf(chunks[0])).toEqual([['구분', '내용'], ['가']]);
    expect(rowsOf(chunks[1])).toEqual([['나', '다']]);
  });

  it('2행짜리 병합 제목은 두 행을 함께 반복한다', () => {
    const twoRowHeader =
      '<table><tbody>' +
      '<tr><th rowspan="2">구분</th><th colspan="2">내용</th></tr>' +
      '<tr><th>앞</th><th>뒤</th></tr>' +
      '<tr><td>1</td><td>가</td><td>나</td></tr>' +
      '<tr><td>2</td><td>다</td><td>라</td></tr>' +
      '</tbody></table>';
    const chunks = splitTableByRows(twoRowHeader, [20, 20, 30, 30], 75);
    expect(chunks).toHaveLength(2);
    chunks.forEach((chunk) => {
      const rows = rowsOf(chunk);
      expect(rows[0]).toEqual(['구분', '내용']);
      expect(rows[1]).toEqual(['앞', '뒤']);
    });
  });

  it('표가 블록 루트가 아니면 손대지 않는다 (래퍼가 사라진다)', () => {
    const wrapped = `<blockquote>${table}</blockquote>`;
    expect(splitTableByRows(wrapped, [20, 30, 30, 30], 55)).toEqual([wrapped]);
  });

  it('thead/tbody 로 나뉜 표도 행을 모두 보존한다', () => {
    const sectioned =
      '<table>' +
      '<thead><tr><th>단어</th><th>뜻</th></tr></thead>' +
      '<tbody><tr><td>가</td><td>1</td></tr><tr><td>나</td><td>2</td></tr></tbody>' +
      '</table>';
    const chunks = splitTableByRows(sectioned, [20, 30, 30], 55);
    expect(chunks).toHaveLength(2);
    chunks.forEach((chunk) => {
      const host = document.createElement('div');
      host.innerHTML = chunk;
      expect(host.querySelectorAll('tbody')).toHaveLength(1);
      expect(host.querySelectorAll('thead')).toHaveLength(0);
    });
    const bodyCells = chunks.flatMap((chunk) => rowsOf(chunk)[1]);
    expect(bodyCells).toEqual(['가', '1', '나', '2']);
  });

  it('줄무늬 표시가 조각에도 그대로 남는다', () => {
    const [marked] = splitHtmlBlocks(table);
    const chunks = splitTableByRows(marked, [20, 30, 30, 30], 55);
    const striped = chunks.map((chunk) => {
      const host = document.createElement('div');
      host.innerHTML = chunk;
      return Array.from(host.querySelectorAll('tr')).map((row) => row.hasAttribute(ROW_EVEN_ATTR));
    });
    // 각 조각 = [헤더(짝수 아님), 본문 1행] — 본문 행의 원본 인덱스에 따라 표시가 다르다
    expect(striped).toEqual([[false, true], [false, false], [false, true]]);
  });

  it('더 쪼갤 수 없으면 입력 문자열을 그대로 돌려준다 (재분할 루프 종료 조건)', () => {
    const unbreakable =
      '<table><tbody>' +
      '<tr><td rowspan="3">묶음</td><td>가</td></tr>' +
      '<tr><td>나</td></tr>' +
      '<tr><td>다</td></tr>' +
      '</tbody></table>';
    expect(splitTableByRows(unbreakable, [200, 200, 200], 100)).toEqual([unbreakable]);
  });

  it('열 너비를 주면 조각의 열 폭을 비율로 고정한다', () => {
    const chunks = splitTableByRows(table, [20, 30, 30, 30], 55, [300, 100]);
    const host = document.createElement('div');
    host.innerHTML = chunks[0];
    // 브라우저 CSSOM 이 끝자리 0 을 지우므로 문자열이 아니라 값으로 비교한다
    const widths = Array.from(host.querySelectorAll('col')).map((col) => (col as HTMLElement).style.width);
    expect(widths).toEqual(['75%', '25%']);
    expect(host.querySelector('table')?.style.tableLayout).toBe('fixed');
  });

  it('열 너비를 안 주면 colgroup 을 넣지 않는다', () => {
    const chunks = splitTableByRows(table, [20, 30, 30, 30], 55);
    expect(chunks[0]).not.toContain('<colgroup>');
    expect(chunks[0]).not.toContain('table-layout');
  });

  it('2단계 빈 박스로만 이뤄진 굵은 제목 행도 조각마다 반복한다', () => {
    // 개념어 전체가 마킹된 제목 행은 stage2 변환 뒤 텍스트가 비어 있다
    const box = '<span class="eb-blank-run"><span class="eb-stage2-box"></span></span>';
    const marked =
      '<table><tbody>' +
      `<tr><td><strong>${box}</strong></td><td><strong>${box}</strong></td></tr>` +
      '<tr><td>가</td><td>1</td></tr>' +
      '<tr><td>나</td><td>2</td></tr>' +
      '<tr><td>다</td><td>3</td></tr>' +
      '</tbody></table>';
    const chunks = splitTableByRows(marked, [20, 30, 30, 30], 55);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      const host = document.createElement('div');
      host.innerHTML = chunk;
      expect(host.querySelectorAll('tr')[0].querySelectorAll('.eb-stage2-box')).toHaveLength(2);
    });
  });

  it('3단계 밑줄(&nbsp;)만 있는 굵은 제목 행도 반복한다', () => {
    const blank = '<span class="eb-stage3-blank">\u00a0</span>';
    const marked =
      '<table><tbody>' +
      `<tr><td><strong>${blank}</strong></td><td><strong>${blank}</strong></td></tr>` +
      '<tr><td>가</td><td>1</td></tr>' +
      '<tr><td>나</td><td>2</td></tr>' +
      '</tbody></table>';
    const chunks = splitTableByRows(marked, [20, 30, 30], 55);
    expect(chunks).toHaveLength(2);
    chunks.forEach((chunk) => {
      const host = document.createElement('div');
      host.innerHTML = chunk;
      expect(host.querySelectorAll('.eb-stage3-blank')).toHaveLength(2);
    });
  });

  it('개념 표시가 굵은 글씨 밖에 있으면 제목 행이 아니다', () => {
    const box = '<span class="eb-blank-run"><span class="eb-stage2-box"></span></span>';
    const marked =
      '<table><tbody>' +
      `<tr><td><strong>구분</strong>${box}</td><td><strong>뜻</strong></td></tr>` +
      '<tr><td>가</td><td>1</td></tr>' +
      '<tr><td>나</td><td>2</td></tr>' +
      '</tbody></table>';
    const chunks = splitTableByRows(marked, [20, 30, 30], 55);
    // 제목으로 안 보므로 첫 행도 본문으로 배정된다 → 조각마다 반복되지 않는다
    const firstRowRepeats = chunks.filter((chunk) => chunk.includes('eb-stage2-box')).length;
    expect(firstRowRepeats).toBe(1);
  });

  it('내용이 전혀 없는 행은 여전히 제목으로 보지 않는다', () => {
    const empty =
      '<table><tbody>' +
      '<tr><td></td><td></td></tr>' +
      '<tr><td>가</td><td>1</td></tr>' +
      '<tr><td>나</td><td>2</td></tr>' +
      '</tbody></table>';
    const chunks = splitTableByRows(empty, [20, 30, 30], 55);
    const host = document.createElement('div');
    host.innerHTML = chunks[chunks.length - 1];
    expect(host.querySelectorAll('tr')).toHaveLength(1);
  });

  it('rowspan 없는 2행 th 제목도 두 행을 함께 반복한다 (묶음명 + 열 이름)', () => {
    const grouped =
      '<table><tbody>' +
      '<tr><th colspan="2">묶음</th></tr>' +
      '<tr><th>이름</th><th>값</th></tr>' +
      '<tr><td>가</td><td>1</td></tr>' +
      '<tr><td>나</td><td>2</td></tr>' +
      '</tbody></table>';
    const chunks = splitTableByRows(grouped, [20, 20, 30, 30], 55);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      const host = document.createElement('div');
      host.innerHTML = chunk;
      const rows = host.querySelectorAll('tr');
      expect(rows[0].textContent).toContain('묶음');
      expect(rows[1].textContent).toContain('이름');
    });
  });

  it('thead 안의 제목 행들도 함께 반복한다', () => {
    const withThead =
      '<table>' +
      '<thead><tr><td>묶음</td></tr><tr><td>이름</td></tr></thead>' +
      '<tbody><tr><td>가</td></tr><tr><td>나</td></tr></tbody>' +
      '</table>';
    const chunks = splitTableByRows(withThead, [20, 20, 30, 30], 55);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      const host = document.createElement('div');
      host.innerHTML = chunk;
      expect(host.querySelectorAll('tr')[1].textContent).toContain('이름');
    });
  });

  it('th 제목 뒤의 굵은 데이터 행은 제목으로 끌어오지 않는다', () => {
    const t =
      '<table><tbody>' +
      '<tr><th>구분</th><th>뜻</th></tr>' +
      '<tr><td><strong>가</strong></td><td><strong>1</strong></td></tr>' +
      '<tr><td>나</td><td>2</td></tr>' +
      '<tr><td>다</td><td>3</td></tr>' +
      '</tbody></table>';
    const chunks = splitTableByRows(t, [20, 30, 30, 30], 55);
    const withBold = chunks.filter((chunk) => chunk.includes('<strong>가</strong>')).length;
    expect(withBold).toBe(1);
  });

  it('제목을 더 가져가려다 실패하면 마지막 합법 지점으로 후퇴한다', () => {
    // row1 이 전부 th 라 이어가려 하지만 row2 까지 뻗어 있다 → row0 만 제목으로 남아야 한다
    const t =
      '<table><tbody>' +
      '<tr><th>구분</th><th>뜻</th></tr>' +
      '<tr><th rowspan="2">묶음</th><th>이름</th></tr>' +
      '<tr><th>값</th></tr>' +
      '<tr><td>가</td><td>1</td></tr>' +
      '<tr><td>나</td><td>2</td></tr>' +
      '<tr><td>다</td><td>3</td></tr>' +
      '</tbody></table>';
    const chunks = splitTableByRows(t, [20, 20, 20, 30, 30, 30], 65);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      const host = document.createElement('div');
      host.innerHTML = chunk;
      expect(host.querySelectorAll('tr')[0].textContent).toContain('구분');
    });
  });

  it('제목이 rowspan 으로 뻗은 첫 데이터 행(굵음)은 제목으로 승격하지 않는다', () => {
    const t =
      '<table><tbody>' +
      '<tr><th rowspan="2">구분</th><th>뜻</th></tr>' +
      '<tr><td><strong>가</strong></td></tr>' +
      '<tr><td>나</td><td>2</td></tr>' +
      '<tr><td>다</td><td>3</td></tr>' +
      '<tr><td>라</td><td>4</td></tr>' +
      '</tbody></table>';
    const chunks = splitTableByRows(t, [20, 20, 30, 30, 30], 65);
    const withData = chunks.filter((chunk) => chunk.includes('<strong>가</strong>')).length;
    expect(withData).toBe(1);
  });
});
