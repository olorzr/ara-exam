'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { toBookCoverJson, uploadBookCoverImage, type BookPatch } from '@/lib/book';
import type { PaperCover } from '@/lib/problem-paper/cover';
import { encodeCoverJpeg } from '@/lib/problem-paper/cover-image';
import { missingCoverImage, type CoverFiles } from './usePaperCover';

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * 책 표지 저장·빼기 — 문제지 표지(`usePaperCover`)와 같은 규약이고 저장 자리만 `books.cover` 다.
 *
 * 새로 고른 그림(앞·뒤)을 JPEG 로 바꿔 `books/{id}/` 에 올린 **뒤** 행을 쓴다. 잠금은 첫 await 앞의 ref 다.
 * 행 쓰기는 책의 다른 쓰기와 **같은 줄**(`useBook.save`)로 보낸다 — 따로 보내면 설정 저장과 겹쳐 서로를 덮는다(코덱스 2R).
 * 그림을 올린 뒤 행 쓰기가 실패하면 올린 파일은 고아로 남는다(표지 규약 — 엉뚱한 표지가 걸리는 것보다 낫다).
 * @param bookId - 책 id
 * @param save - 책 칸 저장(`useBook.save` — 실패는 그쪽이 알린다)
 * @returns 저장 중 여부·저장·빼기
 */
export function useBookCover(bookId: string, save: (patch: BookPatch) => Promise<boolean>) {
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const upload = useCallback(async (file: File | null | undefined) => (
    file ? uploadBookCoverImage(bookId, await encodeCoverJpeg(file)) : null
  ), [bookId]);

  const saveCover = useCallback(async (next: PaperCover, files: CoverFiles = {}): Promise<boolean> => {
    if (busyRef.current) return false;
    const missing = missingCoverImage(next, files);
    if (missing) {
      toast.error(missing);
      return false;
    }
    busyRef.current = true;
    setSaving(true);
    try {
      const frontPath = next.kind === 'image' ? await upload(files.front) : null;
      const backPath = next.backKind === 'image' ? await upload(files.back) : null;
      const target: PaperCover = {
        ...next, imagePath: frontPath ?? next.imagePath, backImagePath: backPath ?? next.backImagePath,
      };
      const ok = await save({ cover: toBookCoverJson(target) });
      if (ok) toast.success('표지를 저장했어요.');
      return ok;
    } catch (e) {
      // 그림 올리기 실패 — 행 쓰기 실패는 save 가 알린다
      toast.error(message(e, '표지 그림을 올리지 못했어요.'));
      return false;
    } finally {
      busyRef.current = false;
      if (aliveRef.current) setSaving(false);
    }
  }, [save, upload]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setSaving(true);
    try {
      const ok = await save({ cover: null });
      if (ok) toast.success('표지를 뺐어요.');
      return ok;
    } finally {
      busyRef.current = false;
      if (aliveRef.current) setSaving(false);
    }
  }, [save]);

  return { saving, save: saveCover, remove };
}
