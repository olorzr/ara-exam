import { describe, it, expect } from 'vitest';
import {
  joinWorkTitles, normalizePassageWorks, normalizeWorkLabel, normalizeWorkTitle,
  normalizeWorkTitles, splitWorkTitles, workTitleKey, WORKS_MAX, worksKey,
} from './work-title';

describe('normalizeWorkTitle', () => {
  it('낫표를 벗긴다 — 시험지는 「동백꽃」 으로 인쇄한다', () => {
    expect(normalizeWorkTitle('「동백꽃」')).toBe('동백꽃');
    expect(normalizeWorkTitle('『삼국유사』')).toBe('삼국유사');
  });

  it('꺾쇠·따옴표도 벗긴다 — 학교마다 표기가 다르다', () => {
    for (const raw of ['〈동백꽃〉', '《동백꽃》', '<동백꽃>', '"동백꽃"', '“동백꽃”', "'동백꽃'"]) {
      expect(normalizeWorkTitle(raw)).toBe('동백꽃');
    }
  });

  it('안쪽 기호는 남긴다 — 두 작품을 한 칸에 적은 경우 가운데 기호는 뜻이 있다', () => {
    expect(normalizeWorkTitle('「봄봄」 · 「동백꽃」')).toBe('봄봄」 · 「동백꽃');
  });

  it('카테고리 규칙을 그대로 이어받는다 — 괄호 앞 공백을 없앤다', () => {
    expect(normalizeWorkTitle('천재 (정호웅)')).toBe('천재(정호웅)');
  });

  it('앞뒤 공백을 다듬는다', () => {
    expect(normalizeWorkTitle('  동백꽃  ')).toBe('동백꽃');
    expect(normalizeWorkTitle('「 동백꽃 」')).toBe('동백꽃');
  });

  it('멱등이다 — 두 번 돌려도 값이 그대로여야 트리거와 앱이 갈라지지 않는다', () => {
    for (const raw of ['「동백꽃」', '천재 (정호웅)', '동백꽃', '']) {
      const once = normalizeWorkTitle(raw);
      expect(normalizeWorkTitle(once)).toBe(once);
    }
  });

  it('빈 값은 빈 값', () => {
    expect(normalizeWorkTitle('')).toBe('');
    expect(normalizeWorkTitle('「」')).toBe('');
  });

  it('지은이에도 쓴다', () => {
    expect(normalizeWorkTitle(' 김유정 ')).toBe('김유정');
  });

  it('보이지 않는 공백 뒤의 감싸는 기호도 벗긴다 — DB 의 정규식과 글자 하나까지 같아야 한다', () => {
    // NBSP·전각 공백·BOM. Postgres 의 \s 는 이것들을 못 잡아서 sql/33 이 집합을 직접 나열한다
    for (const space of ['\u00A0', '\u3000', '\uFEFF', '\u2009']) {
      expect(normalizeWorkTitle(`${space}「동백꽃」${space}`)).toBe('동백꽃');
    }
  });
});

