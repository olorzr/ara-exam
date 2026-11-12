'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  insertItems, moveGroup, moveItem, removeItem, type PaperItem,
} from '@/lib/problem-paper/compose';
import { moveTargetIndex } from '@/lib/problem-paper/dnd';
import { shuffleGroups } from '@/lib/problem-paper/shuffle-groups';
import { bulkAddBlockMessage } from '@/lib/problem-paper/bulk-add';
import { DEFAULT_PAPER_SETTINGS } from '@/lib/problem-paper/settings';
import { buildOmrAnswerKey, type OmrKeyPlan, type OmrKeySource } from '@/lib/problem-paper/omr-payload';
import { refreshClash, refreshGroupItems, type StoredPaperItem } from '@/lib/problem-paper/edit-items';
import { fetchLivePassageIds } from '@/lib/problem-paper/paper-edit';
import type { PaperSettings } from '@/types/problem-bank';
import type { ArchiveRow } from './useProblemArchive';

/** 고치기 화면의 처음 상태 — 저장된 문제지에서 만든다 */
export interface PaperComposerSeed {
  items: readonly PaperItem[];
  title: string;
  settings: PaperSettings;
  /** 저장된 항목 — 항목 id 로. 카드 그리기·OMR 미리보기·뺐다가 다시 담기에 쓴다 */
  stored: ReadonlyMap<string, StoredPaperItem>;
}

/** 만들기 화면에는 처음 상태가 없다 — 렌더마다 새 지도를 만들지 않게 하나를 쓴다 */
const NO_STORED: ReadonlyMap<string, StoredPaperItem> = new Map();
const NO_ITEMS: readonly PaperItem[] = [];

/**
 * 문제지 조합 화면의 상태 — 만들기와 고치기가 같이 쓴다.
 *
 * 캔버스는 `PaperItem[]` 이고, 화면에 그릴 원본은 id → 행 맵으로 따로 들고 있는다
 * (필터를 바꿔 목록이 갈려도 이미 담은 문항은 그대로 보여야 한다). 고치기면 저장된 항목(`seed.stored`)이
 * 기존 자리의 원본 노릇을 한다 — 원본이 그 뒤 바뀌었거나 지워졌어도 인쇄와 같은 스냅샷으로 그린다.
 * 저장은 여기서 하지 않는다(`usePaperCreateSave` · `usePaperEditSave`).
 * @param seed - 고치기 화면의 처음 상태. 만들기면 생략 — ⚠️ 처음 렌더에서만 읽는다(바뀌면 `key` 로 다시 마운트할 것)
 * @returns 캔버스 상태와 바꾸기 동작
 */
