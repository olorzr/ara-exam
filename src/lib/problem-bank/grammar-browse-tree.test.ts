import { describe, expect, it } from 'vitest';
import {
  GRAMMAR_SELF_LEAF, buildGrammarBrowseTree, grammarFilterPatch, grammarNodeKey,
  grammarSelectOptions,
} from './grammar-browse-tree';
import { GRAMMAR_TREE } from './grammar-tree';
import type { FacetTreeNode } from './school-exam-tree';

const EMPTY = new Map<string, number>();

/** 트리를 훑어 모든 노드를 납작하게 */
function flatten(nodes: FacetTreeNode<string[]>[]): FacetTreeNode<string[]>[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

/** 이름으로 노드를 찾는다 (라벨에서 건수는 떼고 비교) */
function findByName(nodes: FacetTreeNode<string[]>[], name: string) {
  return flatten(nodes).find((n) => n.label.replace(/ \(\d+\)$/, '') === name);
}

describe('buildGrammarBrowseTree', () => {
  /**
   * 이 테스트가 고정하는 것: 트리는 **마스터**로 만든다. 예전처럼 패싯(태깅된 잎)으로
   * 만들면 태그가 0건일 때 트리가 통째로 비어 태깅을 시작할 길이 없었다.
   */
  it('태그가 하나도 없어도 마스터 전체가 나온다', () => {
    const nodes = buildGrammarBrowseTree(EMPTY);

    expect(nodes).toHaveLength(GRAMMAR_TREE.length);
    expect(findByName(nodes, '명사')).toBeDefined();
    expect(findByName(nodes, '피동 표현')).toBeDefined();
  });

  it('교재 목차 순서를 지킨다 — 이름순이 아니다', () => {
    const nodes = buildGrammarBrowseTree(EMPTY);
    const tops = nodes.map((n) => n.label.replace(/ \(\d+\)$/, ''));

    expect(tops).toEqual(GRAMMAR_TREE.map((n) => n.name));
    // 이름순이면 '국어의 역사' 가 맨 앞으로 온다
    expect(tops).not.toEqual([...tops].sort((a, b) => a.localeCompare(b, 'ko')));
  });

  it('9품사는 학교문법 순서 그대로다', () => {
    const 품사 = findByName(buildGrammarBrowseTree(EMPTY), '품사');
    const names = (품사?.children ?? [])
      .map((c) => c.label.replace(/ \(\d+\)$/, ''))
      .filter((n) => n !== GRAMMAR_SELF_LEAF);

    expect(names.slice(0, 3)).toEqual(['명사', '대명사', '수사']);
  });

  it("가지마다 '(전체)' 잎이 있고 그 값이 가지 자신의 경로다", () => {
    const 품사 = findByName(buildGrammarBrowseTree(EMPTY), '품사');
    const self = 품사?.children[0];

    expect(self?.label).toContain(GRAMMAR_SELF_LEAF);
    expect(self?.children).toHaveLength(0);
    expect(self?.value).toEqual(['단어', '품사']);
  });

  it('2단에서 끝나는 가지(어문 규정)에도 (전체) 잎이 붙는다', () => {
    const 어문 = findByName(buildGrammarBrowseTree(EMPTY), '어문 규정');

    expect(어문?.children[0]?.value).toEqual(['어문 규정']);
  });

  it('가지 자신은 value 가 없다 — 고르는 일은 (전체) 잎이 맡는다', () => {
    const 품사 = findByName(buildGrammarBrowseTree(EMPTY), '품사');

    expect(품사?.value).toBeUndefined();
    expect(품사!.children.length).toBeGreaterThan(1);
  });

  it('잎은 그대로 고를 수 있다', () => {
    const 명사 = findByName(buildGrammarBrowseTree(EMPTY), '명사');

    expect(명사?.value).toEqual(['단어', '품사', '명사']);
  });

  it('라벨에 건수가 붙고, 0건은 흐리게 표시된다', () => {
    const counts = new Map([['단어 > 품사 > 명사', 5]]);
    const nodes = buildGrammarBrowseTree(counts);

    expect(findByName(nodes, '명사')?.label).toBe('명사 (5)');
    expect(findByName(nodes, '명사')?.dimmed).toBe(false);
    expect(findByName(nodes, '대명사')?.label).toBe('대명사 (0)');
    expect(findByName(nodes, '대명사')?.dimmed).toBe(true);
  });

  it('0건이어도 value 는 그대로다 — 골라서 비어 있음을 확인할 수 있다', () => {
    expect(findByName(buildGrammarBrowseTree(EMPTY), '대명사')?.value)
      .toEqual(['단어', '품사', '대명사']);
  });

  it('노드 id 는 경로 전체로 만든다 — 같은 이름이 가지마다 있을 수 있다', () => {
    const ids = flatten(buildGrammarBrowseTree(EMPTY)).map((n) => n.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('grammarNodeKey', () => {
  it('경로가 다르면 키도 다르다', () => {
    expect(grammarNodeKey(['문장', '문장 성분']))
      .not.toBe(grammarNodeKey(['문장', '문장 성분', '문장 성분']));
  });
});

describe('grammarFilterPatch', () => {
  /**
   * 네 트리는 서로의 축을 비운다. 안 비우면 트리에 '(12)' 라고 적힌 가지를 눌렀는데
   * 다른 조건이 남아 0건이 나와 **숫자가 거짓말을 한다**.
   */
  it('학교·작품·교과서·단원을 비우고 문법만 건다', () => {
    const patch = grammarFilterPatch(['단어', '품사']);

    expect(patch.grammar_path).toEqual(['단어', '품사']);
    expect(patch.school_name).toBe('');
    expect(patch.source_type).toBe('');
    expect(patch.work_title).toBe('');
    expect(patch.textbook).toBe('');
    expect(patch.unit_path).toEqual([]);
    expect(patch.page).toBe(0);
  });
});

describe('grammarSelectOptions', () => {
  it('중간 마디까지 포함한 마스터 전체를 목차 순서로 준다', () => {
    const options = grammarSelectOptions();
    const values = options.map((o) => o.value);

    expect(values).toContain('단어');
    expect(values).toContain('단어 > 품사');
    expect(values).toContain('단어 > 품사 > 명사');
    expect(values.indexOf('단어')).toBeLessThan(values.indexOf('단어 > 품사 > 명사'));
  });

  it('이름은 경로 전체다 — 마디 이름만으로는 모호하다', () => {
    const option = grammarSelectOptions().find((o) => o.value === '문장 > 문장 성분');

    expect(option?.label).toBe('문장 > 문장 성분');
  });
});
