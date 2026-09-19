'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  insertItems, isContiguous, moveGroup, moveItem, removeItem, type PaperItem,
} from '@/lib/problem-paper/compose';
import { moveTargetIndex } from '@/lib/problem-paper/dnd';
import { shuffleGroups } from '@/lib/problem-paper/shuffle-groups';
import { bulkAddBlockMessage } from '@/lib/problem-paper/bulk-add';
import { DEFAULT_PAPER_SETTINGS } from '@/lib/problem-paper/settings';
import type { PaperSettings } from '@/types/problem-bank';
import type { ArchiveRow } from './useProblemArchive';

/**
 * 문제지 조합 화면의 상태.
 *
 * 캔버스는 `PaperItem[]` 이고, 화면에 그릴 원본은 id → 행 맵으로 따로 들고 있는다
 * (필터를 바꿔 목록이 갈려도 이미 담은 문항은 그대로 보여야 한다).
 */
export function usePaperComposer() {
  const [items, setItems] = useState<PaperItem[]>([]);
  const [rows, setRows] = useState<Map<string, ArchiveRow>>(new Map());
  const [settings, setSettings] = useState<PaperSettings>(DEFAULT_PAPER_SETTINGS);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  /**
   * 캔버스의 **지금** 값.
   *
   * ⚠️ 담기 판정(상한·중복)은 반드시 이 값으로 한다. 렌더가 닫아 둔 `items` 로 재면
   *    **비동기 사이에 담긴 것**을 못 본다 — 폴더 담기는 조회를 기다리는 동안에도
   *    ＋·끌기로 문항이 늘 수 있어서, 그때 상한을 넘겨 담고 저장에서야 거절당했다
   *    (코덱스 리뷰 2R). 효과로 맞추는 ref 는 렌더 뒤에 갱신돼 여전히 늦으므로,
   *    **모든 변경이 이 ref 를 먼저 고치고** state 를 뒤따르게 한다.
   */
  const itemsRef = useRef<PaperItem[]>([]);
  /**
   * '비우기' 가 몇 번 있었는가.
   *
   * ⚠️ 폴더 담기는 조회를 기다리는 사이에 선생님이 **비우기**를 누를 수 있다. 그때 돌아온
   *    결과를 그대로 담으면 **방금 비운 캔버스가 도로 채워진다**(코덱스 리뷰 3R).
   *    오래 걸리는 담기는 이 값을 잡아 두었다가 돌아와서 견준다.
   */
  const clearSeqRef = useRef(0);

  /** 캔버스를 바꾼다 — ref 를 **동기로** 먼저 맞추고 state 를 따르게 한다 */
  const commit = useCallback((next: PaperItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  /**
   * 여러 문항을 **한 번에** 담는다.
   *
   * ⚠️ 하나씩 `add` 를 되풀이하지 말 것. `insertItems` 는 같은 지문의 문항을 그 묶음 끝으로
   *    보내는데, 한 번에 넘기면 들어온 차례대로 이어 붙지만 나눠 부르면 **호출마다 다시
   *    자리를 찾아** 묶음 안 순서가 뒤집힌다. 상태 갱신도 렌더 한 번으로 끝난다.
   *
   * 상한(200)은 **여기서** 지킨다 — ＋·끌기·선택 담기·폴더 담기가 전부 이 길을 지나므로
   * 한 곳만 막으면 된다. 넘치면 **하나도 담지 않고** 까닭을 알린다(앞에서 잘라 담으면
   * 지문에 딸린 문항이 중간에서 끊겨 저장이 다시 막힌다).
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
    // ⚠️ 받은 목록 **안의 중복**도 여기서 걷는다(코덱스 리뷰 3R). 안 걷으면 같은 문항이
    //    두 번 든 목록이 상한을 두 칸 먹고, 담긴 뒤 '2문항 담았어요' 라고 거짓을 말한다
    //    (`insertItems` 는 실제로 하나만 넣는다)
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
      fresh.map((row) => ({ problemId: row.id, passageId: row.passage_id })),
      at ?? list.length,
    ));
    return { added: fresh.length, skipped: incoming.length - fresh.length };
  }, [commit]);

  const add = useCallback((row: ArchiveRow, at?: number) => {
    addMany([row], at);
  }, [addMany]);

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
   * 지금까지 '비우기' 가 몇 번 있었는가 — 오래 걸리는 담기가 돌아와서 견준다.
   * @returns 세대 번호
   */
  const clearSeq = useCallback(() => clearSeqRef.current, []);

  const added = useMemo(() => new Set(items.map((i) => i.problemId)), [items]);

  /**
   * 문제지를 저장한다. 쓰기는 RPC 한 곳으로만 열려 있고 본문은 서버가 스냅샷으로 굳힌다.
   * @returns 만들어진 문제지 id. 실패하면 null
   */
  const save = useCallback(async (): Promise<string | null> => {
    if (items.length === 0) {
      toast.error('문항을 먼저 담아 주세요.');
      return null;
    }
    if (!title.trim()) {
      toast.error('문제지 제목을 입력해 주세요.');
      return null;
    }
    // 서버(RPC)도 같은 검사를 하지만, 여기서 걸러야 사람이 어디를 고쳐야 할지 안다
    if (!isContiguous(items)) {
      toast.error('같은 지문의 문항이 떨어져 있어요. 붙여 주세요.');
      return null;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('create_problem_paper', {
        p_title: title.trim(),
        p_problem_ids: items.map((i) => i.problemId),
        p_settings: settings,
      });
      if (error) throw error;
      return data as string;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장하지 못했어요.');
      return null;
    } finally {
      setSaving(false);
    }
  }, [items, settings, title]);

  return {
    items, rows, settings, title, saving, added,
    setSettings, setTitle, add, addMany, remove, move, moveWholeGroup, shuffle, clear,
    clearSeq, save,
  };
}
