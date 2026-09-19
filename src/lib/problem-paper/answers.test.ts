import { describe, it, expect } from 'vitest';
import {
  buildAnswerRows, correctChoiceIndex, EXPLANATION_INLINE_MAX_CHARS, explanationEntries,
  explanationHtml, explanationTextLength, formatAnswer, MISSING_ANSWER_LABEL, splitsExplanation,
} from './answers';
import type { PaperItemSnapshot } from '@/types/problem-bank';

function snap(over: Partial<PaperItemSnapshot> = {}): PaperItemSnapshot {
  return {
    number: 1, question_type: '객관식', stem_html: '<p>물음</p>',
    choices: ['가', '나', '다', '라', '마'], answer: '1', score: null,
    explanation_html: '', area_path: [], work_title: '', render_mode: 'text',
    image_path: '', figure_paths: [], passage: null,
    source: {
      source_type: '내신기출', title: '상현중 중간', school_name: '상현중',
      year: '2026', grade: '중2', exam_type: '중간', publisher: '',
    },
    ...over,
  };
}

describe('correctChoiceIndex', () => {
  it('객관식 정답 번호를 자리로 바꾼다', () => {
    expect(correctChoiceIndex('객관식', '3')).toBe(2);
    expect(correctChoiceIndex('객관식', ' 1 ')).toBe(0);
  });

  /** 주관식 답이 우연히 숫자일 수 있다 — 그걸 선지 자리로 읽으면 엉뚱한 선지가 정답이 된다 */
  it('주관식·서술형은 숫자여도 선지 자리가 아니다', () => {
    expect(correctChoiceIndex('주관식', '3')).toBeNull();
    expect(correctChoiceIndex('서술형', '3')).toBeNull();
  });

  it('번호가 아니면 null', () => {
    expect(correctChoiceIndex('객관식', '')).toBeNull();
    expect(correctChoiceIndex('객관식', '③')).toBeNull();
    expect(correctChoiceIndex('객관식', '1,3')).toBeNull();
  });
});

describe('formatAnswer', () => {
  /** 문제지에는 ①②③ 로 인쇄되는데 정답표만 '3' 이면 눈으로 맞출 때마다 셈을 해야 한다 */
  it('객관식은 선지 기호로 찍는다', () => {
    expect(formatAnswer('객관식', '3')).toBe('③');
  });

  it('주관식은 적어 둔 답 그대로', () => {
    expect(formatAnswer('주관식', ' 은유 ')).toBe('은유');
    expect(formatAnswer('객관식', '1,3')).toBe('1,3');
  });

  it('비었으면 미입력', () => {
    expect(formatAnswer('객관식', '   ')).toBe(MISSING_ANSWER_LABEL);
    expect(formatAnswer('서술형', '')).toBe(MISSING_ANSWER_LABEL);
  });
});

describe('buildAnswerRows', () => {
  it('번호는 문제지에서의 자리다 (원본 번호가 아니다)', () => {
    const rows = buildAnswerRows([snap({ number: 7, answer: '3' }), snap({ number: 9, answer: '1' })]);
    expect(rows.map((r) => r.number)).toEqual([1, 2]);
    expect(rows.map((r) => r.answer)).toEqual(['③', '①']);
  });

  it('배점은 담지 않는다', () => {
    expect(buildAnswerRows([snap({ score: 3 })])[0]).not.toHaveProperty('score');
  });
});

describe('explanationEntries', () => {
  it('해설이 있는 문항만 자리 번호와 함께 돌려준다', () => {
    const entries = explanationEntries([
      snap({ explanation_html: '' }),
      snap({ answer: '2', explanation_html: '<p>까닭</p>' }),
      snap({ explanation_html: '   ' }),
    ]);
    expect(entries).toEqual([{ number: 2, answer: '②', explanation_html: '<p>까닭</p>' }]);
  });

  /**
   * 해설 없는 문항을 '해설 없음' 으로 끼워 넣으면 답지 몇 쪽이 그 말로 채워지고
   * 정작 읽을 해설이 묻힌다 — 모든 답은 위쪽 빠른 정답 격자가 이미 보여 준다.
   */
  it('해설이 하나도 없으면 빈 배열 (자리를 만들지 않는다)', () => {
    expect(explanationEntries([snap(), snap()])).toEqual([]);
  });

  /** 옛 스냅샷에는 이 키가 아예 없을 수 있다 */
  it('해설 키가 없는 옛 스냅샷도 견딘다', () => {
    const legacy = { ...snap(), explanation_html: undefined } as unknown as PaperItemSnapshot;
    expect(explanationEntries([legacy])).toEqual([]);
  });
});

describe('splitsExplanation', () => {
  /**
   * ⚠️ 인쇄 블록은 쪼갤 수 없어서 한 쪽에 못 담으면 **통째로 축소**돼 찍힌다. 해설은
   *    길이에 상한이 없으므로(해설지를 통째로 읽어 온 문항이 있다) 긴 것을 문항 블록에
   *    담으면 문항·선지·답까지 깨알같이 줄어든다(코덱스 정지 리뷰).
   */
  it('긴 해설은 따로 흘려 보낸다', () => {
    expect(splitsExplanation(`<p>${'가'.repeat(EXPLANATION_INLINE_MAX_CHARS + 1)}</p>`)).toBe(true);
  });

  it('짧은 해설은 문항 블록에 붙인다 — 쪽 경계에서 떨어지지 않게', () => {
    expect(splitsExplanation('<p>주제는 그리움이다.</p>')).toBe(false);
    expect(splitsExplanation('')).toBe(false);
  });

  /** 태그가 길이를 부풀리면 짧은 해설이 공연히 갈린다 */
  it('길이는 태그를 걷고 센다', () => {
    const tagged = `<p><strong>${'가'.repeat(10)}</strong></p>`;
    expect(explanationTextLength(tagged)).toBe(10);
  });
});

describe('explanationHtml', () => {
  /**
   * ⚠️ 스냅샷은 jsonb 라 DB 를 직접 건드린 값이 섞일 수 있다. 정화가 통째로 지우는
   *    태그만 든 해설을 **날글자로** 재면 '길다' 고 판정해 갈라낸 뒤 그릴 것이 없어진다
   *    — 해설이 통째로 사라지는 경로였다(코덱스 정지 리뷰 2R).
   */
  it('정화가 지울 것만 들었으면 빈 문자열', () => {
    expect(explanationHtml(`<script>${'a'.repeat(500)}</script>`)).toBe('');
    expect(explanationHtml(undefined)).toBe('');
    expect(explanationHtml('   ')).toBe('');
  });

  it('그런 해설은 갈라내지도 않는다', () => {
    expect(splitsExplanation(`<script>${'a'.repeat(500)}</script>`)).toBe(false);
  });

  it('멀쩡한 해설은 정화해 돌려준다', () => {
    expect(explanationHtml('<p>주제는 <strong>그리움</strong>이다.</p>'))
      .toContain('<strong>그리움</strong>');
  });

  /** 글자가 없어도 그림·표만 든 해설은 실을 것이 있다 */
  it('글자 없이 표만 든 해설도 싣는다', () => {
    expect(explanationHtml('<table><tr><td></td></tr></table>')).not.toBe('');
  });
});
