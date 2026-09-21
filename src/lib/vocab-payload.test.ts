import { describe, it, expect } from 'vitest';
import { buildVocabWords, type VocabPayloadRow } from './vocab-payload';
import { CHOICE_COUNT, CHOICE_LABELS, generateChoices, getCorrectLabel } from './exam-choices';

function makeRow(id: string, word: string, orderIndex: number): VocabPayloadRow {
  return { id, word, meaning: `${word}-뜻`, order_index: orderIndex };
}

const ROWS: VocabPayloadRow[] = [
  makeRow('w1', '가치관', 0),
  makeRow('w2', '개연성', 1),
  makeRow('w3', '견문', 2),
  makeRow('w4', '경외', 3),
  makeRow('w5', '고찰', 4),
  makeRow('w6', '관조', 5),
];

describe('buildVocabWords', () => {
  it('문항마다 주관식·객관식 정답을 함께 싣는다', () => {
    const payload = buildVocabWords(ROWS);

    expect(payload).toHaveLength(ROWS.length);
    payload.forEach((item, idx) => {
      expect(item.no).toBe(idx + 1);
      expect(item.answer).toBe(ROWS[idx].word);
      expect(item.type).toBe('주관식');
      expect(item.choices).toHaveLength(CHOICE_COUNT);
      expect(item.mcAnswer).toMatch(/^[1-5]$/);
    });
  });

  // 이게 이 모듈의 존재 이유다 — 인쇄된 시험지(MultipleChoiceView)와 성적 시스템의 정답표가
  // 한 문항이라도 어긋나면 OMR 채점이 통째로 틀어진다.
  it('시험지가 그리는 선지·정답과 전 문항이 일치한다', () => {
    const payload = buildVocabWords(ROWS);

    payload.forEach((item, idx) => {
      // 화면과 같은 호출: 같은 배열, 배열 위치를 문항 인덱스로.
      const shown = generateChoices(ROWS[idx], ROWS, idx);
      expect(item.choices).toEqual(shown.map((c) => c.word));

      const label = getCorrectLabel(ROWS[idx], ROWS, idx);
      expect(item.mcAnswer).toBe(String(CHOICE_LABELS.indexOf(label as never) + 1));
      // 보기 번호가 가리키는 선지가 실제로 정답이어야 한다.
      expect(item.choices![Number(item.mcAnswer) - 1]).toBe(ROWS[idx].word);
    });
  });

  it('같은 입력에는 항상 같은 결과를 낸다(결정론)', () => {
    expect(buildVocabWords(ROWS)).toEqual(buildVocabWords(ROWS));
  });

  it('선지를 5개 못 채우는 문항은 객관식 정보를 빼고 주관식으로만 보낸다', () => {
    // 서로 다른 표기가 3개뿐 — dedupe 후 방해지가 모자란다.
    const few: VocabPayloadRow[] = [
      makeRow('a', '가치관', 0),
      makeRow('b', '가치관', 1),
      makeRow('c', '개연성', 2),
      makeRow('d', '견문', 3),
    ];
    const payload = buildVocabWords(few);

    expect(payload).toHaveLength(4);
    payload.forEach((item) => {
      expect(item.answer).toBeTruthy();
      expect(item.mcAnswer).toBeUndefined();
      expect(item.choices).toBeUndefined();
    });
  });

  it('order_index 가 배열 위치와 어긋나면 던진다', () => {
    // 정렬이 깨진 채 통과하면 시험지와 정답표가 조용히 달라진다.
    const misordered = [makeRow('w1', '가치관', 0), makeRow('w2', '개연성', 5)];
    expect(() => buildVocabWords(misordered)).toThrow(/순서가 어긋났습니다/);
  });

  it('빈 배열은 빈 payload 를 낸다', () => {
    expect(buildVocabWords([])).toEqual([]);
  });
});