describe('splitWorkTitles / joinWorkTitles', () => {
  it('가운뎃점으로 나누고 표기를 맞춘다', () => {
    expect(splitWorkTitles('「먼 후일」 · 독은 아름답다')).toEqual(['먼 후일', '독은 아름답다']);
  });

  it('OCR 이 섞어 내는 가운뎃점 세 종류를 다 받는다', () => {
    for (const dot of ['·', '•', '・']) {
      expect(splitWorkTitles(`봄봄 ${dot} 동백꽃`)).toEqual(['봄봄', '동백꽃']);
    }
  });

  it('빈 값·중복을 걷어내고 등장 순서를 지킨다', () => {
    expect(splitWorkTitles('동백꽃 ·  · 봄봄 · 동백꽃')).toEqual(['동백꽃', '봄봄']);
  });

  it('보이지 않는 공백이 둘러싼 가운뎃점도 나눈다', () => {
    expect(splitWorkTitles('먼 후일\u00A0·\u3000독은 아름답다')).toEqual(['먼 후일', '독은 아름답다']);
  });

  it('빈 문자열은 빈 목록', () => {
    expect(splitWorkTitles('')).toEqual([]);
    expect(splitWorkTitles(' · ')).toEqual([]);
  });

  it('상한을 넘기지 않는다 — DB 의 CHECK 와 같은 수다', () => {
    const many = Array.from({ length: WORKS_MAX + 3 }, (_, i) => `작품${i}`);
    expect(splitWorkTitles(many.join(' · '))).toHaveLength(WORKS_MAX);
  });

  it('이었다 나누면 그대로다 — 이 왕복이 깨지면 목록과 파생 문자열이 어긋난다', () => {
    for (const titles of [[], ['동백꽃'], ['먼 후일', '독은 아름답다']]) {
      expect(splitWorkTitles(joinWorkTitles(titles))).toEqual(titles);
    }
  });

  it('DB 파생 문자열과 같은 기호로 잇는다 — 양쪽 공백 있는 가운뎃점', () => {
    expect(joinWorkTitles(['먼 후일', '독은 아름답다'])).toBe('먼 후일 · 독은 아름답다');
  });
});

describe('normalizeWorkTitles', () => {
  it('원소 안에 남은 이음 기호까지 쪼갠다 — 사람이 한 칸에 두 편을 칠 수 있다', () => {
    expect(normalizeWorkTitles(['먼 후일 · 독은 아름답다', '동백꽃']))
      .toEqual(['먼 후일', '독은 아름답다', '동백꽃']);
  });

  it('빈 값·중복을 걷어낸다', () => {
    expect(normalizeWorkTitles(['「동백꽃」', '', '동백꽃'])).toEqual(['동백꽃']);
  });
});

describe('normalizeWorkLabel', () => {
  it('괄호를 벗긴다 — 인쇄할 때 다시 붙인다', () => {
    expect(normalizeWorkLabel('(가)')).toBe('가');
    expect(normalizeWorkLabel('（나）')).toBe('나');
    expect(normalizeWorkLabel(' 다 ')).toBe('다');
  });

  it('길면 자른다 — 구분 표시는 한두 글자다', () => {
    expect(normalizeWorkLabel('가나다라마바')).toBe('가나다라');
  });
});

describe('normalizePassageWorks', () => {
  const work = (over: Partial<{ label: string; title: string; author: string }> = {}) =>
    ({ label: '', title: '동백꽃', author: '김유정', ...over });

  it('표기를 맞추고 구분 표시의 괄호를 벗긴다', () => {
    expect(normalizePassageWorks([work({ label: '(가)', title: '「동백꽃」' })]))
      .toEqual([{ label: '가', title: '동백꽃', author: '김유정' }]);
  });

  it('제목이 없는 줄은 버린다 — 지은이만으로는 작품 트리에 자리가 없다', () => {
    expect(normalizePassageWorks([work({ title: '' }), work()])).toHaveLength(1);
  });

  it('한 칸에 두 편을 친 경우 쪼개고 지은이·구분 표시를 물려준다', () => {
    expect(normalizePassageWorks([work({ label: '가', title: '봄봄 · 동백꽃' })])).toEqual([
      { label: '가', title: '봄봄', author: '김유정' },
      { label: '가', title: '동백꽃', author: '김유정' },
    ]);
  });

  it('같은 제목은 첫 줄만 남긴다', () => {
    expect(normalizePassageWorks([work(), work({ author: '다른 사람' })])).toHaveLength(1);
  });

  it('상한을 넘기지 않는다', () => {
    const many = Array.from({ length: WORKS_MAX + 2 }, (_, i) => work({ title: `작품${i}` }));
    expect(normalizePassageWorks(many)).toHaveLength(WORKS_MAX);
  });
});

