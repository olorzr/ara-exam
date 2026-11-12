import type { PaperItemSnapshot, PaperSettings } from '@/types/problem-bank';
import { insertItems, type PaperItem } from './compose';

/**
 * 문제지 고치기 — 저장된 항목 ↔ 캔버스 ↔ RPC 인자 (순수 함수).
 *
 * 캔버스는 만들기 화면과 같은 `PaperItem[]` 이다. 기존 항목은 `itemId` 를 들고 있어서 저장할 때
 * `{ item }`(스냅샷 그대로)으로, 새로 담은 문항은 `{ problem }`(지금 원본으로 굳힘)으로 보낸다(sql/103).
 */

/** 고치기 화면이 읽은 저장된 항목 한 개 */
export interface StoredPaperItem {
  id: string;
  orderIndex: number;
  /** 원본 문항이 지워졌으면 null(스냅샷은 남는다) */
  problemId: string | null;
  snapshot: PaperItemSnapshot;
}

/** `update_problem_paper` 에 보내는 한 자리 */
export type PaperEditEntry = { item: string } | { problem: string };

/** 원본이 지워진 기존 항목의 캔버스 열쇠 앞머리 — UUID 에는 쌍점이 없어 아카이브 행 id 와 겹치지 않는다 */
const ORPHAN_KEY_PREFIX = 'item:';

/**
 * 저장된 항목의 캔버스 열쇠.
 *
 * 원본이 살아 있으면 **문항 id** 를 쓴다 — 그래야 아카이브의 '담김' 표시·중복 막기가 그대로 된다.
 * @param item - 저장된 항목
 * @returns 열쇠
 */
export function storedItemKey(item: Pick<StoredPaperItem, 'id' | 'problemId'>): string {
  return item.problemId ?? `${ORPHAN_KEY_PREFIX}${item.id}`;
}

/**
 * 저장된 항목을 캔버스 항목으로 — 지문은 **스냅샷의 지문 id** 로 묶는다(인쇄가 묶는 기준).
 * @param stored - 저장된 항목(차례대로)
 * @returns 캔버스 항목
 */
export function toCanvasItems(stored: readonly StoredPaperItem[]): PaperItem[] {
  return stored.map((s) => ({
    problemId: storedItemKey(s),
    passageId: s.snapshot.passage?.id ?? null,
    itemId: s.id,
  }));
}

/**
 * 캔버스를 RPC 인자로 — 기존 항목은 `{ item }`, 새 문항은 `{ problem }`.
 * @param items - 캔버스(차례대로)
 * @returns 보낼 목록
 */
export function toEditEntries(items: readonly PaperItem[]): PaperEditEntry[] {
  return items.map((i) => (i.itemId ? { item: i.itemId } : { problem: i.problemId }));
}

/**
 * 두 캔버스가 같은가 — 자리마다 열쇠와 항목 id 가 같아야 한다.
 * @param a - 캔버스
 * @param b - 캔버스
 * @returns 같으면 true
 */
export function sameCanvas(a: readonly PaperItem[], b: readonly PaperItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.problemId === b[i].problemId && item.itemId === b[i].itemId);
}

/** 고치기 화면의 처음 상태 — 비교 기준 */
export interface PaperEditBaseline {
  items: readonly PaperItem[];
  title: string;
  settings: PaperSettings;
}

/**
 * 처음 상태에서 고친 것이 있는가 — 차례·제목·단 수·출처 숨기기.
 * (OMR 은 만들 때만 정해 고치기 화면에서 바뀌지 않는다)
 * @param baseline - 처음 상태
 * @param now - 지금 상태
 * @returns 고쳤으면 true
 */
export function isPaperEditDirty(baseline: PaperEditBaseline, now: PaperEditBaseline): boolean {
  if (!sameCanvas(baseline.items, now.items)) return true;
  if (baseline.title.trim() !== now.title.trim()) return true;
  return baseline.settings.columns !== now.settings.columns
    || baseline.settings.showSource !== now.settings.showSource;
}

/**
 * '최신 지문으로' — 고른 저장 항목들의 항목 id 를 떼고 **지금 원본의 지문 id** 로 다시 묶는다.
 *
 * 스냅샷의 지문 id 를 그대로 두면 안 된다(코덱스 3R): 지문이 합쳐져 원본 문항의 지문이 바뀌었으면 서버는 새 문항을
 * 지금 지문 id 로 묶는데 캔버스는 옛 id 로 묶어, 화면 검사는 통과하고 저장에서 '떨어져 있다' 로 막힌다.
 * 그래서 빼낸 뒤 `insertItems` 로 다시 넣는다 — 같은 지문 묶음이 이미 있으면 그 끝으로 붙는다.
 * 원본이 사라져 `live` 에 없는 항목은 저장된 그대로 둔다.
 * @param items - 지금 캔버스
 * @param itemIds - 다시 굳힐 저장 항목 id
 * @param live - 문항 id → 지금 원본의 지문 id(지문 없으면 null). 없는 문항은 원본이 사라진 것
 * @returns 새 캔버스
 */
export function refreshGroupItems(
  items: readonly PaperItem[], itemIds: ReadonlySet<string>, live: ReadonlyMap<string, string | null>,
): PaperItem[] {
  const isTarget = (i: PaperItem) => i.itemId !== undefined && itemIds.has(i.itemId) && live.has(i.problemId);
  const firstIdx = items.findIndex(isTarget);
  if (firstIdx < 0) return [...items];
  const rest = items.filter((i) => !isTarget(i));
  const at = items.slice(0, firstIdx).filter((i) => !isTarget(i)).length;
  const fresh = items.filter(isTarget).map((i) => ({ problemId: i.problemId, passageId: live.get(i.problemId) ?? null }));
  return insertItems(rest, fresh, at);
}

/** 함께 새로 굳혀야 할 다른 저장 항목 */
export interface RefreshClash {
  /** 다시 굳힐 수 있는 저장 항목(원본이 살아 있다) */
  items: PaperItem[];
  /** 원본이 지워진 저장 항목이 끼어 있다 — 그 항목의 옛 지문이 물려 들어가 반만 바뀌므로 막는다 */
  orphan: boolean;
}

/**
 * '최신 지문으로' 가 지금 지문 id 로 옮겨 갈 묶음에 **다른 저장 항목**이 이미 있는가(지문이 합쳐진 경우, 코덱스 5R).
 *
 * 서버는 같은 지문의 남긴 항목이 있으면 그 지문 판을 물려준다. 합쳐진 지문 B 의 저장 묶음이 캔버스에 남아 있으면 A 를 새로
 * 굳혀도 B 의 옛 판(합치기 전)을 물려받아 A 문항이 묻는 글이 빠질 수 있다 — 그래서 그 묶음도 함께 새로 굳힌다.
 * @param items - 지금 캔버스
 * @param targetIds - 이미 새로 굳히기로 한 저장 항목 id
 * @param live - 그 항목들의 지금 지문 id
 * @param refreshable - 원본이 살아 있는 저장 항목인가
 * @returns 함께 새로 굳힐 항목과, 막아야 하는지
 */
export function refreshClash(
  items: readonly PaperItem[], targetIds: ReadonlySet<string>, live: ReadonlyMap<string, string | null>,
  refreshable: (item: PaperItem) => boolean,
): RefreshClash {
  const passages = new Set([...live.values()].filter((v): v is string => v !== null));
  const clash = items.filter((i) => i.itemId !== undefined && !targetIds.has(i.itemId)
    && i.passageId !== null && passages.has(i.passageId));
  return { items: clash.filter(refreshable), orphan: clash.some((i) => !refreshable(i)) };
}
