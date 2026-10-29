import { describe, expect, it } from 'vitest';
import type { ReferenceTextListItem } from '@/types/reference-text';
import { pickedFromReferenceText, referencePassageText } from './picked';

/** 작품 — 원문 + 여백 해설 + 말머리 상자 + 어휘 풀이 (평가문제집 쪽 모양) */
const WORK_HTML = [
  '<table data-layout="gloss"><tbody>',
  '<tr><td><p>바다에서 돌아온 배들이<br>닻을 내리고 쉬고 있다</p></td><td><p>1연: 귀가한 부모님</p></td></tr>',
  '</tbody></table>',
  '<blockquote data-callout="핵심 포인트" data-tone="point"><p>공간의 대조</p></blockquote>',
  '<table data-layout="vocab"><tbody><tr><td>현관</td><td>집의 문간.</td></tr></tbody></table>',
].join('');

/** 개념 — 말머리 상자 · 어휘 표 · 도식이 곧 내용이다 */
const CONCEPT_HTML = [
  '<blockquote data-callout="학습 목표" data-tone="goal"><p>비유의 효과를 안다.</p></blockquote>',
  '<p>비유는 대상을 다른 대상에 빗대어 표현하는 방법이다.</p>',
  '<table data-layout="vocab"><tbody><tr><td>원관념</td><td>표현하려는 대상</td></tr></tbody></table>',
  '<ul data-flow="right"><li><p>원관념</p></li><li><p>보조 관념</p></li></ul>',
].join('');

const row = (over: Partial<ReferenceTextListItem> = {}): ReferenceTextListItem => ({
  id: 't1', title: '저녁 항구', author: '함기석', kind: '작품', format: 'html', seq: 30, tags: [],
  source_key: null, char_count: 100,
  units: [
    { grade: '중2', textbook: '천재(노미숙)', semester: '1학기', unit_path: ['1. 문학의 즐거움', '(1) 시의 표현'] },
    { grade: '중2', textbook: '동아', semester: '1학기', unit_path: ['2. 다른 단원'] },
  ],
  grammar_paths: [], note: '', user_id: 'u', updated_by: null, created_at: '', updated_at: '',
  ...over,
});

describe('referencePassageText', () => {
  it('작품은 해설·상자·어휘를 걷고 원문만 남긴다 — 출판사 풀이가 지문으로 찍히면 안 된다', () => {
    const text = referencePassageText('작품', { body: WORK_HTML, format: 'html' });
    expect(text).toBe('바다에서 돌아온 배들이\n닻을 내리고 쉬고 있다');
    expect(text).not.toContain('귀가한 부모님');
    expect(text).not.toContain('공간의 대조');
    expect(text).not.toContain('집의 문간');
  });

  it('⚠️ 개념은 상자·어휘 표·도식 내용을 그대로 남긴다 — 걷으면 빈 글이 된다', () => {
    const text = referencePassageText('개념', { body: CONCEPT_HTML, format: 'html' });
    expect(text).toContain('비유의 효과를 안다.');
    expect(text).toContain('원관념 · 표현하려는 대상');
    expect(text).toContain('- 보조 관념');
    expect(text).toContain('비유는 대상을');
  });

  it('개념의 말머리 이름을 글로 꺼내 상자 머리에 둔다', () => {
    const text = referencePassageText('개념', { body: CONCEPT_HTML, format: 'html' });
    expect(text.startsWith('[학습 목표]\n\n비유의 효과를 안다.')).toBe(true);
  });

  it('평문 본문은 그대로다', () => {
    expect(referencePassageText('작품', { body: '진달래꽃\n\n나 보기가', format: 'text' })).toBe('진달래꽃\n\n나 보기가');
    expect(referencePassageText('개념', { body: '비유란', format: 'text' })).toBe('비유란');
  });
});

describe('pickedFromReferenceText', () => {
  it('제목·지은이와 첫 단원을 신호로 싣고, 전문에서 왔다고 밝힌다', () => {
    const picked = pickedFromReferenceText(row(), { body: WORK_HTML, format: 'html' });
    expect(picked.title).toBe('저녁 항구');
    expect(picked.author).toBe('함기석');
    expect(picked.meta).toEqual({
      id: 't1', source: 'text',
      unitPath: ['1. 문학의 즐거움', '(1) 시의 표현'], textbook: '천재(노미숙)', grade: '중2',
      schoolName: '', year: '',
    });
  });

  it('단원이 없으면 단원 신호도 비운다', () => {
    const picked = pickedFromReferenceText(row({ units: [], kind: '개념', author: '' }), { body: '비유', format: 'text' });
    expect(picked.meta.unitPath).toEqual([]);
    expect(picked.meta.textbook).toBe('');
    expect(picked.author).toBe('');
  });
});
