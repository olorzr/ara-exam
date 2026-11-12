'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PaperComposeBody from '@/components/problem-paper/PaperComposeBody';
import PaperEditBanner from '@/components/problem-paper/PaperEditBanner';
import { usePaperComposer, type PaperComposerSeed } from '@/hooks/usePaperComposer';
import { usePaperEditSave } from '@/hooks/usePaperEditSave';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { isPaperEditDirty, toCanvasItems } from '@/lib/problem-paper/edit-items';
import type { PaperEditData, PaperEditState } from '@/lib/problem-paper/paper-edit';
import { PageTitle } from '@/components/magazine';

interface PaperEditWorkspaceProps {
  data: PaperEditData;
  state: PaperEditState;
  withWorkbook: boolean;
  /** 저장한 뒤 갈 곳 */
  doneHref: string;
  /** 저장된 것을 다시 읽는다(충돌 뒤) */
  onReload: () => void;
}

/** 저장된 문제지 → 조합 상태의 처음 값 */
function seedOf(data: PaperEditData): PaperComposerSeed {
  return {
    items: toCanvasItems(data.items),
    title: data.paper.title,
    settings: data.paper.settings,
    stored: new Map(data.items.map((item) => [item.id, item])),
  };
}

/** 떠나기 전에 묻는 말 */
const LEAVE_MESSAGE = '고친 내용이 저장되지 않았어요. 이 화면을 떠날까요?';

/**
 * 문제지 고치기의 작업 칸 — 읽은 문제지 하나로 조합 상태를 연다.
 *
 * ⚠️ 조합 상태는 처음 렌더에서만 씨앗을 읽는다 — 다시 읽으면(충돌 뒤) 부르는 쪽이 `key` 를 바꿔 이 칸을 새로 연다.
 * @param props - 읽은 문제지 · 고치기 상태 · 저장 뒤 갈 곳
 * @returns 작업 칸
 */
export default function PaperEditWorkspace({ data, state, withWorkbook, doneHref, onReload }: PaperEditWorkspaceProps) {
  const router = useRouter();
  const seed = useMemo(() => seedOf(data), [data]);
  const paper = usePaperComposer(seed);
  const omr = data.paper.settings.omr;
  const save = usePaperEditSave({ paperId: data.paper.id, expectUpdatedAt: data.paper.updated_at, omr, paper });
  const dirty = isPaperEditDirty(seed, paper);
  // ⚠️ 저장하는 동안에도 켜 둔다(코덱스 7R) — 화면은 inert 로 잠기지만 사이드바·새로 고침은 열려 있어, 그때 떠나면 저장이
  //    끊기거나 실패한 저장의 고친 것이 말없이 사라진다. 저장에 성공하면 router.push 로 떠난다(이 보호는 링크 누름·창 닫기만 막는다)
  useUnsavedGuard(dirty, LEAVE_MESSAGE);

  const handleSave = async () => {
    if (await save.save()) router.push(doneHref);
  };

  const header = (
    <div className="space-y-2 border-b border-ink pb-3">
      <PageTitle eyebrow={withWorkbook ? 'BOOKS' : 'PROBLEM BANK'} size="sm">문제지 고치기</PageTitle>
      <p className="text-sm text-gray-500">
        <strong className="text-gray-800">{data.paper.title}</strong> — 순서를 바꾸거나, ✕ 로 빼거나, 왼쪽에서 문항을 더 담은 뒤
        &lsquo;수정 저장&rsquo; 을 누르세요. 원래 있던 문항은 만들 때 담은 내용 그대로 남고, 새로 담은 문항만 지금 문제 은행의
        내용으로 들어가요. 뺐던 문항을 다시 담으면 원래 것이 돌아오고, 지문 묶음을 지금 문제 은행 것으로 바꾸려면 묶음 머리의
        &lsquo;최신 지문으로&rsquo; 를 누르세요.
      </p>
      {omr && <PaperEditBanner kind="omr" />}
      {state.inBook && <PaperEditBanner kind="in-book" />}
      {save.conflict && <PaperEditBanner kind="conflict" onReload={onReload} />}
      {save.blocked && <PaperEditBanner kind="blocked" reason={save.blocked} />}
    </div>
  );

  return (
    <PaperComposeBody
      withWorkbook={withWorkbook}
      paper={paper}
      header={header}
      saving={save.saving}
      onSave={handleSave}
      edit={{ dirty, onReset: paper.reset }}
      hidePaperId={data.paper.id}
    />
  );
}
