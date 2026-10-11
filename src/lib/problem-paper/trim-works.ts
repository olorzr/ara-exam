import { boxKind } from '@/lib/box-labels';
import { createHost } from '@/lib/print/table-dom';
import { figureNumbersIn } from '@/lib/problem-bank/figure-placeholders';
import { sanitizeProblemHTML } from '@/lib/sanitize-problem';
import { splitWorkTitles, workTitleKey } from '@/lib/problem-bank/work-title';
import type { PaperItemSnapshot, PaperPassageSnapshot, PassageWork } from '@/types/problem-bank';
import { groupsOf } from './compose';

/**
 * (가)(나) 복합 지문에서 **담은 문항이 묻지 않는 작품의 구역**을 빼고 인쇄한다 (DOM 파싱, 브라우저 전용).
 *
 * 원장님 요청(2026-10-11) — "해당 문학 작품만 있는 문제만 뽑아 쓸 수 있도록". 사용자 결정으로
 * 복합 지문이어도 발문이 한 작품만 묻는 문항은 아카이브에 남기고(`solo-filter.ts`), 문제지에서는
 * **그 작품의 구역만** 찍는다. 인쇄 화면의 체크박스로 켜고 끈다(`print-trim-pref.ts`, 기본 켜짐).
 *
 * ⚠️ **확실할 때만 뺀다 — 하나라도 어긋나면 `null`(지문 전체 인쇄)이다.** 잘못 빼면 문항이 묻는
 *    글이 인쇄물에서 사라지고, 그 사실은 시험을 볼 때에야 드러난다. 더 찍히는 것은 눈에 보인다.
 *    - 스냅샷에 `works` 가 없다(sql/68 이전 문제지) · 작품이 두 편 미만
 *    - 구역 표시가 `(가)`~`(차)` 하나가 아니다(`'가~라'` 범위, 빈 표시, `[A]`) · 표시가 겹친다
 *    - 표시마다 **최상위** `<blockquote data-box="가">` 가 정확히 하나가 아니다(글자 `(가)` 로만
 *      적힌 지문) · 작품 상자 **안에** 다른 (가)~(차) 상자가 있다(어느 작품의 글인지 모른다, 코덱스 1R)
 *    - 묶음의 문항 하나라도 작품 목록이 비었다('지문 전체' 라는 뜻) · 지문에 없는 작품을 묻는다
 *    - 뺄 것이 없다(전부 묻는다)
 * ⚠️ **작품으로 등록되지 않은 구역은 남긴다.** 운영의 복합 지문 112건에 `works` 에 없는 (가)·(다)
 *    상자(비평문·학생 글·빠진 시)가 함께 실려 있다 — 무엇인지 모르는 글은 빼지 않는다. 머리 문단·
 *    〈보기〉·[A] 같은 상자 밖·다른 상자도 그대로다.
 * ⚠️ 구역 머리 `(가)` 는 다시 매기지 않는다 — 발문이 "(나)의 화자는" 이라 그 글자가 필요하다.
 */

/** 이 묶음에서 뺀 구역 — 화면이 무엇이 빠졌는지 말할 때 쓴다 */
export interface TrimmedPassage {
  /** **정화가 끝난** 본문에서 구역을 뺀 HTML */
  html: string;
  dropped: PassageWork[];
  /**
   * 뺀 구역에만 있던 그림 경로 — 인쇄 준비(서명·로딩 확인)에서 뺀다. 안 빼면 인쇄하지도 않을
   * 그림이 깨졌다고 인쇄 단추가 잠긴다(코덱스 1R)
   */
  droppedFigures: string[];
}

/**
 * 문항 하나가 묻는 작품 목록 — 스냅샷의 배열이 원본이고, 옛 스냅샷은 파생 문자열로 물러선다.
 * @param item - 문항 스냅샷
 * @returns 작품명 목록 (비었으면 '지문 전체')
 */
function askedOf(item: PaperItemSnapshot): string[] {
  return item.work_titles ?? splitWorkTitles(item.work_title);
}

