import { describe, it, expect } from 'vitest';
import { REFERENCE_NOTE_MAX, REFERENCE_TEXT_BODY_MAX } from './constants';
import {
  EMPTY_REFERENCE_DRAFT, draftFromPayload, draftFromReferenceText, emptyReferenceDraft, normalizeBody,
  referenceDraftBlocker, referenceDraftEquals, toReferenceTextPayload,
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
      title: '봄봄', author: '김유정', body: '가\n나', kind: '작품', format: 'text', seq: null, tags: [],
      units: [], grammar_paths: [], note: '교학사 수록본',
    });
  });

  it('user_id·char_count·source_key 를 보내지 않는다 — 트리거·헤드리스 적재 몫이다', () => {
    expect(Object.keys(toReferenceTextPayload(draft())).sort())
      .toEqual(['author', 'body', 'format', 'grammar_paths', 'kind', 'note', 'seq', 'tags', 'title', 'units']);
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
    kind: '작품' as const, format: 'text' as const, seq: 3, tags: ['제재'], source_key: null,
    units: [unit()], grammar_paths: ['담화'], note: '메모',
    user_id: 'u', updated_by: null, created_at: 'c', updated_at: 't',
  };

  it('분류 칸까지 화면 값으로 옮긴다', () => {
    expect(draftFromReferenceText(row)).toEqual({
      title: '봄봄', author: '김유정', body: '본문', kind: '작품', format: 'text', seq: '3', tags: ['제재'],
      units: [unit()], grammar_paths: ['담화'], note: '메모',
    });
  });

  it('모양이 어긋난 단원 원소는 버린다 — JSON 칸이라 화면을 깨면 안 된다', () => {
    const odd = { ...row, units: [unit(), { grade: '중2' }] as unknown as ReferenceUnit[] };
    expect(draftFromReferenceText(odd).units).toEqual([unit()]);
  });
});

describe('종류 · 본문 형식 · 차례 · 태그 (sql/79)', () => {
  it('HTML 본문은 저장할 때 문항 정화기를 지난다 — 허용 밖 태그는 사라진다', () => {
    const payload = toReferenceTextPayload(draft({
      kind: '개념', format: 'html', body: '<p>피동</p><img src="x" onerror="y"><script>z</script>',
    }));
    expect(payload.body).toBe('<p>피동</p>');
    expect(payload.kind).toBe('개념');
    expect(payload.format).toBe('html');
  });

  it('⚠️ 빈 HTML 편집기(<p></p>)는 본문이 빈 것이다', () => {
    expect(referenceDraftBlocker(draft({ format: 'html', body: '<p></p>' }))).toContain('본문');
  });

  it('차례는 0~9999 숫자거나 빈칸이고, 저장할 때 숫자가 된다', () => {
    expect(referenceDraftBlocker(draft({ seq: '-1' }))).toContain('차례');
    expect(referenceDraftBlocker(draft({ seq: '10000' }))).toContain('차례');
    expect(referenceDraftBlocker(draft({ seq: '1.5' }))).toContain('차례');
    expect(toReferenceTextPayload(draft({ seq: ' 30 ' })).seq).toBe(30);
    expect(toReferenceTextPayload(draft({ seq: '' })).seq).toBeNull();
  });

  it('태그는 다듬고 겹침을 빼서 8개까지', () => {
    const tags = ['핵심 정리', ' 핵심 정리 ', '', ...Array.from({ length: 10 }, (_, i) => `t${i}`)];
    expect(toReferenceTextPayload(draft({ tags })).tags).toEqual(['핵심 정리', 't0', 't1', 't2', 't3', 't4', 't5', 't6']);
  });

  it('⚠️ HTML 본문은 정화한 모양으로 견준다 — 편집기가 다시 쓴 HTML 로 "저장 안 됨" 이 뜨지 않게', () => {
    const saved = draft({ format: 'html', body: '<p>가</p>' });
    const echoed = draft({ format: 'html', body: '<p>가</p><script>x</script>' });
    expect(referenceDraftEquals(saved, echoed)).toBe(true);
    expect(referenceDraftEquals(draft({ format: 'text', body: '<p>가</p>' }), draft({ format: 'text', body: '<p>가</p> ' }))).toBe(false);
  });

  it('새로 만들면 작품·개념 모두 본문 형식이 HTML 로 시작한다', () => {
    expect(emptyReferenceDraft('개념')).toMatchObject({ kind: '개념', format: 'html' });
    // 작품도 문제집 서식(원문 옆 여백 해설·어휘 풀이)으로 시작한다(2026-10-28)
    expect(emptyReferenceDraft()).toMatchObject({ kind: '작품', format: 'html' });
  });

  it('저장한 값(차례 숫자)을 화면 값(입력칸 글자)으로 되돌린다', () => {
    const payload = toReferenceTextPayload(draft({ seq: '7' }));
    expect(draftFromPayload(payload).seq).toBe('7');
    expect(draftFromPayload({ ...payload, seq: null }).seq).toBe('');
  });
});

describe('본문 길이는 표시와 상한이 같은 잣대 (코덱스 3R)', () => {
  it('서식 본문은 보이는 글자 수로 상한을 잰다 — 평문으로 되던 글이 서식으로 바꿔도 막히지 않는다', () => {
    const near = '가'.repeat(REFERENCE_TEXT_BODY_MAX - 1);
    expect(referenceDraftBlocker(draft({ format: 'html', body: `<p>${near}</p>` }))).toBeNull();
    expect(referenceDraftBlocker(draft({ format: 'html', body: `<p>${near}가가</p>` }))).toContain('너무 길어요');
  });
});