export function usePaperComposer(seed?: PaperComposerSeed) {
  const initialItems = seed?.items ?? NO_ITEMS;
  const [items, setItems] = useState<PaperItem[]>(() => [...initialItems]);
  const [rows, setRows] = useState<Map<string, ArchiveRow>>(new Map());
  const [settings, setSettings] = useState<PaperSettings>(seed?.settings ?? DEFAULT_PAPER_SETTINGS);
  const [title, setTitle] = useState(seed?.title ?? '');
  /** '최신 지문으로' 가 지금 지문 id 를 읽는 중인 수 — 그동안 저장을 잠근다(저장이 바꾸기 전 상태로 나가고 화면을 떠난다) */
  const [refreshing, setRefreshing] = useState(0);
  const stored = seed?.stored ?? NO_STORED;

  /**
   * 캔버스의 **지금** 값.
   *
   * ⚠️ 담기 판정(상한·중복)은 반드시 이 값으로 한다. 렌더가 닫아 둔 `items` 로 재면
   *    **비동기 사이에 담긴 것**을 못 본다(코덱스 리뷰 2R). **모든 변경이 이 ref 를 먼저 고치고**
   *    state 를 뒤따르게 한다.
   */
  const itemsRef = useRef<PaperItem[]>([...initialItems]);
  /**
   * '비우기'(고치기면 '처음 상태로') 가 몇 번 있었는가.
   *
   * ⚠️ 폴더 담기는 조회를 기다리는 사이에 선생님이 비울 수 있다. 그때 돌아온 결과를 그대로 담으면
   *    **방금 비운 캔버스가 도로 채워진다**(코덱스 리뷰 3R). 오래 걸리는 담기는 이 값을 잡아 두었다가 돌아와서 견준다.
   */
  const clearSeqRef = useRef(0);

  /** 저장된 항목 가운데 원본이 살아 있는 것 — 문항 id → 처음 자리(뺐다가 다시 담으면 그 항목을 되살린다) */
  const seedByProblem = useMemo(() => {
    const map = new Map<string, PaperItem>();
    for (const item of initialItems) if (item.itemId && stored.get(item.itemId)?.problemId) map.set(item.problemId, item);
    return map;
  }, [initialItems, stored]);

  /** 캔버스를 바꾼다 — ref 를 **동기로** 먼저 맞추고 state 를 따르게 한다 */
  const commit = useCallback((next: PaperItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  /**
   * 여러 문항을 **한 번에** 담는다.
   *
   * ⚠️ 하나씩 `add` 를 되풀이하지 말 것 — `insertItems` 는 같은 지문의 문항을 그 묶음 끝으로 보내는데,
   *    나눠 부르면 호출마다 다시 자리를 찾아 묶음 안 순서가 뒤집힌다.
   * 상한(200)은 **여기서** 지킨다 — ＋·끌기·선택 담기·폴더 담기가 전부 이 길을 지난다. 넘치면 **하나도 담지 않고**
   * 까닭을 알린다(앞에서 잘라 담으면 지문에 딸린 문항이 중간에서 끊겨 저장이 다시 막힌다).
   * 고치기에서 **뺐던 저장 항목**을 다시 담으면 새로 굳히지 않고 그 항목(스냅샷)을 되살린다 — 잘못 누른 ✕ 를 되돌리는 길이다.
   * @param incoming - 담을 행 (읽는 순서로 주어야 지문 묶음이 원본 차례를 지킨다)
   * @param at - 끼워 넣을 자리. 생략하면 맨 뒤
   * @returns 새로 담은 수와 이미 담겨 건너뛴 수. 상한에 막히면 null
   */
  const addMany = useCallback((
    incoming: readonly ArchiveRow[], at?: number,
  ): { added: number; skipped: number } | null => {
    if (incoming.length === 0) return { added: 0, skipped: 0 };

    // ⚠️ 검사와 넣기가 **같은 동기 블록**이라 그 사이에 끼어들 틈이 없다
    const list = itemsRef.current;
    // ⚠️ 받은 목록 **안의 중복**도 여기서 걷는다(코덱스 리뷰 3R)
    const have = new Set(list.map((i) => i.problemId));
    const fresh = incoming.filter((row) => {
      if (have.has(row.id)) return false;
      have.add(row.id);
      return true;
    });
    const blocked = bulkAddBlockMessage(list.length, fresh.length);
    if (blocked) {
      toast.error(blocked);
      return null;
    }

    setRows((map) => {
      const next = new Map(map);
      for (const row of incoming) if (!next.has(row.id)) next.set(row.id, row);
      return next;
    });
    commit(insertItems(
      list,
      fresh.map((row) => seedByProblem.get(row.id) ?? { problemId: row.id, passageId: row.passage_id }),
      at ?? list.length,
    ));
    return { added: fresh.length, skipped: incoming.length - fresh.length };
  }, [commit, seedByProblem]);

  /**
   * 문항 하나를 담는다.
   * @param row - 담을 행
   * @param at - 끼워 넣을 자리. 생략하면 맨 뒤
   * @returns `addMany` 와 같다
   */
  const add = useCallback((
    row: ArchiveRow, at?: number,
  ): { added: number; skipped: number } | null => addMany([row], at), [addMany]);

  // ⚠️ 아래 변경도 **전부** `commit` 을 지난다 — 하나라도 `setItems` 를 직접 부르면
  //    `itemsRef` 가 어긋나 다음 담기가 옛 개수로 상한을 잰다
  const remove = useCallback((problemId: string) => {
    commit(removeItem(itemsRef.current, problemId));
  }, [commit]);

  const move = useCallback((from: number, dropIndex: number) => {
    commit(moveItem(itemsRef.current, from, moveTargetIndex(from, dropIndex)));
  }, [commit]);

  const moveWholeGroup = useCallback((fromGroup: number, toGroup: number) => {
    commit(moveGroup(itemsRef.current, fromGroup, toGroup));
  }, [commit]);

  const shuffle = useCallback(() => {
    commit(shuffleGroups(itemsRef.current));
    toast.success('지문 묶음 순서를 섞었어요.');
  }, [commit]);

  const clear = useCallback(() => {
    clearSeqRef.current += 1;
    commit([]);
  }, [commit]);

  /**
   * 고치기 — 저장된 지문 묶음(start..end)을 **지금 원본으로 다시 굳히게** 바꾼다(항목 id 를 뗀다). 저장하면 묶음의
   * 문항·지문이 지금 문제 은행 것으로 새로 들어간다 — 원본 지문이 그 뒤 바뀐 묶음을 새 지문으로 받는 길이다.
   * ⚠️ 뺐다가 다시 담기로는 안 된다 — 다시 담으면 저장된 항목(옛 판)이 되살아난다(실수로 뺀 문항 되돌리기, 코덱스 2R).
   * 원본이 지워진 항목이 하나라도 있으면 바꾸지 않는다(화면은 그런 묶음에 단추를 안 내고, 그사이 지워졌으면 여기서 막는다).
   * ⚠️ 문항의 **지금** 지문 id 를 읽어 와 다시 묶는다(`refreshGroupItems`, 코덱스 3R) — 지문이 합쳐졌으면 스냅샷의 지문 id 는
   *    서버가 묶는 기준과 다르다. **전부 바꾸거나 하나도 안 바꾼다** — 읽는 사이 캔버스가 조금이라도 바뀌었으면 그만둔다.
   */
  const refreshGroup = useCallback(async (start: number, end: number): Promise<void> => {
    const refreshable = (i: PaperItem) => i.itemId !== undefined && Boolean(stored.get(i.itemId)?.problemId);
    const targets = itemsRef.current.slice(start, end + 1).filter(refreshable);
    if (targets.length === 0) return;
    const seq = clearSeqRef.current;
    /** 누른 때의 캔버스 — 읽는 사이 무엇이든 바뀌었으면(빼기·옮기기·담기·처음 상태로) 바꾸지 않는다(코덱스 8R) */
    const startItems = itemsRef.current;
    const changed = () => itemsRef.current !== startItems || clearSeqRef.current !== seq;
    const targetIds = new Set(targets.map((t) => t.itemId as string));
    const live = new Map<string, string | null>();
    setRefreshing((n) => n + 1);
    try {
      let ask = targets;
      // 지문이 합쳐져 옮겨 갈 묶음에 다른 저장 항목이 있으면 그 묶음도 함께 새로 굳힌다(코덱스 5R) — **겹침이 없어질 때까지**
      // 따라간다(코덱스 7R: 횟수를 정해 끊으면 사슬 끝의 저장 항목이 남아 그 옛 지문이 물려 들어간다). 매번 새 항목이 늘어
      // 캔버스 길이를 넘지 못한다 — 넘으면(있을 수 없다) 바꾸지 않는다
      for (let round = 0; ask.length > 0; round += 1) {
        if (round > itemsRef.current.length) {
          toast.error('합쳐진 지문 묶음을 다 따라가지 못해 최신 지문으로 바꾸지 않았어요.');
          return;
        }
        for (const [id, passage] of await fetchLivePassageIds(ask.map((t) => t.problemId))) live.set(id, passage);
        // 읽는 사이 캔버스가 바뀌었으면 그만둔다 — 빠진 묶음의 지문으로 남은 묶음까지 새로 굳히게 된다
        if (changed()) {
          toast.error('읽는 사이 문제지를 바꿔서 최신 지문으로 바꾸지 않았어요. 다시 눌러 주세요.');
          return;
        }
        // 그사이 원본이 지워진 문항이 있으면 바꾸지 않는다 — 남긴 그 항목의 옛 지문을 서버가 물려줘 반만 바뀐다(코덱스 6R)
        if (ask.some((t) => !live.has(t.problemId))) {
          toast.error('문제 은행에서 지워진 문항이 있어 이 묶음은 최신 지문으로 바꿀 수 없어요.');
          return;
        }
        const clash = refreshClash(itemsRef.current, targetIds, live, refreshable);
        if (clash.orphan) {
          toast.error('같은 지문으로 합쳐진 다른 묶음에 문제 은행에서 지워진 문항이 있어 최신 지문으로 바꿀 수 없어요.');
          return;
        }
        for (const item of clash.items) targetIds.add(item.itemId as string);
        ask = clash.items;
      }
    } catch {
      toast.error('문항 정보를 읽지 못했어요. 다시 눌러 주세요.');
      return;
    } finally {
      setRefreshing((n) => n - 1);
    }
    if (changed()) return;
    commit(refreshGroupItems(itemsRef.current, targetIds, live));
  }, [commit, stored]);

  /** 고치기 — 고친 것을 모두 버리고 저장된 상태로 돌아간다(도는 담기도 버린다) */
  const reset = useCallback(() => {
    clearSeqRef.current += 1;
    commit([...initialItems]);
    setTitle(seed?.title ?? '');
    setSettings(seed?.settings ?? DEFAULT_PAPER_SETTINGS);
  }, [commit, initialItems, seed?.title, seed?.settings]);

  /**
   * 지금까지 '비우기' 가 몇 번 있었는가 — 오래 걸리는 담기가 돌아와서 견준다.
   * @returns 세대 번호
   */
  const clearSeq = useCallback(() => clearSeqRef.current, []);

  const added = useMemo(() => new Set(items.map((i) => i.problemId)), [items]);

  /**
   * OMR 채점을 켰을 때의 정답표 미리보기 — 저장된 자리는 그 스냅샷, 새로 담은 자리는 원본(`rows`)으로 조립한다.
   * 저장된 스냅샷으로 다시 검사하는 것은 서버다(**같은 규칙**). 원본을 못 찾은 문항이 하나라도 있으면 번호가 밀려
   * 거짓을 말하므로 null 로 두고 서버 검사에 맡긴다.
   */
  const omrPlan = useMemo((): OmrKeyPlan | null => {
    if (!settings.omr) return null;
    const sources = items.flatMap((i): OmrKeySource[] => {
      const source = i.itemId ? stored.get(i.itemId)?.snapshot : rows.get(i.problemId);
      return source ? [source] : [];
    });
    return sources.length === items.length ? buildOmrAnswerKey(sources) : null;
  }, [items, rows, stored, settings.omr]);

  return {
    items, rows, stored, settings, title, added, omrPlan, refreshing: refreshing > 0,
    setSettings, setTitle, add, addMany, remove, move, moveWholeGroup, shuffle, clear, reset, refreshGroup, clearSeq,
  };
}

/** 조합 화면의 상태 — 몸통·저장 훅이 받는다 */
export type PaperComposer = ReturnType<typeof usePaperComposer>;
