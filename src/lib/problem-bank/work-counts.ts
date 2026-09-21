import type { PassageWork } from '@/types/problem-bank';
import type { WorkFacet } from './facets';
import { isGrammarArea } from './grammar-tree';

/**
 * 작품별 문항 수 세기 · 갈래 판정 (순수 함수).
 *
 * 조회는 `facets.ts` 가 하고 여기서는 읽어 온 행들을 세기만 한다 — supabase 를 흉내 내지 않고
 * 규칙만 테스트할 수 있게 가른다(`grammar-counts.ts` 와 같은 규약).
 *
 * ⚠️ 한 문항이 작품 **여럿**에 걸린다(`(가)와 (나)의 공통점은?`). 그래서 문항 수의 합은
 *    문항 개수보다 크다 — 트리의 `(n)` 은 '그 작품을 고르면 나오는 문항 수' 이고,
 *    그 조회가 `contains` 라 같은 문항이 두 작품 아래 나오는 것이 맞다.
 */

/**
 * 작품이 문학인가 비문학인가.
 *
 * `unknown` 은 '아직 모른다' 이지 '둘 다 아니다' 가 아니다 — 영역을 안 붙인 지문에서만 나온다.
 */
export type WorkKind = 'literary' | 'nonliterary' | 'grammar' | 'unknown';

/**
 * 문학을 뜻하는 영역 마스터의 **대영역 이름**.
 *
 * ⚠️ 이 글자는 ara-system 이 소유한 마스터(`public.exam_area_nodes`)의 이름이다 —
 *    초·중·고 세트 모두 대영역이 `'문학'` 이고, 나머지 대영역은 `'독서와 작문'`·`'화법과 언어'`
 *    다(2026-09-21 운영 확인). 마스터에서 이 이름이 바뀌면 여기도 함께 고쳐야 한다.
 *    `grammar-tree.ts` 의 `GRAMMAR_AREA_NAMES` 와 같은 성질의 상수다.
 */
const LITERARY_AREA = '문학';

/**
 * 표가 같을 때 고르는 차례 — 앞엣것이 이긴다.
 *
 * ⚠️ `'unknown'` 은 여기 없다. 영역 없는 지문은 표를 던지지 않으므로(`collectWorkKinds`)
 *    표 계산에 오를 일이 없고, 넣어 두면 '표 0인 unknown' 이 실제 표를 이길 수 있다.
 */
const KIND_VOTE_ORDER: readonly WorkKind[] = ['literary', 'grammar', 'nonliterary'];

/** 지문 한 줄에서 갈래를 가리는 데 필요한 것 */
export interface PassageWorkRow {
  works: readonly PassageWork[];
  /** 지문의 영역 경로 스냅샷 (`passages.area_path`) */
  area_path: readonly string[];
}

/**
 * 영역 경로로 갈래를 가린다.
 *
 * ⚠️ **지은이 유무로 가리면 안 된다.** 『홍길동전』·『청노루』는 지은이 없이 문학이고,
 *    『통일 시대의 우리말』(권재일)·『왜 속도를 고민해야 하는가?』(김용섭)는 지은이 있는
 *    비문학이다 — 운영 데이터에서 양쪽 반례가 다 나온다.
 * ⚠️ **문법은 비문학이 아니다.** 『훈민정음』·『통일 시대의 우리말』은 설명문처럼 생겼지만
 *    묻는 것이 국어 지식이라, 비문학 폴더에 섞이면 독서 지문을 훑을 때 늘 걸리적거린다
 *    (제보 2026-09-22 "훈민정음 같은 경우에는 사실 문법이라서 이걸 비문학 지문에 넣지 않는게
 *    맞는것 같아"). 판정은 검수 화면의 문법 칸과 **같은 함수**(`isGrammarArea`)를 쓴다 —
 *    여기에 영역 이름을 따로 적으면 두 화면이 서로 다른 글을 문법이라고 부르게 된다.
 * @param areaPath - 영역 이름 경로 (['문학', '산문 문학'])
 * @returns 대영역이 '문학' 이면 literary, 문법 영역이면 grammar, 다른 이름이면 nonliterary,
 *          비었으면 unknown
 */
export function workKindOfArea(areaPath: readonly string[]): WorkKind {
  const top = areaPath[0] ?? '';
  if (!top) return 'unknown';
  if (top === LITERARY_AREA) return 'literary';
  return isGrammarArea([...areaPath]) ? 'grammar' : 'nonliterary';
}

