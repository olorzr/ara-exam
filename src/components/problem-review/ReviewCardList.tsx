'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import PassageEditorCard from '@/components/problem-review/PassageEditorCard';
import ProblemEditorCard from '@/components/problem-review/ProblemEditorCard';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';
import type { PassagePatch, ProblemPatch } from '@/lib/problem-bank/mutations';
import type { Passage, Problem } from '@/types/problem-bank';

/** 지문 다음에 그 지문의 문항이 오도록 늘어놓은 한 줄 */
export type ReviewRow = { kind: 'passage' | 'problem'; id: string };

interface ReviewCardListProps {
  rows: ReviewRow[];
  passages: Passage[];
  problems: Problem[];
  /** 이 카드를 다시 마운트해야 하는가를 나타내는 세대 — key 에 섞는다 */
  mountKey: (id: string) => string;
  areaTree: AreaTreeNode[];
  unitTree: AreaTreeNode[];
  selectedId: string | null;
  /** 항목 id → OCR 이 남긴 확인거리 */
  issues: Map<string, string[]>;
  onSelect: (id: string, page: number) => void;
  onDirtyChange: (id: string, dirty: boolean) => void;
  savePassage: (id: string, patch: PassagePatch) => Promise<boolean>;
  saveProblem: (id: string, patch: ProblemPatch) => Promise<string | null>;
  toggleVerified: (id: string, verified: boolean, knownUpdatedAt?: string) => void;
  deletePassage: (id: string) => void;
  deleteProblem: (id: string) => void;
}

/**
 * 검수 화면 오른쪽의 카드 목록.
 *
 * 페이지에서 떼어 둔 이유는 길이뿐이다 — 상태는 전부 페이지가 들고 있고
 * 여기서는 그리기만 한다.
 */
export default function ReviewCardList({
  rows, passages, problems, mountKey, areaTree, unitTree, selectedId, issues,
  onSelect, onDirtyChange, savePassage, saveProblem, toggleVerified, deletePassage, deleteProblem,
}: ReviewCardListProps) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 py-12 text-center text-sm text-gray-500">
          <p>읽어 낸 문항이 없어요.</p>
          {/* 실패·취소한 작업에서 실제로 돌아갈 곳을 준다 — 안내만 하고 길이 없으면 막힌다 */}
          <Link
            href="/problems/upload"
            className="inline-block rounded-md bg-primary px-3 py-2 text-sm text-white"
          >
            다시 업로드하기
          </Link>
        </CardContent>
      </Card>
    );
  }

  const problemCountFor = (passageId: string) =>
    problems.filter((p) => p.passage_id === passageId).length;

  return (
    <>
      {rows.map((row) => {
        if (row.kind === 'passage') {
          const passage = passages.find((p) => p.id === row.id);
          if (!passage) return null;
          return (
            <PassageEditorCard
              key={`${passage.id}:${mountKey(passage.id)}`}
              passage={passage}
              problemCount={problemCountFor(passage.id)}
              areaTree={areaTree}
              unitTree={unitTree}
              issues={issues.get(passage.id)}
              selected={selectedId === passage.id}
              // 이미 고른 항목을 다시 누르거나(편집 중 포커스) 하면 쪽은 그대로 둔다 —
              // 여러 쪽에 걸친 지문을 이어지는 쪽과 대조하며 고칠 수 있어야 한다
              onSelect={() => onSelect(passage.id, passage.page_no)}
              onSave={(patch) => savePassage(passage.id, patch)}
              onDirtyChange={(dirty) => onDirtyChange(passage.id, dirty)}
              onDelete={() => deletePassage(passage.id)}
            />
          );
        }

        const problem = problems.find((p) => p.id === row.id);
        if (!problem) return null;
        return (
          <ProblemEditorCard
            // 서버 본문을 다시 읽으면 카드도 다시 마운트한다 —
            // 옛 입력이 남은 채 새 토큰으로 저장되면 남의 수정을 덮어쓴다
            key={`${problem.id}:${mountKey(problem.id)}`}
            problem={problem}
            areaTree={areaTree}
            unitTree={unitTree}
            issues={issues.get(problem.id)}
            selected={selectedId === problem.id}
            onSelect={() => onSelect(problem.id, problem.page_no)}
            onSave={(patch) => saveProblem(problem.id, patch)}
            onDirtyChange={(dirty) => onDirtyChange(problem.id, dirty)}
            // 방금 저장해서 알고 있는 버전을 **그대로 넘긴다** — 버리면 저장 직후
            // 검수가 옛 버전으로 걸려 아무도 안 고쳤는데 충돌한다
            onToggleVerified={(v, knownUpdatedAt) => toggleVerified(problem.id, v, knownUpdatedAt)}
            onDelete={() => deleteProblem(problem.id)}
          />
        );
      })}
    </>
  );
}