describe('worksKey', () => {
  it('구분 표시·지은이까지 본다 — 그것만 고쳐도 저장해야 한다', () => {
    const base = [{ label: '가', title: '동백꽃', author: '김유정' }];
    expect(worksKey(base)).toBe(worksKey([{ ...base[0] }]));
    expect(worksKey(base)).not.toBe(worksKey([{ ...base[0], label: '나' }]));
    expect(worksKey(base)).not.toBe(worksKey([{ ...base[0], author: '' }]));
  });

  it('차례가 다르면 다른 열쇠다 — (가)(나) 순서가 뜻을 갖는다', () => {
    const a = { label: '가', title: '진달래꽃', author: '김소월' };
    const b = { label: '나', title: '엄마 걱정', author: '기형도' };
    expect(worksKey([a, b])).not.toBe(worksKey([b, a]));
  });

  it('이름에 구분자가 들어가도 섞이지 않는다 — 작품명은 자유 텍스트다', () => {
    expect(worksKey([{ label: '', title: 'a|b', author: '' }]))
      .not.toBe(worksKey([{ label: '', title: 'a', author: 'b' }]));
  });
});

describe('줄표 통일 (sql/46)', () => {
  it('엔대시·엠대시·가로줄·빼기·전각 하이픈을 하이픈으로 — 김사인 작품이 이것 때문에 둘로 갈렸다', () => {
    for (const dash of ['\u2013', '\u2014', '\u2015', '\u2212', '\uFF0D']) {
      expect(normalizeWorkTitle(`지상의 방 한 칸 ${dash} 박영한 님의 제(題)를 빌려`))
        .toBe('지상의 방 한 칸 - 박영한 님의 제(題)를 빌려');
    }
  });

  it('멱등이다', () => {
    const once = normalizeWorkTitle('동해 바다 – 후포에서');
    expect(normalizeWorkTitle(once)).toBe(once);
  });
});

describe('workTitleKey', () => {
  it('띄어쓰기를 무시한다', () => {
    expect(workTitleKey('엄마걱정')).toBe(workTitleKey('엄마 걱정'));
    expect(workTitleKey('소설가 구보씨의 일일')).toBe(workTitleKey('소설가 구보 씨의 일일'));
  });

  it('한자만 든 괄호를 무시한다', () => {
    expect(workTitleKey('이생규장전(李生窺墻傳)')).toBe(workTitleKey('이생규장전'));
    expect(workTitleKey('이생규장전 (李生窺墻傳)')).toBe(workTitleKey('이생규장전'));
    expect(workTitleKey('지상의 방 한 칸 - 박영한 님의 제(題)를 빌려'))
      .toBe(workTitleKey('지상의 방 한칸 – 박영한 님의 제를 빌려'));
  });

  it('한글이 든 괄호는 남긴다 — 해독은 따로 서야 한다', () => {
    expect(workTitleKey('제망매가(김완진 해독)')).not.toBe(workTitleKey('제망매가'));
    expect(workTitleKey('찬기파랑가(김완진 해독)')).not.toBe(workTitleKey('찬기파랑가(양주동 해독)'));
  });

  it('감싼 기호까지 벗긴다 — 표기 정규화를 먼저 거친다', () => {
    expect(workTitleKey('「엄마 걱정」')).toBe(workTitleKey('엄마걱정'));
  });

  it('DB 의 exam.work_title_key 와 같은 값 — 대장 열쇠와 어긋나면 안 된다', () => {
    // 운영 DB 에서 SELECT exam.work_title_key(...) 로 뽑은 값(2026-09-27)
    expect(workTitleKey('지상의 방 한 칸 - 박영한 님의 제(題)를 빌려')).toBe('지상의방한칸-박영한님의제를빌려');
    expect(workTitleKey('제망매가(김완진 해독)')).toBe('제망매가(김완진해독)');
  });
});
