import { describe, expect, it } from 'vitest';
import { referenceBodyPlainText, stripWorkbookNotes } from './workbook-plain';

/** 「저녁 항구」(함기석) — 노미숙 평가문제집 10쪽: 연마다 여백 해설 + 핵심 포인트 + 쌤의 비밀 노트 */
const POEM = [
  '<table data-layout="gloss"><tbody>',
  '<tr><td><p>바다에서 돌아온 배들이<br>닻을 내리고 쉬고 있다 우리 집 현관에서</p><p>아빠 구두는 고래잡이 통통배<br>엄마 구두는 새우잡이 뾰족배</p></td>',
  '<td><p>1~2연: 귀가한 부모님의 구두가 현관에 놓여 있음.</p></td></tr>',
  '<tr><td>열린 문틈으로 푸른 파도가 밀려오고</td><td><p>3연: 부모님의 삶의 모습을 상상함.</p></td></tr>',
  '</tbody></table>',
  '<blockquote data-callout="핵심 포인트" data-tone="point"><h4>공간의 대조</h4><table><tbody><tr><th>바다</th><td>수고로운 현실</td></tr></tbody></table>',
  '<blockquote data-box="보기"><p>안쪽 상자</p></blockquote></blockquote>',
  '<blockquote data-callout="쌤의 비밀 노트" data-tone="note"><p>원관념과 보조 관념…</p></blockquote>',
  '<table data-layout="vocab"><tbody><tr><td>현관</td><td>집의 문간.</td></tr></tbody></table>',
  '<ul data-flow="right"><li><p>문 바깥</p></li><li><p>집 안</p></li></ul>',
  '<p>배 바닥에 긁힌 <mark>암초 자국들</mark><br>오랫동안 바라본다</p>',
].join('');

describe('stripWorkbookNotes', () => {
  it('해설·상자·어휘·도식을 걷고 원문만 남긴다', () => {
    const out = stripWorkbookNotes(POEM);
    expect(out).toBe(
      '<p>바다에서 돌아온 배들이<br>닻을 내리고 쉬고 있다 우리 집 현관에서</p><p>아빠 구두는 고래잡이 통통배<br>엄마 구두는 새우잡이 뾰족배</p>'
      + '<p>열린 문틈으로 푸른 파도가 밀려오고</p>'
      + '<p>배 바닥에 긁힌 암초 자국들<br>오랫동안 바라본다</p>',
    );
  });

  it('⚠️ 상자 안에 〈보기〉 상자가 있어도 바깥 상자의 끝을 정확히 찾는다', () => {
    expect(stripWorkbookNotes(POEM)).not.toContain('안쪽 상자');
    expect(stripWorkbookNotes(POEM)).not.toContain('</blockquote>');
  });

  it('말머리 없는 〈보기〉·(가) 상자는 원문이라 남긴다', () => {
    const html = '<blockquote data-box="가"><p>(가) 시</p></blockquote>';
    expect(stripWorkbookNotes(html)).toBe(html);
  });

  it('⚠️ 원문 칸이 두 줄을 덮으면(rowspan) 다음 줄의 첫 칸은 해설이다 — 원문으로 새지 않는다', () => {
    const html = '<table data-layout="gloss"><tbody>'
      + '<tr><td rowspan="2"><p>원문 한 연</p></td><td><p>해설 하나</p></td></tr>'
      + '<tr><td><p>해설 둘</p></td></tr>'
      + '<tr><td><p>다음 연</p></td><td><p>해설 셋</p></td></tr></tbody></table>';
    expect(referenceBodyPlainText(html, 'html')).toBe('원문 한 연\n\n다음 연');
  });

  it('⚠️ 원문 칸 안에 또 든 여백 해설 표·말머리 상자도 걷는다', () => {
    const html = '<table data-layout="gloss"><tbody><tr><td>'
      + '<table data-layout="gloss"><tbody><tr><td><p>안쪽 원문</p></td><td><p>안쪽 해설</p></td></tr></tbody></table>'
      + '<blockquote data-callout="쌤의 비밀 노트"><p>노트</p></blockquote><p>바깥 원문</p>'
      + '</td><td><p>바깥 해설</p></td></tr></tbody></table>';
    expect(referenceBodyPlainText(html, 'html')).toBe('안쪽 원문\n\n바깥 원문');
  });

  it('나란히 표(verse)는 원문이라 남긴다', () => {
    const html = '<table data-layout="verse"><tbody><tr><td>生死路隱</td><td>생사 길은</td></tr></tbody></table>';
    expect(stripWorkbookNotes(html)).toBe(html);
  });
});

describe('referenceBodyPlainText', () => {
  it('서식이면 연은 빈 줄, 행은 줄바꿈 — 옛 평문 작품과 같은 모양', () => {
    expect(referenceBodyPlainText(POEM, 'html')).toBe([
      '바다에서 돌아온 배들이\n닻을 내리고 쉬고 있다 우리 집 현관에서',
      '아빠 구두는 고래잡이 통통배\n엄마 구두는 새우잡이 뾰족배',
      '열린 문틈으로 푸른 파도가 밀려오고',
      '배 바닥에 긁힌 암초 자국들\n오랫동안 바라본다',
    ].join('\n\n'));
  });

  it('평문이면 그대로', () => {
    expect(referenceBodyPlainText('가\n\n나', 'text')).toBe('가\n\n나');
  });

  it('해설 글자가 하나도 섞이지 않는다', () => {
    const plain = referenceBodyPlainText(POEM, 'html');
    for (const note of ['1~2연', '3연', '핵심 포인트', '원관념', '집의 문간', '문 바깥']) expect(plain).not.toContain(note);
  });
});
