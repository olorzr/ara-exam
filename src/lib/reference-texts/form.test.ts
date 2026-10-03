import { describe, it, expect } from 'vitest';
import { REFERENCE_NOTE_MAX, REFERENCE_TEXT_BODY_MAX } from './constants';
import {
  EMPTY_REFERENCE_DRAFT, draftFromReferenceText, normalizeBody, referenceDraftBlocker,
  referenceDraftEquals, toReferenceTextPayload,
} from './form';
import type { ReferenceUnit } from '@/types/reference-text';

const unit = (over: Partial<ReferenceUnit> = {}): ReferenceUnit => ({
  grade: '중2', textbook: '천재(노미숙)', semester: '1학기', unit_path: ['1. 문학'], ...over,
});

const draft = (over: Partial<typeof EMPTY_REFERENCE_DRAFT> = {}) => ({
  ...EMPTY_REFERENCE_DRAFT, title: '봄봄', body: '장인님! 인제 저…', ...over,
});

describe('normalizeBody', () => {
  it('줄바꿈은 지킨다 — 시는 행갈이가 곧 내용이다', () => {
    expect(normalizeBody('나 보기가\n역겨워')).toBe('나 보기가\n역겨워');
  });

  it('기기마다 다른 줄바꿈을 한 모양으로 맞춘다', () => {
    expect(normalizeBody('가\r\n나\r다')).toBe('가\n나\n다');
  });

  it('줄 끝의 보이지 않는 공백을 뗀다', () => {
    expect(normalizeBody('가   \n나\t')).toBe('가\n나');
  });

  it('빈 줄이 셋 이상이면 둘로 줄인다 — PDF 에서 옮기면 잔뜩 생긴다', () => {
    expect(normalizeBody('가\n\n\n\n나')).toBe('가\n\n나');
    // 연을 나누는 빈 줄 하나는 그대로 둔다
    expect(normalizeBody('가\n\n나')).toBe('가\n\n나');
  });

  it('자모가 갈린 글자를 되돌린다 — 맥에서 복사하면 그렇게 온다', () => {
    expect(normalizeBody('한글'.normalize('NFD'))).toBe('한글');
  });
});

describe('referenceDraftBlocker', () => {
  it('제목이 없으면 막는다 — 자동 매칭이 지문과 맞춰 보는 유일한 열쇠다', () => {
    expect(referenceDraftBlocker(draft({ title: '  ' }))).toContain('작품 제목을 적어 주세요');
  });

  it('본문이 없으면 막는다', () => {
    expect(referenceDraftBlocker(draft({ body: '\n\n' }))).toContain('붙여 넣거나 파일에서');
  });

  it('너무 길면 저장 전에 알린다', () => {
    expect(referenceDraftBlocker(draft({ body: 'ㄱ'.repeat(REFERENCE_TEXT_BODY_MAX + 1) })))
      .toContain('너무 길어요');
  });

  it('제목과 본문이 있으면 저장할 수 있다 — 분류는 비어 있어도 된다', () => {
    expect(referenceDraftBlocker(draft())).toBeNull();
  });

  it('판본 메모가 너무 길면 DB 에 막히기 전에 알린다', () => {
    expect(referenceDraftBlocker(draft({ note: '가'.repeat(REFERENCE_NOTE_MAX + 1) })))
      .toContain('판본 메모');
    expect(referenceDraftBlocker(draft({ note: '가'.repeat(REFERENCE_NOTE_MAX) }))).toBeNull();
  });
});

describe('toReferenceTextPayload', () => {
  it('앞뒤 공백을 떼고 본문 모양을 고른다', () => {
    expect(toReferenceTextPayload(draft({
      title: ' 봄봄 ', author: ' 김유정 ', body: '가\r\n나  ', note: ' 교학사 수록본 ',
    }))).toEqual({
      title: '봄봄', author: '김유정', body: '가\n나', units: [], grammar_paths: [], note: '교학사 수록본',
    });
  });

  it('user_id·char_count 를 보내지 않는다 — DB 트리거가 채운다', () => {
    expect(Object.keys(toReferenceTextPayload(draft())).sort())
      .toEqual(['author', 'body', 'grammar_paths', 'note', 'title', 'units']);
  });

  it('⚠️ 단원·문법은 보내기 전에 다듬는다 — DB 는 모양만 보고 고쳐 주지 않는다', () => {
    const payload = toReferenceTextPayload(draft({
      units: [unit(), unit({ textbook: '천재 (노미숙)' }), unit({ textbook: '' })],
      grammar_paths: ['단어>품사>명사', '단어 > 품사 > 명사', ''],
    }));
    expect(payload.units).toEqual([unit()]);
    expect(payload.grammar_paths).toEqual(['단어 > 품사 > 명사']);
  });
});

describe('referenceDraftEquals', () => {
  it('모든 칸이 같아야 같다 — 하나라도 다르면 떠날 때 물어야 한다', () => {
    expect(referenceDraftEquals(draft(), draft())).toBe(true);
    expect(referenceDraftEquals(draft(), draft({ author: '김유정' }))).toBe(false);
    expect(referenceDraftEquals(draft(), draft({ note: '판본' }))).toBe(false);
    expect(referenceDraftEquals(draft(), draft({ units: [unit()] }))).toBe(false);
    expect(referenceDraftEquals(draft(), draft({ grammar_paths: ['담화'] }))).toBe(false);
  });

  it('⚠️ 배열 칸은 내용으로 비교한다 — 새로 만든 같은 배열을 고친 것으로 보면 안 된다', () => {
    expect(referenceDraftEquals(
      draft({ units: [unit()], grammar_paths: ['담화'] }),
      draft({ units: [unit()], grammar_paths: ['담화'] }),
    )).toBe(true);
  });
});

describe('draftFromReferenceText', () => {
  const row = {
    id: 'r1', title: '봄봄', author: '김유정', body: '본문', char_count: 2,
    units: [unit()], grammar_paths: ['담화'], note: '메모',
    user_id: 'u', updated_by: null, created_at: 'c', updated_at: 't',
  };

  it('분류 칸까지 화면 값으로 옮긴다', () => {
    expect(draftFromReferenceText(row)).toEqual({
      title: '봄봄', author: '김유정', body: '본문', units: [unit()], grammar_paths: ['담화'], note: '메모',
    });
  });

  it('모양이 어긋난 단원 원소는 버린다 — JSON 칸이라 화면을 깨면 안 된다', () => {
    const odd = { ...row, units: [unit(), { grade: '중2' }] as unknown as ReferenceUnit[] };
    expect(draftFromReferenceText(odd).units).toEqual([unit()]);
  });
});
