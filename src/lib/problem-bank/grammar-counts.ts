import { formatGrammarPath, parseGrammarPath } from './grammar-tree';

/**
 * 문법 개념별 문항 수 세기 (순수 함수).
 *
 * 조회는 facets.ts 가 하고, 여기서는 읽어 온 행들을 세기만 한다 — supabase 를 흉내 내지 않고
 * 규칙만 테스트할 수 있게 가른다.
 */

/**
 * 한 문항이 걸리는 경로 전부 — 태그 자신과 그 조상들.
 *
 * `'단어 > 품사 > 명사'` 하나에서 `'단어'`·`'단어 > 품사'`·`'단어 > 품사 > 명사'` 를 만든다.
 * @param paths - 그 문항의 `grammar_paths`
 * @returns 중복 없는 경로 집합
 */
function coveredPaths(paths: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of paths) {
    const parsed = parseGrammarPath(raw);
    for (let depth = 1; depth <= parsed.length; depth += 1) {
      const key = formatGrammarPath(parsed.slice(0, depth));
      if (key) out.add(key);
    }
  }
  return out;
}

/**
 * 경로마다 **문항 수**를 센다.
 *
 * ⚠️ **조상은 자손 건수의 합이 아니다.** 한 문항이 같은 조상 아래 태그를 둘셋 달 수 있어
 *    (`'문장 > 문법 요소 > 피동 표현'` + `'문장 > 문법 요소 > 사동 표현'`) 그대로 더하면
 *    **한 문항을 두 번 센다**. 게다가 조상 자신으로 직접 태깅된 문항도 있다(`'단어 > 품사'`).
 *    행마다 걸리는 경로를 집합으로 모아 **경로당 한 번만** 올린다.
 *    그래야 `(n)` 이 그 가지를 눌렀을 때 나오는 목록 길이와 맞는다 — 상위 검색은
 *    그 마디와 아래 경로들의 겹침(`&&`)이라 '하나라도 걸리면' 이기 때문이다.
 * @param rows - 문항별 `grammar_paths` 목록
 * @returns 경로 → 문항 수
 */
export function tallyGrammarCounts(
  rows: readonly (readonly string[])[],
): Map<string, number> {
  return tallyWeightedGrammarCounts(rows.map((paths) => ({ paths, n: 1 })));
}

/**
 * `tallyGrammarCounts` 의 묶음판 — 같은 태그 묶음을 가진 문항 n 개를 한 줄로 받는다.
 *
 * 서버(`exam.archive_facets`, sql/66)가 `GROUP BY grammar_paths` 로 묶어 보낸다. 조상 중복 제거는
 * 묶음 **안**에서 하므로(한 묶음 = 같은 태그를 가진 문항들) 묶음마다 `n` 을 더하면 문항 단위로 센 것과 같다.
 * @param rows - 태그 묶음과 그 묶음을 가진 문항 수
 * @returns 경로 → 문항 수
 */
export function tallyWeightedGrammarCounts(
  rows: readonly { paths: readonly string[]; n: number }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const key of coveredPaths(row.paths)) {
      counts.set(key, (counts.get(key) ?? 0) + row.n);
    }
  }
  return counts;
}
