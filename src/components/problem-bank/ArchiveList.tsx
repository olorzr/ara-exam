'use client';

import { Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import PassageGroupCard from '@/components/problem-bank/PassageGroupCard';
import { splitByWorkSpan } from '@/lib/problem-bank/passage-groups';
import type { ArchiveRow } from '@/hooks/useProblemArchive';
import { usePassageGroups } from '@/hooks/usePassageGroups';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';

/** 지문 묶음 하나 — 머리에 붙일 조작을 만들 때 쓴다 */
export interface ArchiveGroup {
  passageId: string;
  rows: ArchiveRow[];
}

interface ArchiveListProps {
  rows: ArchiveRow[];
  loading: boolean;
  /**
   * 카드 한 장을 그린다.
   *
   * 담기·선택·끌기는 화면마다 달라서(아카이브는 선택·삭제, 조합은 ＋·끌기) 카드는
   * **부르는 쪽이** 만든다. 목록이 카드 props 를 전부 받아 나르면 두 화면의 규약이
   * 이 파일에 섞인다.
   */
  renderCard: (row: ArchiveRow) => React.ReactNode;
  /**
   * 작품으로 훑는 중이면 그 작품명.
   *
   * 그때만 지문 **본문까지** 읽어 오고, 묶음 안에서 **다른 작품과 함께 묻는 문항**을 따로
   * 세운다. 묶는 것 자체는 어느 조건에서나 한다.
   */
  workTitle?: string;
  /** 지문 묶음 머리에 붙일 조작 (조합 화면의 '이 지문 담기'). 지문 없는 묶음에는 안 붙는다 */
  renderGroupAction?: (group: ArchiveGroup) => React.ReactNode;
}

/**
 * 아카이브 목록 — 조건에 걸린 문항을 **지문별로 묶어** 늘어놓는다.
 *
 * 묶어 그리는 까닭: 목록만 보고는 어느 문항들이 같은 지문에 딸린 것인지 알 수 없어,
 * 문제지에 담을 때 지문 하나를 여러 번 담거나 딸린 문항을 빠뜨린다(문제지는 같은 지문의
 * 문항이 **붙어 있어야** 저장된다 — `compose.ts` 의 `isContiguous`).
 *
 * 작품으로 훑을 때는 묶음 안에서 **다른 작품과 함께 묻는 문항을 따로 세운다**(sql/33).
 * `(가)와 (나)의 공통점은?` 같은 문항은 진달래꽃만 가르치는 자리에 쓸 수 없는데, 섞여
 * 있으면 그걸 모르고 골라 담게 된다.
 *
 * 아카이브와 문제지 조합이 **이 부품 한 벌**을 쓴다 — 사본을 두면 묶는 규약이 언젠가
 * 한쪽만 고쳐진다.
 */
export default function ArchiveList({
  rows, loading, renderCard, workTitle, renderGroupAction,
}: ArchiveListProps) {
  const mode = workTitle ? 'work' : 'list';
  const grouped = usePassageGroups(rows, mode, !loading);
  // 이미지 지문의 본문과, 본문 제자리에 끼운 그림들은 서명 URL 이 있어야 보인다.
  // 머리만 받아 온 묶음(`adjacent`)에는 그 값이 아예 없어 빈 목록이 된다
  const passageImages = useSignedImageUrls(
    grouped.groups.flatMap((g) => {
      const passage = g.passage;
      if (!passage || !('html' in passage)) return [];
      return [passage.render_mode === 'image' ? passage.image_path : '', ...passage.figure_paths];
    }).filter(Boolean),
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

  return (
    <div className="space-y-3">
      {grouped.groups.map((group) => {
        const { passageId, passage, rows: groupRows } = group;
        // 지문 없는 문항은 머리 없이 카드만 — `list` 모드에서는 제자리에 한 장씩 온다
        if (!passageId && mode === 'list') {
          return (
            <div key={groupRows[0].id} className="space-y-2">
              {groupRows.map(renderCard)}
            </div>
          );
        }

        const full = passage && 'html' in passage ? passage : null;
        return (
          <PassageGroupCard
            // ⚠️ 키를 지문 id 로 삼지 말 것 — 지문 없는 묶음이 여럿이라 키가 겹친다
            key={groupRows[0].id}
            passageId={passageId}
            passage={passage}
            loading={grouped.loading}
            source={groupRows[0]?.source ?? null}
            problemCount={groupRows.length}
            highlightWork={workTitle}
            action={passageId && renderGroupAction
              ? renderGroupAction({ passageId, rows: groupRows })
              : undefined}
            imageUrl={full?.image_path ? passageImages.urls.get(full.image_path) : null}
            figureUrls={passageImages.urls}
          >
            {workTitle
              ? <WorkSpanSections rows={groupRows} workTitle={workTitle} card={renderCard} />
              : <div className="space-y-2">{groupRows.map(renderCard)}</div>}
          </PassageGroupCard>
        );
      })}
    </div>
  );
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
