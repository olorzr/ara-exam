'use client';

import { Card, CardContent } from '@/components/ui/card';
import PassageGroupCard from '@/components/problem-bank/PassageGroupCard';
import ProblemCard from '@/components/problem-bank/ProblemCard';
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
}

/**
 * 아카이브 목록 — 조건에 걸린 문항을 늘어놓는다.
 *
 * 작품으로 훑을 때만 **지문별로 묶는다.** 같은 작품이라도 학교마다 실린 대목이 달라서,
 * 문항만 늘어놓으면 어느 대목의 문항인지 알 수 없기 때문이다. 다른 조건에서는 지문이
 * 뒤섞여 있어 묶어도 의미가 없다.
 */
export default function ArchiveList({
  rows, loading, thumbnails, selectMode, isSelected, onToggleSelect, onOpen, groupByPassage,
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
            imageUrl={
              group.passage?.image_path
                ? passageImages.urls.get(group.passage.image_path)
                : null
            }
            figureUrls={passageImages.urls}
          >
            {group.rows.map(card)}
          </PassageGroupCard>
        ))}
      </div>
    );
  }

  return <div className="space-y-2">{rows.map(card)}</div>;
}
