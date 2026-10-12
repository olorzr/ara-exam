import type { AreaTreeNode } from './area-tree';
import { GRAMMAR_TREE } from './grammar-master';

/**
 * 문법 분류 트리 (순수 함수 + 코드 상수 마스터).
 *
 * 체계는 수능 문법 교재 목차(6개 대분류 / 100개 핵심 개념)를 그대로 옮기고, 중학 기출에서
 * 꾸준히 나오는데 목차에 없는 것을 대분류로 더한 것이다(`남북한 언어`).
 *
 * ⚠️ **마스터를 DB 에 두지 않았다.** 수능 문법 체계는 학문적으로 고정이라 관리 화면과
 *    마스터 표를 만들 이유가 없다. 항목은 `grammar-master.ts` 에 있다(태깅 규칙도 거기 적었다).
 *
 * ⚠️ **저장 모양이 area_path·unit_path 와 다르다.** 그쪽은 `TEXT[]` 하나가 **경로 하나**라
 *    문항에 한 개만 붙지만(`{문학,현대시}`), 수능 문법 문항은 개념 두셋을 걸친다.
 *    그래서 여기서는 경로를 `' > '` 로 이어 붙인 **문자열**을 원소로 담는다:
 *    `{"단어 > 품사 > 명사","문장 > 문법 요소 > 피동 표현"}`.
 *    그 결과 상위 검색이 `@>` 로 안 되므로 `grammarPathsUnder` 가 가지를 펼치고 `&&` 로 찾는다.
 *
 * ⚠️ 태깅은 마스터 id 가 아니라 **이름 경로 스냅샷**이다(area_path·unit_path 와 같은 규약) —
 *    이 파일에서 이름을 바꿔도 이미 태깅한 문항은 그대로다.
 *
 * ⚠️ 영역 분류(`area-tree.ts`)와 **같은 노드 모양**을 쓴다 — 그래야 `optionsAt`·
 *    `longestKnownPrefix` 와 `AreaPathPicker` 를 그대로 재사용할 수 있다.
 */

/** 문법 분류는 최대 세 단계다 (가지에 따라 두 단계에서 끝난다) */
export const GRAMMAR_DEPTH_MAX = 3;

/** 단계 라벨 — 화면의 열 제목이 공유하는 단일 출처 */
export const GRAMMAR_DEPTH_LABELS = ['대분류', '중분류', '개념'] as const;

/**
 * 경로를 한 원소로 잇는 구분자.
 * 마스터가 코드 상수라 이름에 `>` 가 섞일 일이 없다.
 */
export const GRAMMAR_PATH_SEPARATOR = ' > ';

/** 문항 하나에 붙일 수 있는 태그 수 — DB 의 `problems_grammar_paths_max` 와 미러 */
export const GRAMMAR_MAX_TAGS = 5;

/**
 * 이 이름이 영역(`area_path`)에 있으면 문법 문항으로 본다.
 *
 * ⚠️ **운영 마스터를 직접 보고 맞춘 목록이다.** ara-system 마이그 335 의 옛 시드에는
 *    `중등 국어 > 문법` 이 있었지만, 2022 개정 교육과정으로 바뀐 지금 운영 마스터는
 *    중등·고등이 **`화법과 언어 > 언어`** 이고 `문법` 대영역은 초등에만 남아 있다.
 *    시드 파일만 보고 고치지 말 것 — 마스터는 ara-system 이 소유하고 따로 갱신된다.
 * - 중등·고등: `화법과 언어 > 언어`  → '언어'
 * - 초등: `문법`, `어휘/어법`
 * - `언어와 매체`: 지금 마스터에는 없지만 옛 태깅이 남아 있을 수 있어 함께 둔다
 * '화법' 은 넣지 않는다 — 말하기·듣기라 문법 개념을 붙일 자리가 아니다.
 */
const GRAMMAR_AREA_NAMES = ['언어', '문법', '어휘/어법', '언어와 매체'];

export { GRAMMAR_MIXED_LEAF, GRAMMAR_TREE } from './grammar-master';

/**
 * 경로를 저장·표시용 한 줄로.
 * @param path - 이름 경로 (['단어','품사','명사'])
 * @returns '단어 > 품사 > 명사' (빈 마디는 버린다)
 */
export function formatGrammarPath(path: string[]): string {
  return path.filter(Boolean).join(GRAMMAR_PATH_SEPARATOR);
}

/**
 * 저장된 한 줄을 경로로 되돌린다.
 *
 * 구분자 주변 공백에 관대하다 — 손으로 넣은 값이나 옛 표기가 섞여도 트리를 찾아간다.
 * @param value - '단어 > 품사 > 명사'
 * @returns 이름 경로 (빈 값이면 빈 배열)
 */
export function parseGrammarPath(value: string): string[] {
  return value.split('>').map((s) => s.trim()).filter(Boolean);
}

/** 트리를 훑어 **잎과 중간 마디를 모두** 모은다 (선언 순서) */
function collectDescendants(nodes: AreaTreeNode[], prefix: string[], out: string[][]): void {
  for (const node of nodes) {
    const path = [...prefix, node.name];
    out.push(path);
    collectDescendants(node.children, path, out);
  }
}

/** 경로로 노드를 찾는다. 없으면 null */
function nodeAt(path: string[]): AreaTreeNode | null {
  let nodes = GRAMMAR_TREE;
  let hit: AreaTreeNode | null = null;
  for (const name of path) {
    hit = nodes.find((n) => n.name === name) ?? null;
    if (!hit) return null;
    nodes = hit.children;
  }
  return hit;
}

