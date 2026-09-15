'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  EMPTY_REFERENCE_DRAFT, draftFromReferenceText, referenceDraftBlocker, referenceDraftEquals,
  toReferenceTextPayload, type ReferenceTextDraft,
} from '@/lib/reference-texts/form';
import { fetchReferenceText } from '@/lib/reference-texts/queries';
import { insertReferenceText, updateReferenceText } from '@/lib/reference-texts/save';
import { useUnsavedGuard } from './useUnsavedGuard';

export interface ReferenceTextEditorOptions {
  /** 편집할 전문 id. 'new' 면 새로 만든다 */
  id: string;
  /** 목록 경로 — 뒤로 가기와 '찾을 수 없음' 이 여기로 돌아가고, 새로 만든 뒤 주소도 이 아래다 */
  listHref: string;
}

/**
 * 작품 전문 편집 화면의 상태.
 *
 * 개념지 편집기(`useConceptSheetEditor`)와 같은 규약을 따른다 — 경로를 훅이 읽지 않고
 * **호출부가 넘기고**, 저장은 `updated_at` 으로 낙관적 동시성을 건다(도메인 전원이 함께 쓰는
 * 표라 안 걸면 마지막 저장이 상대 변경을 통째로 덮는다).
 *
 * 개념지와 다른 점: 본문이 **평문**이라 정화할 마크업이 없고 TipTap 도 쓰지 않는다.
 */
