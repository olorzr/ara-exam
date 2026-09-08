import { describe, it, expect } from 'vitest';
import type { AreaTreeNode } from './area-tree';
import { longestKnownPrefix, optionsAt } from './area-tree';
import {
  expandGrammarAncestors, formatGrammarPath, GRAMMAR_DEPTH_MAX, GRAMMAR_MAX_TAGS,
  GRAMMAR_TREE, grammarPathsUnder, isGrammarArea, normalizeGrammarPaths, parseGrammarPath,
} from './grammar-tree';

/** 트리의 모든 경로(중간 마디 포함) */
function allPaths(nodes: AreaTreeNode[], prefix: string[] = []): string[][] {
  return nodes.flatMap((n) => {
    const path = [...prefix, n.name];
    return [path, ...allPaths(n.children, path)];
  });
}

describe('문법 마스터 무결성', () => {
  it('대분류 6개다', () => {
    expect(GRAMMAR_TREE.map((n) => n.name)).toEqual([
      '단어', '문장', '음운', '담화', '어문 규정', '국어의 역사',
    ]);
  });

  it('깊이가 상한을 넘지 않는다', () => {
    // 넘으면 AreaPathPicker 가 그리지 못하는 단계가 생긴다
    for (const path of allPaths(GRAMMAR_TREE)) {
      expect(path.length).toBeLessThanOrEqual(GRAMMAR_DEPTH_MAX);
    }
  });

  it('경로가 모두 유일하다', () => {
    // 겹치면 저장값 하나가 두 곳을 가리켜 검색이 섞인다
    const keys = allPaths(GRAMMAR_TREE).map(formatGrammarPath);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('이름에 구분자가 섞여 있지 않다', () => {
    // 섞이면 parseGrammarPath 가 한 마디를 둘로 쪼갠다
    for (const path of allPaths(GRAMMAR_TREE)) {
      for (const name of path) expect(name).not.toContain('>');
    }
  });

  it('빈 중분류가 없다', () => {
    for (const major of GRAMMAR_TREE) {
      for (const mid of major.children) {
        if (mid.children.length === 0) continue; // 담화·어문 규정은 여기가 잎이다
        expect(mid.children.length).toBeGreaterThan(0);
      }
    }
  });

  it('선언 순서를 지킨다 — 9품사는 학교문법 순서다', () => {
    expect(optionsAt(GRAMMAR_TREE, ['단어', '품사'])).toEqual([
      '명사', '대명사', '수사', '관형사', '부사', '조사', '감탄사', '동사', '형용사',
    ]);
  });
});

describe('경로 왕복', () => {
  it('format ↔ parse 가 왕복한다', () => {
    const path = ['단어', '품사', '명사'];
    expect(parseGrammarPath(formatGrammarPath(path))).toEqual(path);
  });

  it('구분자 주변 공백에 관대하다', () => {
    expect(parseGrammarPath('단어>품사 >  명사')).toEqual(['단어', '품사', '명사']);
  });

  it('빈 마디는 버린다', () => {
    expect(formatGrammarPath(['단어', '', '명사'])).toBe('단어 > 명사');
    expect(parseGrammarPath('')).toEqual([]);
  });
});

describe('grammarPathsUnder — 상위 검색이 쓴다', () => {
  it('중분류를 고르면 그 아래 잎을 전부 편다', () => {
    const leaves = grammarPathsUnder(['단어', '품사']);
    expect(leaves).toHaveLength(9);
    expect(leaves).toContain('단어 > 품사 > 명사');
    expect(leaves).toContain('단어 > 품사 > 형용사');
  });

  it('대분류를 고르면 그 가지 전체를 편다', () => {
    // 저장값은 잎뿐이라 중간 마디는 나오면 안 된다
    const leaves = grammarPathsUnder(['문장']);
    expect(leaves).toHaveLength(30);
    expect(leaves).toContain('문장 > 문법 요소 > 피동 표현');
    expect(leaves).not.toContain('문장 > 문법 요소');
  });

  it('잎을 고르면 자기 하나다', () => {
    expect(grammarPathsUnder(['단어', '품사', '명사'])).toEqual(['단어 > 품사 > 명사']);
  });

  it('두 단계에서 끝나는 가지도 잎을 준다', () => {
    // 담화는 중분류가 없다 — 대분류 바로 아래가 잎이다
    const leaves = grammarPathsUnder(['담화']);
    expect(leaves).toHaveLength(5);
    expect(leaves).toContain('담화 > 담화의 맥락');
  });

  it('마스터에 없는 경로는 그 경로 자체로 찾는다', () => {
    // 빈 배열을 주면 옛 태그가 붙은 문항이 필터에서 통째로 사라진다
    expect(grammarPathsUnder(['옛분류', '사라진개념'])).toEqual(['옛분류 > 사라진개념']);
  });

  it('빈 경로는 조건을 만들지 않는다', () => {
    expect(grammarPathsUnder([])).toEqual([]);
    expect(grammarPathsUnder([''])).toEqual([]);
  });
});

describe('expandGrammarAncestors — 필터 선택지가 쓴다', () => {
  it('잎 하나에서 조상까지 편다', () => {
    expect(expandGrammarAncestors(['단어 > 품사 > 명사']))
      .toEqual(['단어', '단어 > 품사', '단어 > 품사 > 명사']);
  });

  it('겹치는 조상을 한 번만 낸다', () => {
    const out = expandGrammarAncestors(['단어 > 품사 > 명사', '단어 > 품사 > 동사']);
    expect(out.filter((p) => p === '단어 > 품사')).toHaveLength(1);
  });

  it('교재 목차 순서로 낸다 (이름순이 아니다)', () => {
    const out = expandGrammarAncestors(['문장 > 문법 요소 > 피동 표현', '단어 > 품사 > 명사']);
    expect(out.indexOf('단어')).toBeLessThan(out.indexOf('문장'));
  });

  it('마스터에 없는 경로는 뒤로 보내되 버리지 않는다', () => {
    const out = expandGrammarAncestors(['옛분류', '단어 > 품사 > 명사']);
    expect(out).toContain('옛분류');
    expect(out.indexOf('단어')).toBeLessThan(out.indexOf('옛분류'));
  });
});

describe('normalizeGrammarPaths', () => {
  it('중복과 빈 값을 걷어낸다', () => {
    expect(normalizeGrammarPaths(['단어 > 품사', '', '단어 > 품사', '음운']))
      .toEqual(['단어 > 품사', '음운']);
  });

  it('상한까지만 남긴다', () => {
    const many = ['가', '나', '다', '라', '마', '바'];
    expect(normalizeGrammarPaths(many)).toHaveLength(GRAMMAR_MAX_TAGS);
  });

  it('표기를 다듬어 같은 값으로 모은다', () => {
    expect(normalizeGrammarPaths(['단어>품사', '단어 > 품사'])).toEqual(['단어 > 품사']);
  });
});

describe('isGrammarArea — 칸을 펼칠지', () => {
  it('중등·고등은 화법과 언어 > 언어 다 (운영 마스터 실제 모양)', () => {
    expect(isGrammarArea(['화법과 언어', '언어'])).toBe(true);
  });

  it('초등은 문법·어휘/어법', () => {
    expect(isGrammarArea(['문법'])).toBe(true);
    expect(isGrammarArea(['어휘/어법'])).toBe(true);
  });

  it('옛 표기 언어와 매체도 받는다', () => {
    expect(isGrammarArea(['고등 국어', '언어와 매체'])).toBe(true);
  });

  it('같은 갈래라도 화법은 false — 문법 개념을 붙일 자리가 아니다', () => {
    expect(isGrammarArea(['화법과 언어', '화법'])).toBe(false);
  });

  it('문학·독서는 false', () => {
    expect(isGrammarArea(['문학', '산문 문학', '현대 소설'])).toBe(false);
    expect(isGrammarArea(['독서와 작문', '독서'])).toBe(false);
    expect(isGrammarArea([])).toBe(false);
  });
});

describe('영역 트리 함수를 그대로 쓴다', () => {
  it('longestKnownPrefix 가 지어낸 마지막 단계를 잘라 낸다', () => {
    expect(longestKnownPrefix(GRAMMAR_TREE, ['단어', '품사', '없는품사'], GRAMMAR_DEPTH_MAX))
      .toEqual(['단어', '품사']);
  });

  it('두 단계 가지에서 세 번째 칸이 안 뜬다', () => {
    expect(optionsAt(GRAMMAR_TREE, ['담화', '담화의 맥락'])).toEqual([]);
  });
});