/**
 * 묶음의 문항들이 묻는 작품 **열쇠**의 합집합.
 * @param group - 같은 지문에 딸린 문항 스냅샷들
 * @returns 열쇠 집합. 한 문항이라도 '지문 전체' 를 물으면 null
 */
function askedKeysOf(group: readonly PaperItemSnapshot[]): Set<string> | null {
  const keys = new Set<string>();
  for (const item of group) {
    const titles = askedOf(item);
    if (titles.length === 0) return null;
    for (const title of titles) keys.add(workTitleKey(title));
  }
  return keys.size > 0 ? keys : null;
}

/**
 * 작품마다 구역 표시가 (가)~(차) 하나씩이고 겹치지 않는가.
 * @param works - 지문의 작품들
 * @returns 믿을 수 있으면 true
 */
function hasDistinctParenLabels(works: readonly PassageWork[]): boolean {
  const labels = works.map((w) => w.label);
  return labels.every((label) => boxKind(label) === 'paren') && new Set(labels).size === labels.length;
}

/**
 * 최상위 자식 가운데 이 표시를 단 구역 상자들.
 * @param host - 파싱한 지문
 * @param label - 구역 표시
 * @returns 그 상자들
 */
function topLevelBoxes(host: HTMLElement, label: string): Element[] {
  return Array.from(host.children)
    .filter((el) => el.tagName === 'BLOCKQUOTE' && el.getAttribute('data-box') === label);
}

/**
 * 묶음이 묻지 않는 작품의 구역을 뺀 지문 HTML.
 * @param passage - 지문 스냅샷
 * @param group - 그 지문에 딸려 문제지에 담긴 문항 스냅샷들
 * @returns 뺀 결과. 확실하지 않으면 null — 부르는 쪽은 지문 전체를 인쇄한다
 */
export function trimPassageToAskedWorks(
  passage: PaperPassageSnapshot, group: readonly PaperItemSnapshot[],
): TrimmedPassage | null {
  const works = passage.works ?? [];
  if (works.length < 2 || passage.render_mode === 'image') return null;
  if (!hasDistinctParenLabels(works)) return null;

  const asked = askedKeysOf(group);
  if (!asked) return null;
  const workKeys = new Set(works.map((w) => workTitleKey(w.title)));
  // 지문에 없는 작품을 묻는다 — 어느 구역인지 모른다
  for (const key of asked) if (!workKeys.has(key)) return null;

  const dropped = works.filter((w) => !asked.has(workTitleKey(w.title)));
  if (dropped.length === 0 || dropped.length === works.length) return null;

  // ⚠️ **정화한 뒤에** DOM 을 만든다(코덱스 1R). `createHost` 는 살아 있는 문서에 `innerHTML` 을
  //    넣으므로, 스냅샷 jsonb 에 섞여 든 `<img onerror>` 가 떨어진 노드에서도 돈다 — 정화 → DOM 변환이
  //    이 저장소의 규약이다(blocks.ts 의 다층 방어). 두 번 정화돼도 결과는 같다
  const host = createHost(sanitizeProblemHTML(passage.html));
  if (!host) return null;
  const boxes = works.map((w) => topLevelBoxes(host, w.label));
  if (boxes.some((found) => found.length !== 1)) return null;
  if (boxes.some(([box]) => hasNestedParenBox(box))) return null;

  const placed = new Set(figureNumbersIn(host.innerHTML));
  const droppedBoxes = dropped.map((w) => topLevelBoxes(host, w.label)[0]);
  const droppedNumbers = new Set(droppedBoxes.flatMap((box) => figureNumbersIn(box.outerHTML)));
  droppedBoxes.forEach((box) => box.remove());
  return {
    html: host.innerHTML,
    dropped,
    droppedFigures: unusedFigurePaths(passage.figure_paths ?? [], placed, droppedNumbers, figureNumbersIn(host.innerHTML)),
  };
}

