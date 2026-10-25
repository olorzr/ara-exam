'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { fetchCreatorNames } from '@/lib/creator-names';
import {
  addChapter as insertChapter, BOOK_CHAPTERS_MAX, bookCoverOf, CHAPTER_TITLE_MAX, fetchBook,
  removeChapter as deleteChapter, reorderChapters, updateBook, updateChapterTitle,
  type Book, type BookChapter, type BookEdition, type BookPageCount, type BookPatch,
} from '@/lib/book';

/** 읽어 둔 책 — 어느 책의 것인지와 함께 든다 */
interface Loaded {
  key: string;
  book: Book | null;
  chapters: BookChapter[];
  /** 책을 만든 사람 이름 — 디자인 표지의 '선생님' 줄이 비었을 때 쓴다 */
  creatorName: string;
  failed: boolean;
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** 보낼 칸을 화면 값에 미리 얹는다(낙관적 반영) */
function applyPatch(book: Book, patch: BookPatch): Book {
  return {
    ...book,
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.settings ? { settings: patch.settings } : {}),
    ...(patch.page_counts ? { pageCounts: patch.page_counts } : {}),
    ...(patch.cover !== undefined ? { cover: bookCoverOf(patch.cover) } : {}),
  };
}

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

/**
 * 책 한 권 — 읽기와 고치기(제목·설정·표지·장 차례·쪽 수 기록).
 *
 * ⚠️ 지금 값은 `latestRef` 가 정본이다 — 쪽 수 기록은 다른 판의 기록과 합쳐 jsonb 한 칸을 통째로 보내는데,
 *    렌더에서 닫아 둔 값으로 합치면 그 사이 저장된 다른 판의 기록을 지운다. 모든 변경이 `commit` 을 지난다.
 * ⚠️ 장 바꾸기(더하기·빼기·옮기기·제목)는 줄 하나(`chapterQueueRef`)에 서서 하나씩 돈다 — 겹치면 차례·제목이 서로를 덮는다.
 * ⚠️ 제목·설정 저장은 **보내기 전에 화면에 먼저 얹는다**(낙관적). 설정은 jsonb 를 통째로 보내므로, 앞 저장의 응답이
 *    오기 전에 다른 칸을 고치면 렌더에서 닫아 둔 옛 설정으로 앞의 변경을 되돌린다. 응답은 **가장 나중에 보낸 쓰기의 것만**
 *    받는다(`writeSeqRef`) — 늦게 온 옛 응답이 새 값을 덮지 않게. 실패하면 마지막으로 서버가 돌려준 책으로 되돌린다.
 *    쪽 수 기록은 낙관적으로 얹지 않는다 — 얹으면 저장값이 곧바로 같아져 실패를 알아채지 못하고, 되돌리면 다시 보내기를 끝없이 되풀이한다.
 * @param bookId - 책 id
 * @param enabled - 읽어도 되는가(원장 확인을 마쳤는가)
 * @returns 책 상태와 조작
 */
