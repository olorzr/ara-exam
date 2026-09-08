'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  insertItems, isContiguous, moveGroup, moveItem, removeItem, type PaperItem,
} from '@/lib/problem-paper/compose';
import { moveTargetIndex } from '@/lib/problem-paper/dnd';
import { shuffleGroups } from '@/lib/problem-paper/shuffle-groups';
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

  const add = useCallback((row: ArchiveRow, at?: number) => {
    setRows((map) => (map.has(row.id) ? map : new Map(map).set(row.id, row)));
    setItems((list) => insertItems(
      list,
      [{ problemId: row.id, passageId: row.passage_id }],
      at ?? list.length,
    ));
  }, []);

  const remove = useCallback((problemId: string) => {
    setItems((list) => removeItem(list, problemId));
  }, []);

  const move = useCallback((from: number, dropIndex: number) => {
    setItems((list) => moveItem(list, from, moveTargetIndex(from, dropIndex)));
  }, []);

  const moveWholeGroup = useCallback((fromGroup: number, toGroup: number) => {
    setItems((list) => moveGroup(list, fromGroup, toGroup));
  }, []);

  const shuffle = useCallback(() => {
    setItems((list) => shuffleGroups(list));
    toast.success('지문 묶음 순서를 섞었어요.');
  }, []);

  const clear = useCallback(() => setItems([]), []);

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
    setSettings, setTitle, add, remove, move, moveWholeGroup, shuffle, clear, save,
  };
}