/**
 * 뺀 구역에만 있던 그림 경로 — **남은 그림이 같은 경로를 쓰면 빼지 않는다**(코덱스 2R).
 * 남는 그림은 둘이다: 남은 글의 자리표시자, 그리고 자리표시자가 아예 없어 지문 끝에 붙는 그림.
 * @param figures - 지문 그림 경로들 (1번이 index 0)
 * @param placed - 빼기 전 본문에 자리표시자가 있던 순번들
 * @param droppedNumbers - 뺀 구역 안의 순번들
 * @param keptNumbers - 뺀 뒤 본문에 남은 순번들
 * @returns 인쇄하지 않게 된 경로
 */
function unusedFigurePaths(
  figures: readonly string[], placed: ReadonlySet<number>,
  droppedNumbers: ReadonlySet<number>, keptNumbers: readonly number[],
): string[] {
  const keptPaths = new Set<string>();
  figures.forEach((path, i) => {
    const n = i + 1;
    if (path && (!placed.has(n) || keptNumbers.includes(n))) keptPaths.add(path);
  });
  const out = new Set<string>();
  for (const n of droppedNumbers) {
    const path = figures[n - 1];
    if (path && !keptPaths.has(path)) out.add(path);
  }
  return [...out];
}

/**
 * 작품 상자 안에 (가)~(차) 상자가 또 있는가 — 있으면 그 글이 어느 작품 것인지 모른다.
 * 바깥 상자를 빼면 등록되지 않은 안쪽 구역까지 함께 사라진다(코덱스 1R). [A]·〈보기〉는 그 작품의 일부다.
 * @param box - 작품 상자
 * @returns 안쪽에 구역 표시 상자가 있으면 true
 */
function hasNestedParenBox(box: Element): boolean {
  return Array.from(box.querySelectorAll('blockquote[data-box]'))
    .some((inner) => boxKind(inner.getAttribute('data-box') ?? '') === 'paren');
}

/** 문제지 안의 지문 묶음 하나 */
interface PassageGroup {
  passage: PaperPassageSnapshot;
  group: PaperItemSnapshot[];
}

/**
 * 문제지 항목을 지문 묶음으로 — 인쇄 블록(`buildPaperBlocks`)과 **같은 `groupsOf`** 로 묶는다.
 * @param items - 문제지 항목 (order_index 순서)
 * @returns 지문이 있는 묶음들
 */
function passageGroupsOf(items: readonly PaperItemSnapshot[]): PassageGroup[] {
  const groups = groupsOf(items.map((item, index) => ({
    problemId: String(index), passageId: item.passage?.id ?? null,
  })));
  return groups.flatMap(({ start, end }) => {
    const passage = items[start].passage;
    return passage ? [{ passage, group: items.slice(start, end + 1) }] : [];
  });
}

/**
 * 문제지 안에 구역을 뺄 수 있는 지문 묶음이 있는가 — 없으면 인쇄 화면이 체크박스를 그리지 않는다.
 * @param items - 문제지 항목 (order_index 순서). 같은 지문의 문항은 붙어 있다(compose.isContiguous)
 * @returns 뺄 수 있는 묶음 수
 */
export function trimmableGroupCount(items: readonly PaperItemSnapshot[]): number {
  return passageGroupsOf(items)
    .filter(({ passage, group }) => trimPassageToAskedWorks(passage, group) !== null).length;
}

/**
 * 구역을 빼면 인쇄하지 않게 되는 그림 경로들 — **지문마다** 따로 든다(인쇄 준비 확인에서 뺀다).
 * ⚠️ 문제지 전체에서 한 집합으로 빼면 다른 지문·문항이 같은 경로를 쓸 때 그쪽까지 빠진다(코덱스 2R).
 * @param items - 문제지 항목 (order_index 순서)
 * @returns 지문 id → 그 지문에서 뺀 구역에만 있던 그림 경로
 */
export function trimmedFigurePaths(items: readonly PaperItemSnapshot[]): Map<string, Set<string>> {
  const byPassage = new Map<string, Set<string>>();
  for (const { passage, group } of passageGroupsOf(items)) {
    const dropped = trimPassageToAskedWorks(passage, group)?.droppedFigures ?? [];
    if (dropped.length > 0) byPassage.set(passage.id, new Set(dropped));
  }
  return byPassage;
}