export function useBook(bookId: string, enabled: boolean) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const latestRef = useRef<Loaded | null>(null);
  /** 마지막으로 서버가 돌려준 책 — 쓰기가 실패하면 여기로 되돌린다 */
  const confirmedRef = useRef<Book | null>(null);
  /** 쓰기 차례 — 가장 나중에 보낸 쓰기의 응답만 화면에 받는다 */
  const writeSeqRef = useRef(0);
  /** 장마다 DB 에 들어간 마지막 제목 — 제목 저장이 실패하면 여기로 되돌린다 */
  const savedTitlesRef = useRef(new Map<string, string>());
  /** 장마다 제목 저장 차례 — 가장 나중의 제목 저장만 되돌린다 */
  const titleSeqRef = useRef(new Map<string, number>());

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled || !bookId) return;
    let alive = true;
    (async () => {
      let next: Loaded = { key: bookId, book: null, chapters: [], creatorName: '', failed: false };
      try {
        const { book, chapters } = await fetchBook(bookId);
        const names = book ? await fetchCreatorNames([book.userId]) : new Map<string, string>();
        next = { ...next, book, chapters, creatorName: book ? names.get(book.userId) ?? '' : '' };
      } catch (e) {
        if (alive) toast.error(message(e, '책을 불러오지 못했어요.'));
        next = { ...next, failed: true };
      }
      if (!alive) return;
      latestRef.current = next;
      confirmedRef.current = next.book;
      savedTitlesRef.current = new Map(next.chapters.map((c) => [c.id, c.titleOverride]));
      setLoaded(next);
    })();
    return () => { alive = false; };
  }, [bookId, enabled]);

  const commit = useCallback((update: (prev: Loaded) => Loaded) => {
    const prev = latestRef.current;
    if (!prev || prev.key !== bookId) return;
    const next = update(prev);
    latestRef.current = next;
    setLoaded(next);
  }, [bookId]);

  /**
   * 책 칸 쓰기 — **모두 한 줄에 서서** 보낸 차례대로 DB 에 닿는다. 설정·쪽 수는 jsonb 를 통째로 바꾸므로 겹쳐 보내면 먼저
   * 보낸 요청이 나중에 닿아 새 값을 덮을 수 있다(코덱스 2R — 응답만 거르는 것으로는 DB 가 지켜지지 않는다).
   * 보낼 본문은 차례가 왔을 때 만든다(`makePatch`) — 쪽 수는 서버가 마지막으로 돌려준 기록에 합쳐야 다른 판의 기록을
   * 지우지 않는다(코덱스 1R). 낙관적 쓰기는 본문을 **부를 때** 화면에 얹는다(다음 변경이 그 위에서 만들어지게).
   */
  const writeQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const write = useCallback((
    makePatch: () => BookPatch | null, optimistic: boolean, failMessage: string,
  ): Promise<boolean> => {
    const seq = ++writeSeqRef.current;
    const early = optimistic ? makePatch() : null;
    if (early) commit((prev) => (prev.book ? { ...prev, book: applyPatch(prev.book, early) } : prev));
    const run = writeQueueRef.current.then(async () => {
      const patch = early ?? makePatch();
      if (!patch) return false;
      try {
        const saved = await updateBook(bookId, patch);
        confirmedRef.current = saved;
        if (seq === writeSeqRef.current) commit((prev) => ({ ...prev, book: saved }));
        return true;
      } catch (e) {
        toast.error(message(e, failMessage));
        // 줄의 **마지막** 쓰기가 실패하면 서버가 마지막으로 돌려준 책으로 되돌린다 — 이 쓰기가 낙관적이 아니어도(쪽 수)
        // 앞서 실패한 낙관적 쓰기가 화면에 남아 있을 수 있다(코덱스 3R). 뒤에 쓰기가 남았으면 그 쓰기가 정한다
        const confirmed = confirmedRef.current;
        if (seq === writeSeqRef.current && confirmed) commit((prev) => ({ ...prev, book: confirmed }));
        return false;
      }
    });
    writeQueueRef.current = run.catch(() => false);
    return run;
  }, [bookId, commit]);

  /** 제목·설정·표지 칸을 저장한다. @returns 저장했으면 true */
  const save = useCallback((patch: BookPatch) => write(() => patch, true, '책을 저장하지 못했어요.'), [write]);

  /** 판 하나의 잰 쪽 수를 기록한다 — 차례가 왔을 때 서버가 돌려준 마지막 기록에 합친다 */
  const savePageCount = useCallback((edition: BookEdition, count: BookPageCount): Promise<boolean> => write(() => {
    const current = confirmedRef.current ?? latestRef.current?.book;
    return current ? { page_counts: { ...current.pageCounts, [edition]: count } } : null;
  }, false, '쪽 수를 저장하지 못했어요.'), [write]);

  /**
   * 장 바꾸기(더하기·빼기·옮기기·제목)를 **줄을 세워** 하나씩 돌린다. 제목을 고친 칸을 떠나며 곧바로 옮기기를 누르면
   * 두 요청이 겹치는데, 옮기기가 옛 제목으로 장을 다시 써서 바꾼 제목을 되돌린다(코덱스 1R). 줄이 비면 `busy` 가 풀린다.
   */
  const chapterQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef(0);
  const locked = useCallback((work: () => Promise<void>): Promise<void> => {
    pendingRef.current += 1;
    setBusy(true);
    const run = chapterQueueRef.current.then(work).catch(() => {}).finally(() => {
      pendingRef.current -= 1;
      if (pendingRef.current === 0) setBusy(false);
    });
    chapterQueueRef.current = run;
    return run;
  }, []);

  const addChapter = useCallback((paperId: string) => locked(async () => {
    const chapters = latestRef.current?.chapters ?? [];
    if (chapters.length >= BOOK_CHAPTERS_MAX) {
      toast.error(`한 책에는 장을 ${BOOK_CHAPTERS_MAX}개까지 담을 수 있어요.`);
      return;
    }
    const order = chapters.reduce((max, c) => Math.max(max, c.orderIndex + 1), 0);
    try {
      const chapter = await insertChapter(bookId, paperId, order);
      savedTitlesRef.current.set(chapter.id, chapter.titleOverride);
      commit((prev) => ({ ...prev, chapters: [...prev.chapters, chapter] }));
      toast.success(`'${chapter.paper?.title ?? '문제지'}' 를 ${chapters.length + 1}장으로 담았어요.`);
    } catch (e) {
      toast.error(isDuplicate(e) ? '이미 이 책에 담긴 문제지예요.' : message(e, '장을 담지 못했어요.'));
    }
  }), [bookId, commit, locked]);

  const removeChapter = useCallback((id: string) => locked(async () => {
    try {
      await deleteChapter(id);
      commit((prev) => ({ ...prev, chapters: prev.chapters.filter((c) => c.id !== id) }));
    } catch (e) {
      toast.error(message(e, '장을 빼지 못했어요.'));
    }
  }), [commit, locked]);

  const moveChapter = useCallback((id: string, delta: -1 | 1) => locked(async () => {
    const chapters = [...(latestRef.current?.chapters ?? [])];
    const from = chapters.findIndex((c) => c.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= chapters.length) return;
    [chapters[from], chapters[to]] = [chapters[to], chapters[from]];
    try {
      await reorderChapters(chapters);
      // 차례만 옮겨 **지금** 장 위에 얹는다 — 요청 중에 고친 장 제목을 잡아 둔 옛 장으로 덮지 않는다(코덱스 2R)
      const order = chapters.map((c) => c.id);
      commit((prev) => ({
        ...prev,
        chapters: [...prev.chapters]
          .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
          .map((c, i) => ({ ...c, orderIndex: i })),
      }));
    } catch (e) {
      toast.error(message(e, '차례를 바꾸지 못했어요.'));
    }
  }), [commit, locked]);

  /**
   * 장 제목 — 화면에 먼저 얹고(뒤따르는 옮기기가 새 제목을 쓰게) 줄에 세워 저장한다. 실패하면 **DB 에 들어간 마지막 제목**으로
   * 되돌린다 — 화면의 직전 제목은 앞선 낙관적 값일 수 있다(코덱스 3R). 그 장의 가장 나중 제목 저장만 되돌린다.
   */
  const renameChapter = useCallback((id: string, title: string) => {
    const next = title.trim().slice(0, CHAPTER_TITLE_MAX);
    const seq = (titleSeqRef.current.get(id) ?? 0) + 1;
    titleSeqRef.current.set(id, seq);
    const setTitle = (value: string) => commit((prev) => ({
      ...prev, chapters: prev.chapters.map((c) => (c.id === id ? { ...c, titleOverride: value } : c)),
    }));
    setTitle(next);
    return locked(async () => {
      try {
        await updateChapterTitle(id, next);
        savedTitlesRef.current.set(id, next);
      } catch (e) {
        toast.error(message(e, '장 제목을 저장하지 못했어요.'));
        if (titleSeqRef.current.get(id) === seq) setTitle(savedTitlesRef.current.get(id) ?? '');
      }
    });
  }, [commit, locked]);

  const current = loaded?.key === bookId ? loaded : null;
  return {
    book: current?.book ?? null,
    chapters: current?.chapters ?? [],
    creatorName: current?.creatorName ?? '',
    loaded: !enabled || current !== null,
    failed: current?.failed ?? false,
    busy,
    save,
    savePageCount,
    addChapter,
    removeChapter,
    moveChapter,
    renameChapter,
  };
}
