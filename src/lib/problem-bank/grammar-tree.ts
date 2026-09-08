import type { AreaTreeNode } from './area-tree';

/**
 * 문법 분류 트리 (순수 함수 + 코드 상수 마스터).
 *
 * 체계는 수능 문법 교재 목차(6개 대분류 / 100개 핵심 개념)를 그대로 옮긴 것이다.
 *
 * ⚠️ **마스터를 DB 에 두지 않았다.** 수능 문법 체계는 학문적으로 고정이라 관리 화면과
 *    마스터 표를 만들 이유가 없다. 항목을 고치려면 이 파일을 고쳐 배포한다.
 *
 * ⚠️ **저장 모양이 area_path·unit_path 와 다르다.** 그쪽은 `TEXT[]` 하나가 **경로 하나**라
 *    문항에 한 개만 붙지만(`{문학,현대시}`), 수능 문법 문항은 개념 두셋을 걸친다.
 *    그래서 여기서는 경로를 `' > '` 로 이어 붙인 **문자열**을 원소로 담는다:
 *    `{"단어 > 품사 > 명사","문장 > 문법 요소 > 피동 표현"}`.
 *    그 결과 상위 검색이 `@>` 로 안 되므로 `grammarPathsUnder` 가 잎을 펼치고 `&&` 로 찾는다.
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

/** 마스터 원본 — 잎만 있는 가지는 이름 배열로 접는다(트리 모양이 그대로 보인다) */
type GrammarSource = Record<string, Record<string, string[]> | string[]>;

/**
 * 수능 문법 100개 핵심 개념.
 *
 * ⚠️ **선언 순서가 곧 화면 순서다.** 이름순으로 정렬하지 않는다 — 9품사(명사·대명사·수사…)나
 *    음운 변동처럼 학교문법이 가르치는 순서가 따로 있고, 선생님이 그 순서로 찾는다.
 * ⚠️ 교재 목차의 `❶❷❸` 은 지면 분할이지 개념 구분이 아니라 풀어서 적었다
 *    (`품사 ❶ - 명사` → `품사 > 명사`). 반대로 내용을 가를 수 없는 `표준어 규정 ❶~❹` 는
 *    중분류 하나로 접었다.
 */
const GRAMMAR_SOURCE: GrammarSource = {
  단어: {
    '단어의 형성': ['형태소', '어근과 접사', '합성어', '파생어'],
    품사: ['명사', '대명사', '수사', '관형사', '부사', '조사', '감탄사', '동사', '형용사'],
    용언: ['어간과 어미', '본용언과 보조 용언', '용언의 활용'],
    '단어의 의미': [
      '단어의 의미 유형',
      '의미 관계 - 유의·반의·상하',
      '의미 관계 - 동음이의어·다의어',
      '국어사전 활용',
      '단어의 의미 변화',
    ],
    '어휘 체계와 양상': ['고유어·한자어·외래어', '표준어·방언', '유행어·은어·전문어'],
  },
  문장: {
    '문장 성분': [
      '문장의 구성 단위', '문장 성분',
      '주어', '서술어', '목적어', '보어', '관형어', '부사어', '독립어',
      '서술어의 자릿수',
    ],
    '문장의 짜임': [
      '홑문장과 겹문장',
      '이어진문장 - 대등', '이어진문장 - 종속',
      '안긴문장 - 명사절', '안긴문장 - 관형절', '안긴문장 - 부사절',
      '안긴문장 - 인용절', '안긴문장 - 서술절',
    ],
    '문법 요소': [
      '주체 높임법', '객체 높임법', '상대 높임법',
      '종결 표현', '시제', '동작상', '부정 표현', '피동 표현', '사동 표현',
    ],
    '문장 다듬기': ['문장 성분 호응', '중의적 문장', '올바른 표현'],
  },
  음운: {
    '음운 체계': ['언어의 본질과 기능', '음운', '자음 체계', '모음 체계'],
    '음운 교체': [
      '음절의 끝소리 규칙', '구개음화', '비음화', '유음화',
      '된소리되기', '모음 동화', '두음 법칙',
    ],
    '음운 축약·탈락·첨가': ['음운 축약', '음운 탈락', 'ㄴ 첨가·반모음 첨가', '사잇소리 현상'],
  },
  // 담화·어문 규정은 중분류가 없다 — 두 단계에서 끝난다
  담화: [
    '담화 구성 요소와 기능', '담화 표현 방식',
    '담화의 통일성', '담화의 응집성', '담화의 맥락',
  ],
  '어문 규정': ['표준어 규정', '표준 발음법', '한글 맞춤법', '외래어 표기법', '로마자 표기법'],
  '국어의 역사': {
    훈민정음: [
      '훈민정음 창제 이전 표기 방식', '훈민정음 창제 원리',
      '훈민정음 운용 원리', '세종어제훈민정음',
    ],
    '중세 국어': [
      '중세 국어의 음운', '중세 국어의 단어',
      '중세 국어의 높임법', '중세 국어의 의문문과 시간 표현',
    ],
    '국어의 변천': ['국어 음운의 변천', '국어 어휘와 문법의 변천'],
  },
};