/** 마스터의 모든 경로(중간 마디 포함)를 목차 순서로 — 선택지 정렬의 단일 출처 */
const GRAMMAR_ORDER: Map<string, number> = (() => {
  const order = new Map<string, number>();
  const walk = (nodes: AreaTreeNode[], prefix: string[]) => {
    for (const node of nodes) {
      const path = [...prefix, node.name];
      order.set(formatGrammarPath(path), order.size);
      walk(node.children, path);
    }
  };
  walk(GRAMMAR_TREE, []);
  return order;
})();

/**
 * 마스터의 모든 경로(중간 마디 포함)를 목차 순서로.
 *
 * 아카이브 필터·트리의 선택지가 여기서 나온다. **패싯(태깅된 경로)이 아니라 마스터**인
 * 이유는 grammar-browse-tree.ts 에 적어 두었다 — 한 줄로는, 태그가 0건이면 패싯도 0건이라
 * 고를 칸 자체가 안 생겨 태깅을 시작할 길이 없었다.
 */
export const GRAMMAR_ALL_PATHS: readonly string[] = [...GRAMMAR_ORDER.keys()];

/**
 * 고른 경로와 **그 아래 경로 전부** — 상위 검색이 쓴다.
 *
 * 저장값이 경로 문자열이라 `@>`(contains) 로는 정확 일치만 걸린다. '품사' 를 고르면
 * 그 아래를 전부 나열해 `&&`(overlaps) 로 찾는다.
 *
 * ⚠️ **잎만 펴면 안 된다 — 고른 마디 자신과 중간 마디도 넣는다.** `GrammarTagPicker` 는
 *    부분 경로도 그대로 담아서(`canAdd` 가 경로 길이를 보지 않는다) `'단어 > 품사'` 처럼
 *    **중간 마디로 태깅된 문항이 실제로 있다**('품사 분류 기준' 처럼 잎 하나로 못 좁히는
 *    종합 문항). 잎만 나열하면 '품사' 로 걸러도 그 문항들이 통째로 안 나온다.
 *
 * ⚠️ 트리에 없는 경로는 **그 경로 자체**를 돌려준다(빈 배열이 아니다). 마스터에서 뺀
 *    항목으로 태깅된 옛 문항이 필터에서 통째로 사라지면 안 된다 — 정확 일치로라도 찾게 둔다.
 * @param path - 고른 경로 (['단어','품사'])
 * @returns 검색에 넣을 경로 문자열 목록 (고른 마디가 맨 앞, 나머지는 목차 순서)
 */
export function grammarPathsUnder(path: string[]): string[] {
  const clean = path.filter(Boolean);
  if (clean.length === 0) return [];

  const self = formatGrammarPath(clean);
  const node = nodeAt(clean);
  if (!node || node.children.length === 0) return [self];

  const under: string[][] = [];
  collectDescendants(node.children, clean, under);
  return [self, ...under.map(formatGrammarPath)];
}

/**
 * 저장된 경로들의 **조상까지 펼친다** — 필터 선택지가 쓴다.
 *
 * 패싯은 문항이 실제로 들고 있는 값만 모으는데, 그것만 선택지로 두면 '품사 전체' 를
 * 고를 수가 없다. `'단어 > 품사 > 명사'` 하나에서 `'단어'`·`'단어 > 품사'` 도 만들어 준다.
 * (저장값은 잎이 대부분이지만 `'단어 > 품사'` 같은 중간 마디도 섞여 있다 — 그 경우
 *  자기 자신과 `'단어'` 가 나온다.)
 * @param paths - 저장된 경로 문자열들
 * @returns 중복 없는 경로 목록 (교재 목차 순서, 마스터에 없는 것은 뒤로)
 */
export function expandGrammarAncestors(paths: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of paths) {
    const parsed = parseGrammarPath(raw);
    for (let depth = 1; depth <= parsed.length; depth += 1) {
      const key = formatGrammarPath(parsed.slice(0, depth));
      if (key) seen.add(key);
    }
  }

  const rank = (key: string) => GRAMMAR_ORDER.get(key) ?? Number.MAX_SAFE_INTEGER;
  return [...seen].sort((a, b) => (rank(a) !== rank(b)
    ? rank(a) - rank(b)
    : a.localeCompare(b, 'ko')));
}

/**
 * 이 문항이 문법 문항인가 — 검수 화면에서 문법 분류 칸을 펼칠지 정한다.
 *
 * 판정이 어긋나도 칸을 **닫아 걸지는 않는다**(호출부가 접어 두고 링크로 연다) —
 * 영역을 아직 안 고른 문항까지 못 태깅하면 그 문항은 영영 분류할 수 없다.
 * @param areaPath - 영역 이름 경로
 * @returns 문법 영역이면 true
 */
export function isGrammarArea(areaPath: string[]): boolean {
  return areaPath.some((name) => GRAMMAR_AREA_NAMES.includes(name));
}

/**
 * 문법 경로 목록을 저장할 수 있는 모양으로 다듬는다 (OCR·손입력 공용).
 * @param paths - 경로 문자열들
 * @returns 빈 값·중복을 걷어내고 상한까지 자른 목록
 */
export function normalizeGrammarPaths(paths: string[]): string[] {
  const out: string[] = [];
  for (const raw of paths) {
    const key = formatGrammarPath(parseGrammarPath(raw));
    if (!key || out.includes(key)) continue;
    out.push(key);
    if (out.length >= GRAMMAR_MAX_TAGS) break;
  }
  return out;
}
