'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { PaperCover } from '@/lib/problem-paper/cover';
import { encodeCoverJpeg } from '@/lib/problem-paper/cover-image';
import {
  fetchPaperCover, removePaperCover, savePaperCover, uploadPaperCoverImage,
} from '@/lib/problem-paper/cover-queries';

/** 저장할 때 새로 고른 그림 — 앞표지·뒷표지 각각(고르지 않았으면 null·생략) */
export interface CoverFiles {
  front?: File | null;
  back?: File | null;
}

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
   * 표지를 저장한다. 새로 고른 그림(앞·뒤)을 JPEG 로 바꿔 올린 **뒤** 행을 쓴다.
   * @returns 저장했으면 true
   */
  save: (next: PaperCover, files?: CoverFiles) => Promise<boolean>;
  /** 표지를 없앤다. @returns 지웠으면 true */
  remove: () => Promise<boolean>;
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * 그림이 있어야 하는데 없는 자리 — 올리기 **전에** 둘 다 본다(앞을 올린 뒤에 뒤가 없다고 멈추면 앞 파일이 고아가 된다).
 * @returns 막아야 하면 그 까닭, 아니면 null
 */
function missingImage(next: PaperCover, files: CoverFiles): string | null {
  if (next.kind === 'image' && !files.front && !next.imagePath) return '표지로 쓸 그림을 골라 주세요.';
  if (next.backKind === 'image' && !files.back && !next.backImagePath) return '뒷표지로 쓸 그림을 골라 주세요.';
  return null;
}

async function uploadIfPicked(paperId: string, file: File | null | undefined): Promise<string | null> {
  if (!file) return null;
  return uploadPaperCoverImage(paperId, await encodeCoverJpeg(file));
}

/**
 * 문제지 표지를 읽고 고친다.
 *
 * ⚠️ 잠금은 state 가 아니라 `busyRef` 다 — 같은 실행 흐름에서 두 번 눌리면 state 는 아직
 *    안 바뀌어 있다(`useSourceDelete` 와 같은 규약). 잠금은 **첫 await 앞**에서 건다.
 * ⚠️ 그림을 올린 뒤 행 쓰기가 실패하면 올린 파일은 고아로 남는다 — 엉뚱한 표지가 걸리는 것보다
 *    낫고, 그림 자르기와 같은 규약이다. 옛 그림 파일도 지우지 않는다(다른 탭이 그 경로로 인쇄 중일 수 있다).
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

  const save = useCallback(async (next: PaperCover, files: CoverFiles = {}) => {
    if (busyRef.current) return false;
    const missing = missingImage(next, files);
    if (missing) {
      toast.error(missing);
      return false;
    }
    busyRef.current = true;
    setSaving(true);
    try {
      const frontPath = next.kind === 'image' ? await uploadIfPicked(paperId, files.front) : null;
      const backPath = next.backKind === 'image' ? await uploadIfPicked(paperId, files.back) : null;
      const target: PaperCover = {
        ...next,
        imagePath: frontPath ?? next.imagePath,
        backImagePath: backPath ?? next.backImagePath,
      };
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
