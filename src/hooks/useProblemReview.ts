'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  fetchPassages, fetchProblemsOfSource, fetchSource,
} from '@/lib/problem-bank/queries';
import {
  ConflictError, countTaggedUnits, deletePassage, deleteProblem,
  setProblemVerified, setSourceTextbook, updatePassage, updateProblem,
  type PassagePatch, type ProblemPatch,
} from '@/lib/problem-bank/mutations';
import { signProblemFiles } from '@/lib/problem-bank/storage';
import { sourcePagePath } from '@/lib/problem-bank/storage-paths';
import type { Passage, Problem, ProblemSource } from '@/types/problem-bank';

/**
 * 검수 화면의 상태.
 *
 * 저장은 **낙관적 동시성**이다(개념지와 같은 규약) — 화면이 읽어 온 `updated_at` 을
 * 조건으로 걸고, 0행이면 충돌로 알린다. 공유 표라 두 사람이 같은 문항을 열 수 있다.
 */
export function useProblemReview(sourceId: string) {
  const [source, setSource] = useState<ProblemSource | null>(null);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [pageUrls, setPageUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * 서버에서 본문을 통째로 다시 읽어 온 횟수.
   *
   * ⚠️ 편집 카드는 폼 값을 **지역 state** 로 들고 있다. 서버 본문을 새로 받아 놓고
   *    카드를 그대로 두면, 화면에는 옛 입력이 남은 채 새 버전 토큰만 붙는다 —
   *    그 상태로 저장하면 **남의 수정을 조용히 덮어쓴다**(코덱스 리뷰 4R).
   *    호출부가 이 값을 카드 key 에 섞어 다시 마운트하게 한다.
   */
  const [reloadSeq, setReloadSeq] = useState(0);
  /**
   * 문항별 다시 마운트 세대.
   *
   * 지문 작품명을 바꾸면 **그 지문에 딸린 문항만** 서버에서 값이 바뀐다. 그런데
   * `reloadSeq` 는 화면의 카드를 통째로 다시 마운트하므로, 상관없는 문항에서 고치던
   * 내용까지 함께 사라진다. 바뀐 문항만 골라 세대를 올려 **피해를 그 문항들로 좁힌다**.
   */
  const [itemSeq, setItemSeq] = useState<Map<string, number>>(new Map());
  /**
   * 화면 전체를 잠가야 하는 일이 도는 중인가(교과서 변경).
   * 끝나면 카드를 다시 마운트하므로, 그 사이 새로 친 내용은 어차피 사라진다 —
   * 아예 못 치게 걷어 내는 편이 정직하다.
   */
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [src, ps, qs] = await Promise.all([
        fetchSource(sourceId),
        fetchPassages(sourceId),
        fetchProblemsOfSource(sourceId),
      ]);
      setSource(src);
      setPassages(ps);
      setProblems(qs);

      // 원본 대조용 페이지 이미지 — 쓰인 쪽만 한 번에 서명한다
      const pages = [...new Set([...ps.map((p) => p.page_no), ...qs.map((q) => q.page_no)])]
        .filter((n) => n >= 1);
      // 원본 대조용 페이지 이미지 — OCR 이 읽은 쪽(정답표·이어지는 쪽 포함)을 모두 서명한다.
      // 항목이 있는 쪽만 서명하면 정답표 쪽이 빠져 정답을 대조할 수 없다
      const ocrPages = (src?.ocr_meta?.pages ?? []).filter((n) => Number.isInteger(n) && n >= 1);
      const allPages = [...new Set([...pages, ...ocrPages])].sort((a, b) => a - b);
      setPageUrls(await signProblemFiles(allPages.map((n) => sourcePagePath(sourceId, n))));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    load();
  }, [load]);

  /** 저장 실패를 한 곳에서 사람 말로 바꾼다 */
  const reportError = (e: unknown) => {
    if (e instanceof ConflictError) toast.error(e.message);
    else toast.error(e instanceof Error ? e.message : '저장하지 못했어요.');
  };

  /**
   * 문항을 저장한다.
   * @returns 새 `updated_at`. 실패하면 null
   *
   * 불리언이 아니라 새 버전을 돌려주는 이유: 저장 직후 검수 완료까지 이어서 누르면
   * 화면 state 가 아직 안 돌아 **옛 버전으로 검수를 시도해 충돌**한다(코덱스 리뷰 9R).
   * 호출부가 받은 값을 그대로 넘길 수 있어야 한다.
   */
  const saveProblem = useCallback(async (
    id: string,
    patch: ProblemPatch,
  ): Promise<string | null> => {
    const target = problems.find((p) => p.id === id);
    if (!target) return null;
    try {
      const updatedAt = await updateProblem(id, target.updated_at, patch);
      setProblems((list) => list.map((p) => (
        p.id === id ? { ...p, ...patch, updated_at: updatedAt } as Problem : p
      )));
      return updatedAt;
    } catch (e) {
      reportError(e);
      return null;
    }
  }, [problems]);

  /**
   * 지문을 저장한다.
   *
   * ⚠️ **작품명을 바꾸면 딸린 문항까지 움직인다.** DB 트리거(`passages_sync_work_title`)가
   *    같은 트랜잭션에서 그 문항들의 `work_title` 을 따라 바꾸고, 그 UPDATE 가
   *    `updated_at` 트리거를 건드린다. 화면이 옛 버전을 들고 있으면 이후 그 문항의
   *    저장·검수가 **아무도 안 고쳤는데 충돌로 튕긴다** — 지문 삭제(removePassage)와
   *    똑같은 이유다. 그래서 문항을 다시 읽고 카드도 다시 마운트한다.
   *
   * ⚠️ 다시 마운트하는 것은 **그 지문에 딸린 문항뿐**이다(`itemSeq`). 화면 전체를
   *    다시 마운트하면 상관없는 문항에서 고치던 내용까지 사라지고, `busy` 로 카드를
   *    걷어 내면 **조회가 실패했을 때도** 입력이 날아간다(코덱스 리뷰 2R).
   *    조회가 실패하면 아무것도 건드리지 않고 오류만 알린다.
   * @param id - 지문 id
   * @param patch - 바꿀 값
   * @returns 저장에 성공했는가
   */
  const savePassage = useCallback(async (id: string, patch: PassagePatch): Promise<boolean> => {
    const target = passages.find((p) => p.id === id);
    if (!target) return false;
    const titleChanged = patch.title !== undefined && patch.title !== target.title;
    try {
      const updatedAt = await updatePassage(id, target.updated_at, patch);
      setPassages((list) => list.map((p) => (
        p.id === id ? { ...p, ...patch, updated_at: updatedAt } as Passage : p
      )));

      if (titleChanged) {
        // 트리거는 이 UPDATE 와 한 트랜잭션이라, 응답을 받은 시점에는 이미 반영돼 있다.
        // ⚠️ 실패하면 여기서 그대로 던진다 — 반쯤 갱신된 화면을 만들지 않는다
        const fresh = await fetchProblemsOfSource(sourceId);
        const affected = fresh.filter((p) => p.passage_id === id).map((p) => p.id);
        setProblems(fresh);
        setItemSeq((prev) => {
          const next = new Map(prev);
          for (const problemId of affected) next.set(problemId, (next.get(problemId) ?? 0) + 1);
          return next;
        });
      }
      return true;
    } catch (e) {
      reportError(e);
      return false;
    }
  }, [passages, sourceId]);

  /**
   * 검수 완료 표시를 켜고 끈다.
   * @param knownUpdatedAt - 방금 저장해서 이미 알고 있는 버전(있으면 이걸 쓴다).
   *   화면 state 가 아직 안 돈 시점에도 맞는 버전으로 걸 수 있다
   */
  const toggleVerified = useCallback(async (
    id: string,
    verified: boolean,
    knownUpdatedAt?: string,
  ) => {
    const target = problems.find((p) => p.id === id);
    if (!target) return;
    try {
      // 읽어 온 버전을 걸고, 새 버전을 받아 화면도 갱신한다.
      // 조건이 없으면 남이 고친 문항의 새 버전을 물려받은 채 옛 본문을 들고 있게 되고,
      // 다음 저장이 검사를 통과하며 남의 수정을 덮어쓴다
      const updatedAt = await setProblemVerified(
        id, knownUpdatedAt ?? target.updated_at, verified,
      );
      setProblems((list) => list.map((p) => (
        p.id === id
          ? { ...p, status: verified ? '검수완료' : '초안', updated_at: updatedAt }
          : p
      )));
    } catch (e) {
      reportError(e);
    }
  }, [problems]);

  const removeProblem = useCallback(async (id: string) => {
    try {
      await deleteProblem(id);
      setProblems((list) => list.filter((p) => p.id !== id));
      toast.success('문항을 지웠어요.');
    } catch (e) {
      reportError(e);
    }
  }, []);

  const removePassage = useCallback(async (id: string) => {
    try {
      await deletePassage(id);
      setPassages((list) => list.filter((p) => p.id !== id));

      // 딸린 문항은 남지만(FK ON DELETE SET NULL) 그 UPDATE 가 updated_at 트리거를
      // 건드린다. 화면에서 passage_id 만 지우면 문항들이 **옛 버전 토큰**을 들고 있어
      // 이후 저장·검수가 아무도 안 고쳤는데 충돌로 튕긴다(코덱스 리뷰 3R).
      // 영향받은 문항을 다시 읽어 본문과 토큰을 같이 맞춘다.
      const affected = problems.some((p) => p.passage_id === id);
      if (affected) {
        setProblems(await fetchProblemsOfSource(sourceId));
        // 편집 카드도 다시 마운트시킨다 — 새 본문 위에 옛 입력이 남으면
        // 그대로 저장할 때 남의 수정을 덮어쓴다
        setReloadSeq((n) => n + 1);
      }

      toast.success('지문을 지웠어요. 문항은 남아 있어요.');
    } catch (e) {
      reportError(e);
    }
  }, [problems, sourceId]);

  /**
   * 교과서를 바꾼다 — 단원 트리가 여기에 달려 있어 검수 중에도 고칠 수 있어야 한다.
   *
   * ⚠️ 이미 붙은 단원은 **다른 책의 단원**이 되므로 함께 지운다. 지우는 판단은 **DB 가**
   *    한다(RPC 가 한 트랜잭션에서 현재 태그를 지운다) — 앞서 센 개수로 결정하면 그 사이
   *    다른 탭이 붙인 태그가 새 교과서 아래 남는다(코덱스 리뷰 4R). 센 개수는 안내용이다.
   * ⚠️ 바꾼 뒤에는 본문을 다시 읽고 카드도 **반드시 다시 마운트한다.** 카드가 단원·발문을
   *    지역 state 로 들고 있어서, 그대로 두면 옛 값이 새 교과서 아래 다시 저장된다.
   *    그래서 저장하지 않은 수정이 있으면 먼저 알리고(취소하면 아무것도 건드리지 않는다),
   *    확인한 뒤에는 `busy` 로 카드를 걷어 내 그 사이 새로 친 내용이 말없이 사라지지 않게 한다.
   * @param textbook - 교과서 이름 ('' 는 미지정)
   * @param countDirty - 저장하지 않은 카드 수를 **묻는 순간** 세어 주는 함수
   */
  const changeTextbook = useCallback(async (
    textbook: string,
    countDirty: () => number = () => 0,
  ) => {
    try {
      const tagged = await countTaggedUnits(sourceId);
      const dirty = countDirty();
      const warnings = [
        tagged > 0
          ? `단원이 붙은 문항·지문 ${tagged}개의 단원이 지워집니다(다른 책의 단원이 됩니다).`
          : '',
        dirty > 0 ? `저장하지 않은 수정 ${dirty}개가 사라집니다.` : '',
      ].filter(Boolean);

      if (warnings.length > 0) {
        const ok = window.confirm(`교과서를 바꾸면\n· ${warnings.join('\n· ')}\n\n계속할까요?`);
        // 취소하면 아무것도 건드리지 않는다 — 카드도 그대로 둔다
        if (!ok) return;
      }

      setBusy(true);
      const saved = await setSourceTextbook(sourceId, textbook, true);
      setSource((prev) => (prev ? { ...prev, textbook: saved } : prev));
      // 카드가 들고 있던 옛 단원·입력을 버린다 — 태그 개수와 무관하게 늘 다시 읽고 마운트한다
      await load();
      setReloadSeq((n) => n + 1);
      toast.success(saved ? `교과서를 '${saved}' 로 바꿨어요.` : '교과서를 지웠어요.');
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }, [sourceId, load]);

  const verifiedCount = useMemo(
    () => problems.filter((p) => p.status === '검수완료').length,
    [problems],
  );

  const pageUrlFor = useCallback(
    (page: number) => pageUrls.get(sourcePagePath(sourceId, page)) ?? null,
    [pageUrls, sourceId],
  );

  /**
   * 이 카드를 몇 번째로 마운트하는가 — 호출부가 `key` 에 섞는다.
   * 전체 세대(`reloadSeq`)와 문항별 세대를 합친다.
   * @param id - 문항·지문 id
   * @returns 세대 문자열
   */
  const mountKey = useCallback(
    (id: string) => `${reloadSeq}:${itemSeq.get(id) ?? 0}`,
    [reloadSeq, itemSeq],
  );

  return {
    source, passages, problems, loading, busy, error, verifiedCount, reloadSeq, mountKey,
    reload: load, saveProblem, savePassage, toggleVerified, changeTextbook,
    removeProblem, removePassage, pageUrlFor,
  };
}
