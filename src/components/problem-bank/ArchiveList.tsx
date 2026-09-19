'use client';

import { Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import PassageGroupCard from '@/components/problem-bank/PassageGroupCard';
import ProblemCard from '@/components/problem-bank/ProblemCard';
import { splitByWorkSpan } from '@/lib/problem-bank/passage-groups';
import type { ArchiveRow } from '@/hooks/useProblemArchive';
import { usePassageGroups } from '@/hooks/usePassageGroups';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';

interface ArchiveListProps {
  rows: ArchiveRow[];
  loading: boolean;
  /** Storage 경로 → 서명 URL */
  thumbnails: Map<string, string>;
  selectMode: boolean;
  isSelected: (id: string) => boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void;
  /** 작품으로 훑는 중인가 — 그때만 지문별로 묶어 그린다 */
  groupByPassage?: boolean;
  /** 지금 훑고 있는 작품명 — 여러 작품에 걸친 문항을 갈라 보여 줄 기준이다 */
  workTitle?: string;
}

/**
 * 아카이브 목록 — 조건에 걸린 문항을 늘어놓는다.
 *
 * 작품으로 훑을 때만 **지문별로 묶는다.** 같은 작품이라도 학교마다 실린 대목이 달라서,
 * 문항만 늘어놓으면 어느 대목의 문항인지 알 수 없기 때문이다. 다른 조건에서는 지문이
 * 뒤섞여 있어 묶어도 의미가 없다.
 *
 * 묶음 안에서는 **다른 작품과 함께 묻는 문항을 따로 세운다**(sql/33). `(가)와 (나)의
 * 공통점은?` 같은 문항은 진달래꽃만 가르치는 자리에 쓸 수 없는데, 섞여 있으면 그걸 모르고
 * 골라 담게 된다.
 */
export default function ArchiveList({
  rows, loading, thumbnails, selectMode, isSelected, onToggleSelect, onOpen, groupByPassage,
  workTitle,
}: ArchiveListProps) {
  const grouped = usePassageGroups(rows, Boolean(groupByPassage) && !loading);
  // 이미지 지문의 본문과, 본문 제자리에 끼운 그림들은 서명 URL 이 있어야 보인다
  const passageImages = useSignedImageUrls(
    grouped.groups.flatMap((g) => [
      g.passage?.render_mode === 'image' ? g.passage.image_path : '',
      ...(g.passage?.figure_paths ?? []),
    ]).filter(Boolean),
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-gray-500">
          조건에 맞는 문항이 없어요.
        </CardContent>
      </Card>
    );
  }

  const card = (row: ArchiveRow) => (
    <ProblemCard
      key={row.id}
      problem={row}
      thumbnailUrl={thumbnails.get(row.image_path) ?? null}
      selectMode={selectMode}
      selected={isSelected(row.id)}
      onToggleSelect={() => onToggleSelect(row.id)}
      onOpen={() => onOpen(row.id)}
    />
  );

  if (groupByPassage) {
    return (
      <div className="space-y-4">
        {grouped.groups.map((group) => (
          <PassageGroupCard
            key={group.passageId ?? '__none__'}
            passageId={group.passageId}
            passage={group.passage}
            source={group.rows[0]?.source ?? null}
            problemCount={group.rows.length}
            highlightWork={workTitle}
            imageUrl={
              group.passage?.image_path
                ? passageImages.urls.get(group.passage.image_path)
                : null
            }
            figureUrls={passageImages.urls}
          >
            <WorkSpanSections rows={group.rows} workTitle={workTitle ?? ''} card={card} />
          </PassageGroupCard>
        ))}
      </div>
    );
  }

  return <div className="space-y-2">{rows.map(card)}</div>;
}

/**
 * 한 지문 묶음 안을 **이 작품만 묻는 문항**과 **다른 작품과 함께 묻는 문항**으로 가른다.
 *
 * 함께 묻는 문항을 지우지 않고 아래에 세우는 이유: 진달래꽃 수업에 그대로 쓸 수는 없어도
 * 두 작품을 다 가르친 뒤에는 가장 좋은 문항이다. 숨기면 있는 줄도 모른다.
 */
function WorkSpanSections({ rows, workTitle, card }: {
  rows: ArchiveRow[];
  workTitle: string;
  card: (row: ArchiveRow) => React.ReactNode;
}) {
  const { only, shared } = splitByWorkSpan(rows, workTitle);
  if (shared.length === 0) return <div className="space-y-2">{rows.map(card)}</div>;

  return (
    <div className="space-y-3">
      {only.length > 0 && <div className="space-y-2">{only.map(card)}</div>}
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
          <Layers className="h-3.5 w-3.5 shrink-0" />
          다른 작품과 함께 묻는 문항 {shared.length}
        </p>
        {shared.map(card)}
      </div>
    </div>
  );
}