/**
 * 지문들의 영역에서 **제목 → 갈래**를 모은다.
 *
 * ⚠️ **문항이 아니라 지문의 영역으로 센다.** 문항의 영역은 *그 물음*의 영역이라, 문학 지문에
 *    딸린 문법 문항은 `화법과 언어 > 언어` 로 태깅된다 — 그것으로 세면 문학 작품이 비문학이 된다.
 *
 * 같은 제목이 여러 갈래의 지문에 걸리면 **많은 쪽**을 따른다
 * (지은이를 '가장 많이 쓰인 이름' 으로 고르는 `collectWorkAuthors` 와 같은 규약).
 * 영역이 없는 지문은 **표를 던지지 않는다** — 표가 하나도 없는 제목은 이 지도에 담기지 않고
 * 트리에서 '영역 미지정' 으로 간다.
 *
 * ⚠️ **동률 우선순위는 `문학 › 문법 › 비문학`**(`KIND_VOTE_ORDER`). 옛 규약이 "동률은 문학"
 *    이었던 까닭 그대로다 — 작품 트리에서 가장 낯선 것이 '문학이 비문학 폴더에 있는' 꼴이고,
 *    그다음이 '문법이 비문학에 섞인' 꼴이다. 갈래를 잘못 말하면 그 작품을 찾을 폴더가
 *    달라지므로, 되돌리기 쉬운 쪽부터 고른다.
 * @param rows - 지문별 작품 목록과 영역 경로
 * @returns 제목 → 갈래 (판정된 것만)
 */
export function collectWorkKinds(rows: readonly PassageWorkRow[]): Map<string, WorkKind> {
  const tally = new Map<string, Map<WorkKind, number>>();
  for (const row of rows) {
    const kind = workKindOfArea(row.area_path);
    // 영역을 모르는 지문은 어느 쪽으로도 세지 않는다
    if (kind === 'unknown') continue;
    for (const work of row.works) {
      if (!work.title) continue;
      const votes = tally.get(work.title) ?? new Map<WorkKind, number>();
      votes.set(kind, (votes.get(kind) ?? 0) + 1);
      tally.set(work.title, votes);
    }
  }

  const out = new Map<string, WorkKind>();
  for (const [title, votes] of tally) {
    let best: WorkKind = KIND_VOTE_ORDER[0];
    for (const kind of KIND_VOTE_ORDER) {
      // `>` 라서 앞선 갈래가 동률을 이긴다 — 순서가 곧 우선순위다
      if ((votes.get(kind) ?? 0) > (votes.get(best) ?? 0)) best = kind;
    }
    out.set(title, best);
  }
  return out;
}

/**
 * 문항별 작품명 목록에서 작품마다 문항 수를 센다.
 * @param rows - 문항별 `work_titles`
 * @returns 작품명 → 문항 수
 */
export function tallyWorkCounts(rows: readonly (readonly string[])[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const titles of rows) {
    // 한 문항 안에 같은 제목이 두 번 들어 있어도 한 번만 센다(DB 가 막지만 옛 행이 있다)
    for (const title of new Set(titles)) {
      if (!title) continue;
      counts.set(title, (counts.get(title) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * 지문들의 작품에서 **제목 → 지은이**를 모은다.
 *
 * 작품 트리가 `지은이 › 작품` 두 단이라 문항 쪽 지은이를 제목으로 되찾아야 한다.
 * 같은 제목에 지은이가 여럿이면(표기가 갈렸거나 동명이작) **가장 많이 쓰인 이름**을 고른다.
 * @param rows - 지문별 작품 목록
 * @returns 제목 → 지은이
 */
export function collectWorkAuthors(
  rows: readonly (readonly PassageWork[])[],
): Map<string, string> {
  const tally = new Map<string, Map<string, number>>();
  for (const works of rows) {
    for (const work of works) {
      if (!work.title || !work.author) continue;
      const byAuthor = tally.get(work.title) ?? new Map<string, number>();
      byAuthor.set(work.author, (byAuthor.get(work.author) ?? 0) + 1);
      tally.set(work.title, byAuthor);
    }
  }

  const out = new Map<string, string>();
  for (const [title, byAuthor] of tally) {
    const best = [...byAuthor.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) out.set(title, best[0]);
  }
  return out;
}

/**
 * 센 결과를 트리·선택지가 쓰는 모양으로.
 *
 * ⚠️ `kinds` 는 **옵셔널이 아니다.** 빠뜨렸을 때 전부 'unknown' 이 되면 작품 트리가 통째로
 *    '영역 미지정' 폴더 하나가 되는데, 화면에는 아무 오류도 안 보인다.
 * @param counts - 작품명 → 문항 수
 * @param authors - 작품명 → 지은이
 * @param kinds - 작품명 → 갈래 (없는 제목은 'unknown')
 * @returns 작품 목록 (제목 한글 사전순)
 */
export function toWorkFacets(
  counts: ReadonlyMap<string, number>,
  authors: ReadonlyMap<string, string>,
  kinds: ReadonlyMap<string, WorkKind>,
): WorkFacet[] {
  return [...counts.entries()]
    .map(([title, count]) => ({
      title,
      author: authors.get(title) ?? '',
      count,
      kind: kinds.get(title) ?? 'unknown',
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'ko'));
}
