'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { PaperCover } from '@/lib/problem-paper/cover';
import { encodeCoverJpeg } from '@/lib/problem-paper/cover-image';
import {
  fetchPaperCover, removePaperCover, savePaperCover, uploadPaperCoverImage,
} from '@/lib/problem-paper/cover-queries';

/** 표지 상태와 조작 */
export interface PaperCoverState {
  /** 지금 표지 (없으면 null) */
  cover: PaperCover | null;
  /** 처음 읽는 중인가 — 그동안은 인쇄를 막는다(표지가 빠진 채 나가면 안 된다) */
  loading: boolean;
  /**
   * 표지를 **읽지 못했는가.** '표지 없음' 과 다르다 — 있는 표지가 빠진 채 인쇄될 수 있어
   * 호출부가 인쇄를 막고 다시 읽거나 표지 없이 가기를 고르게 한다(코덱스 1R).
   */
  failed: boolean;
  /** 다시 읽는다 */
  reload: () => void;
  /** 저장·삭제 중인가 */
  saving: boolean;
  /**
   * 표지를 저장한다. 그림 표지면 `imageFile` 을 JPEG 로 바꿔 올린 **뒤** 행을 쓴다.
   * @returns 저장했으면 true
   */
  save: (next: PaperCover, imageFile?: File | null) => Promise<boolean>;
  /** 표지를 없앤다. @returns 지웠으면 true */
  remove: () => Promise<boolean>;
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * 문제지 표지를 읽고 고친다.
 *
 * ⚠️ 잠금은 state 가 아니라 `busyRef` 다 — 같은 실행 흐름에서 두 번 눌리면 state 는 아직
 *    안 바뀌어 있다(`useSourceDelete` 와 같은 규약). 잠금은 **첫 await 앞**에서 건다.
 * ⚠️ 그림을 올린 뒤 행 쓰기가 실패하면 올린 파일은 고아로 남는다 — 엉뚱한 표지가 걸리는 것보다
 *    낫고, 그림 자르기와 같은 규약이다.
 * @param paperId - 문제지 id
 * @returns 표지 상태
 */
export function usePaperCover(paperId: string): PaperCoverState {
  const [cover, setCover] = useState<PaperCover | null>(null);
  /** 무엇을 읽어 두었고 실패했는가 — 로딩은 여기서 파생한다(효과 안 동기 setState 금지 규약) */
  const [loaded, setLoaded] = useState<{ key: string; failed: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loadKey = `${paperId}#${attempt}`;
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    if (!paperId) return;
    let alive = true;
    const key = `${paperId}#${attempt}`;
    fetchPaperCover(paperId)
      .then((next) => {
        if (!alive) return;
        setCover(next);
        setLoaded({ key, failed: false });
      })
      .catch((e) => {
        if (!alive) return;
        // 표지를 못 읽은 것은 '표지 없음' 과 다르다 — 앞 문제지의 표지가 남지 않게 비우고
        // 실패로 표시해 호출부가 인쇄를 막게 한다
        setCover(null);
        setLoaded({ key, failed: true });
        toast.error(`표지를 불러오지 못했어요. ${message(e, '')}`.trim());
      });
    return () => { alive = false; };
  }, [paperId, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const save = useCallback(async (next: PaperCover, imageFile?: File | null) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setSaving(true);
    try {
      let target = next;
      if (next.kind === 'image' && imageFile) {
        const jpeg = await encodeCoverJpeg(imageFile);
        target = { ...next, imagePath: await uploadPaperCoverImage(paperId, jpeg) };
      }
      if (target.kind === 'image' && !target.imagePath) {
        toast.error('표지로 쓸 그림을 골라 주세요.');
        return false;
      }
      const saved = await savePaperCover(paperId, target);
      if (aliveRef.current) {
        setCover(saved);
        // 저장한 값이 곧 DB 값이다 — 앞서 읽기가 실패했더라도 이제 표지를 안다
        setLoaded({ key: loadKey, failed: false });
      }
      toast.success('표지를 저장했어요.');
      return true;
    } catch (e) {
      toast.error(message(e, '표지를 저장하지 못했어요.'));
      return false;
    } finally {
      busyRef.current = false;
      if (aliveRef.current) setSaving(false);
    }
  }, [paperId, loadKey]);

  const remove = useCallback(async () => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setSaving(true);
    try {
      await removePaperCover(paperId);
      if (aliveRef.current) {
        setCover(null);
        setLoaded({ key: loadKey, failed: false });
      }
      toast.success('표지를 뺐어요.');
      return true;
    } catch (e) {
      toast.error(message(e, '표지를 빼지 못했어요.'));
      return false;
    } finally {
      busyRef.current = false;
      if (aliveRef.current) setSaving(false);
    }
  }, [paperId, loadKey]);

  const current = loaded?.key === loadKey ? loaded : null;
  return {
    cover,
    loading: paperId !== '' && current === null,
    failed: current?.failed ?? false,
    reload,
    saving,
    save,
    remove,
  };
}