export function useReferenceTextEditor(opts: ReferenceTextEditorOptions) {
  const { id, listHref } = opts;
  const router = useRouter();
  const isNew = id === 'new';

  const [draft, setDraft] = useState<ReferenceTextDraft>(EMPTY_REFERENCE_DRAFT);
  /** 마지막으로 저장된 값 — 고친 것이 있는지 **렌더에서 파생**한다 */
  const [savedDraft, setSavedDraft] = useState<ReferenceTextDraft>(EMPTY_REFERENCE_DRAFT);
  const [savedId, setSavedId] = useState<string | null>(isNew ? null : id);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const aliveRef = useRef(true);
  /**
   * 이미 불러온(또는 방금 만든) 전문 id.
   *
   * ⚠️ 새로 만들면 주소가 `/new` → `/{id}` 로 바뀌어 **이 효과가 다시 돈다.** 그대로 두면
   *    방금 저장한 값을 다시 읽어 와 덮는데, 그 왕복 동안 이어서 친 글이 말없이 사라진다.
   * ⚠️ 처음 값은 **반드시 `null` 이다.** 편집할 id 로 채워 두면 주소로 바로 들어온 화면이
   *    "이미 읽었다" 고 판정해 아무것도 안 읽고 스피너만 돈다.
   */
  const loadedIdRef = useRef<string | null>(null);
  /**
   * 지금 화면 값의 거울 — 저장이 끝난 **그 순간**의 값을 보려고 둔다.
   * 닫아 둔 `draft` 는 저장을 시작할 때의 값이라 그 사이 친 글을 못 본다.
   */
  const draftRef = useRef<ReferenceTextDraft>(EMPTY_REFERENCE_DRAFT);
  /**
   * 아직 못 옮긴 주소.
   *
   * ⚠️ 새로 만들면 주소가 `/new` → `/{id}` 로 바뀌는데, **동적 구간 값이 바뀌면 App Router 가
   *    화면을 새로 마운트한다**(코덱스 리뷰 5R). 새 화면은 DB 값을 다시 읽어 그리므로,
   *    저장하는 사이 이어 친 글이 **확인창 하나 없이 사라진다.** 그래서 저장 중에 손댄 것이
   *    있으면 **주소를 옮기지 않고** 여기 적어 두었다가, 다음 저장이 깨끗하게 끝났을 때 옮긴다.
   *    옮기기 전까지도 편집·저장은 그대로 된다(`savedId` 가 있어 수정으로 나간다).
   */
  const pendingNavRef = useRef<string | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    // 방금 만들어 주소만 바뀐 경우다 — 다시 읽으면 그 사이 친 글을 덮는다
    if (isNew || loadedIdRef.current === id) {
      return () => { aliveRef.current = false; };
    }
    // setState 는 `.then` 안에서만 한다(효과 본문의 동기 setState 는 lint 가 막는다)
    fetchReferenceText(id)
      .then((row) => {
        if (!aliveRef.current) return;
        if (!row) {
          toast.error('전문을 찾을 수 없어요.');
          router.push(listHref);
          return;
        }
        const next = draftFromReferenceText(row);
        loadedIdRef.current = row.id;
        setDraft(next);
        setSavedDraft(next);
        setLoadedUpdatedAt(row.updated_at);
        setLoading(false);
      })
      .catch(() => {
        if (!aliveRef.current) return;
        toast.error('전문을 불러오지 못했어요.');
        router.push(listHref);
      });
    return () => { aliveRef.current = false; };
  }, [id, isNew, listHref, router]);

  // 거울은 렌더가 아니라 효과에서 맞춘다(`react-hooks/refs` 가 렌더 중 쓰기를 막는다)
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const patch = useCallback((next: Partial<ReferenceTextDraft>) => {
    setDraft((prev) => ({ ...prev, ...next }));
  }, []);

  /**
   * 저장이 끝난 뒤 화면과 '저장된 값' 을 맞춘다.
   *
   * ⚠️ **저장하는 동안에도 입력칸은 살아 있다**(코덱스 리뷰). 보낸 값으로 화면을 통째로
   *    덮으면 그 몇 초 사이에 이어 친 글이 **말없이 사라진다.** 그래서 칸마다 가린다 —
   *    보낸 뒤로 손대지 않은 칸만 정규화된 값(공백 정리 등)으로 맞추고, 그 사이 고친 칸은
   *    사람이 친 그대로 둔다. '저장된 값' 은 **DB 에 실제로 들어간 것**이라 언제나 payload 이고,
   *    그래서 저장 중에 고친 칸이 있으면 '저장하지 않은 내용' 으로 제대로 남는다.
   * @param sent - 보낼 때의 화면 값
   * @param saved - DB 에 실제로 들어간 값
   */
  const settle = useCallback((sent: ReferenceTextDraft, saved: ReferenceTextDraft) => {
    setSavedDraft(saved);
    setDraft((prev) => ({
      title: prev.title === sent.title ? saved.title : prev.title,
      author: prev.author === sent.author ? saved.author : prev.author,
      body: prev.body === sent.body ? saved.body : prev.body,
    }));
  }, []);

  /**
   * 저장이 끝났고 **손댄 것이 없을 때만** 주소를 옮긴다.
   *
   * 옮기는 순간 화면이 새로 마운트돼 DB 값으로 다시 그려지므로, 그 사이 친 글이 있으면
   * 그대로 사라진다 — 그때는 미뤄 두고 다음 기회에 옮긴다.
   * @param sent - 저장을 시작할 때의 화면 값
   * @param id - 옮겨 갈 전문 id
   */
  const navigateWhenSafe = useCallback((sent: ReferenceTextDraft, id: string) => {
    if (!referenceDraftEquals(draftRef.current, sent)) {
      pendingNavRef.current = id;
      return;
    }
    pendingNavRef.current = null;
    loadedIdRef.current = id;
    router.replace(`${listHref}/${id}`);
  }, [router, listHref]);

  const blocker = referenceDraftBlocker(draft);
  const dirty = !referenceDraftEquals(draft, savedDraft);

  // 저장하지 않고 떠나면 붙여 넣은 전문이 통째로 사라진다
  useUnsavedGuard(dirty, '저장하지 않은 내용이 있어요. 이 화면을 떠날까요?');

  const save = useCallback(async () => {
    if (referenceDraftBlocker(draft)) return;
    /** 보낼 때의 화면 값 — 저장이 도는 동안 사람이 이어 쳤는지 이것으로 가린다 */
    const sent = draft;
    const payload = toReferenceTextPayload(sent);
    setSaving(true);
    try {
      if (savedId) {
        const result = await updateReferenceText(savedId, payload, loadedUpdatedAt);
        if (!aliveRef.current) return;
        if (!result) {
          toast.error('다른 사용자가 이 전문을 먼저 수정했어요. 새로고침 후 다시 저장해 주세요.');
          return;
        }
        setLoadedUpdatedAt(result.updated_at);
        settle(sent, payload);
        toast.success('저장했어요.');
        // 지난번에 미뤄 둔 주소 옮기기가 있으면 깨끗해진 지금 시도한다
        if (pendingNavRef.current) navigateWhenSafe(sent, pendingNavRef.current);
        return;
      }
      const created = await insertReferenceText(payload);
      if (!aliveRef.current) return;
      setSavedId(created.id);
      setLoadedUpdatedAt(created.updated_at);
      settle(sent, payload);
      toast.success('저장했어요.');
      // ⚠️ 주소는 **손댄 것이 없을 때만** 옮긴다(위 pendingNavRef 주석 참고)
      navigateWhenSafe(sent, created.id);
    } catch (e) {
      if (aliveRef.current) toast.error(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  }, [draft, savedId, loadedUpdatedAt, settle, navigateWhenSafe]);

  return { isNew, draft, patch, blocker, dirty, loading, saving, save, listHref };
}

/** 편집기 훅이 돌려주는 것 전부 — 폼 컴포넌트가 그대로 받는다 */
export type ReferenceTextEditorState = ReturnType<typeof useReferenceTextEditor>;