/**
 * 마스터 원본을 트리로 편다.
 *
 * id 는 합성값이다 — 실제 UUID 가 없는 것은 카테고리 관리의 마스터 전개 노드와 같다.
 * @returns 선언 순서를 지킨 트리
 */
function buildGrammarTree(source: GrammarSource): AreaTreeNode[] {
  return Object.entries(source).map(([major, body], i) => ({
    id: `g${i}`,
    name: major,
    children: Array.isArray(body)
      ? body.map((leaf, k) => ({ id: `g${i}-${k}`, name: leaf, children: [] }))
      : Object.entries(body).map(([mid, leaves], j) => ({
        id: `g${i}-${j}`,
        name: mid,
        children: leaves.map((leaf, k) => ({ id: `g${i}-${j}-${k}`, name: leaf, children: [] })),
      })),
  }));
}

/** 문법 분류 트리 — `AreaPathPicker`·`optionsAt`·`longestKnownPrefix` 가 그대로 받는다 */
export const GRAMMAR_TREE: AreaTreeNode[] = buildGrammarTree(GRAMMAR_SOURCE);

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

/** 트리를 훑어 잎 경로를 모은다 (선언 순서) */
function collectLeaves(nodes: AreaTreeNode[], prefix: string[], out: string[][]): void {
  for (const node of nodes) {
    const path = [...prefix, node.name];
    if (node.children.length === 0) out.push(path);
    else collectLeaves(node.children, path, out);
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
 * 이 가지 아래의 **잎 경로 전부** — 상위 검색이 쓴다.
 *
 * 저장값이 경로 문자열이라 `@>`(contains) 로는 정확 일치만 걸린다. '품사' 를 고르면
 * 그 아래 9개를 전부 나열해 `&&`(overlaps) 로 찾는다.
 *
 * ⚠️ 트리에 없는 경로는 **그 경로 자체**를 돌려준다(빈 배열이 아니다). 마스터에서 뺀
 *    항목으로 태깅된 옛 문항이 필터에서 통째로 사라지면 안 된다 — 정확 일치로라도 찾게 둔다.
 * @param path - 고른 경로 (['단어','품사'])
 * @returns 검색에 넣을 경로 문자열 목록
 */
export function grammarPathsUnder(path: string[]): string[] {
  const clean = path.filter(Boolean);
  if (clean.length === 0) return [];

  const node = nodeAt(clean);
  if (!node) return [formatGrammarPath(clean)];
  if (node.children.length === 0) return [formatGrammarPath(clean)];

  const leaves: string[][] = [];
  collectLeaves(node.children, clean, leaves);
  return leaves.map(formatGrammarPath);
}

/**
 * 잎 경로들의 **조상까지 펼친다** — 필터 선택지가 쓴다.
 *
 * 패싯은 문항이 실제로 들고 있는 값(잎)만 모으는데, 그것만 선택지로 두면 '품사 전체' 를
 * 고를 수가 없다. `'단어 > 품사 > 명사'` 하나에서 `'단어'`·`'단어 > 품사'` 도 만들어 준다.
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
