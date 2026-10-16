'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import { conceptDraftEquals, type ConceptDraftSnapshot } from '@/lib/concept-sheet-form';
import { useUnsavedGuard } from './useUnsavedGuard';

/**
 * 개념지 편집기의 **저장된 값 · 주소 옮기기** (2026-10-15 리뷰 4번).
 *
 * ⚠️ 새 개념지의 첫 저장은 `/new` → `/{id}` 로 주소를 바꾼다. 동적 구간 값이 바뀌면 App Router 가
 *    화면을 새로 마운트하고, 새 화면은 DB 값을 다시 읽어 그린다. 예전에는 INSERT 가 끝나면 **무조건**
 *    옮겨서, 저장을 기다리는 사이 이어 친 글·제목·마킹·카테고리·합격 기준이 **확인창 하나 없이**
 *    사라졌다. 작품 전문 편집기(`useReferenceTextEditor`)의 규약을 그대로 옮긴다:
 *    - 저장이 끝난 순간의 편집 값이 보낸 값과 **같을 때만** 옮긴다. 다르면 미뤄 두고(`pendingNavRef`)
 *      다음 저장이 깨끗하게 끝났을 때 옮긴다. 그동안에도 저장은 수정으로 나간다(`savedId` 를 쥐고 있다).
 *    - 같은 화면이 유지되며 주소만 바뀐 경우에는 다시 읽지 않는다(`loadedIdRef`, 처음 값은 null).
 *    - '저장 안 됨'·이탈 안내는 **DB 에 실제로 들어간 값**(보낸 스냅샷)을 기준으로 한다.
 */

/** 이탈 안내 문구 */
const UNSAVED_MESSAGE = '저장하지 않은 내용이 있어요. 이 화면을 떠날까요?';

export interface ConceptSheetDraftInput {
  /** 지금 화면의 편집 값(렌더 값) */
  current: ConceptDraftSnapshot;
  /** 새 개념지면 처음부터 '저장된 값' 이 있다(빈 값). 기존 개념지는 읽은 뒤에 정한다 */
  initialSaved: ConceptDraftSnapshot | null;
  editorRef: RefObject<Editor | null>;
  /** 주소를 옮긴다 (`router.replace`) */
  replace: (id: string) => void;
}

/**
 * 저장된 값과 지금 값을 견주고, 안전할 때만 주소를 옮긴다.
 * @param input - 지금 값·처음 저장된 값·편집기·주소 옮기기
 * @returns 고친 것이 있는가와 저장·읽기 뒤에 부를 함수들
 */
export function useConceptSheetDraft({ current, initialSaved, editorRef, replace }: ConceptSheetDraftInput) {
  const [saved, setSaved] = useState<ConceptDraftSnapshot | null>(initialSaved);
  /** 지금 값의 거울 — 저장이 끝난 **그 순간**의 값을 보려고 둔다(닫아 둔 값은 저장을 시작할 때 것이다) */
  const latestRef = useRef(current);
  /** 편집기가 처음 낸 HTML 을 '저장된 본문' 으로 받아들일 차례인가 */
  const baselinePendingRef = useRef(true);
  /** 아직 못 옮긴 주소 — 위 머리 주석 */
  const pendingNavRef = useRef<string | null>(null);
  /** 이미 읽은(또는 방금 만든) 개념지 id — ⚠️ 처음 값은 반드시 null(주소로 바로 들어온 화면이 안 읽힌다) */
  const loadedIdRef = useRef<string | null>(null);
  /** 화면이 붙어 있는가 — 저장하는 사이 떠난 사람을 편집기로 끌고 오지 않는다 */
  const aliveRef = useRef(true);

  // 거울은 렌더가 아니라 효과에서 맞춘다(`react-hooks/refs` 가 렌더 중 쓰기를 막는다)
  useEffect(() => { latestRef.current = current; }, [current]);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  /** 지금 편집 값 — 본문은 편집기에서 바로 읽는다(마지막 렌더보다 새것일 수 있다) */
  const snapshotNow = useCallback((): ConceptDraftSnapshot => {
    const latest = latestRef.current;
    const editor = editorRef.current;
    return editor ? { ...latest, html: editor.getHTML() } : latest;
  }, [editorRef]);

  /** 편집기가 처음 그려 낸 HTML 을 저장된 본문의 기준으로 삼는다(`ExamEditor.onReady`) */
  const handleEditorReady = useCallback((html: string) => {
    if (!baselinePendingRef.current) return;
    baselinePendingRef.current = false;
    setSaved((prev) => (prev ? { ...prev, html } : prev));
  }, []);

  /** 기존 개념지를 읽었다 — 그 값이 '저장된 값' 이고, 편집기가 다시 그려 낸 본문을 기준으로 받는다 */
  const markLoaded = useCallback((id: string, snapshot: ConceptDraftSnapshot) => {
    loadedIdRef.current = id;
    baselinePendingRef.current = true;
    setSaved(snapshot);
  }, []);

  /**
   * 저장이 끝났고 **손댄 것이 없을 때만** 주소를 옮긴다.
   * @param sent - 저장을 시작할 때의 편집 값
   * @param id - 옮겨 갈 개념지 id
   */
  const navigateWhenSafe = useCallback((sent: ConceptDraftSnapshot, id: string) => {
    if (!aliveRef.current) return;
    if (!conceptDraftEquals(snapshotNow(), sent)) {
      pendingNavRef.current = id;
      return;
    }
    pendingNavRef.current = null;
    loadedIdRef.current = id;
    replace(id);
  }, [replace, snapshotNow]);

  /**
   * 저장이 끝났다 — '저장된 값' 은 **보낸 값**이다(그 사이 고친 것은 '저장 안 됨' 으로 남는다).
   * @param sent - 보낸 편집 값
   * @param id - 저장된 개념지 id (새로 만들었으면 그 id)
   * @param created - 이번에 새로 만들었는가 — 그러면 주소 옮기기를 시도한다
   */
  const markSaved = useCallback((sent: ConceptDraftSnapshot, id: string, created: boolean) => {
    setSaved(sent);
    const pending = created ? id : pendingNavRef.current;
    if (pending) navigateWhenSafe(sent, pending);
  }, [navigateWhenSafe]);

  const dirty = saved !== null && !conceptDraftEquals(current, saved);
  useUnsavedGuard(dirty, UNSAVED_MESSAGE);

  return { dirty, loadedIdRef, handleEditorReady, markLoaded, markSaved };
}
