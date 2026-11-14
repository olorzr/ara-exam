'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { TileHead } from '@/components/magazine';
import { Badge } from '@/components/ui/badge';
import { formatDateKR } from '@/lib/format';
import type { ConceptSheetListItem } from '@/types';

interface ConceptSheetCardProps {
  sheet: ConceptSheetListItem;
  onDelete: (id: string, title: string) => void;
}

/**
 * 개념지 꼭지 — 제목, 카테고리, 마킹 수, 수정일.
 *
 * 모양(2026-11-14, 원장님 "학교 프린트 시험지라던가 이런게 디자인이 안 예뻐"): 대시보드·기출 세트 카드와 같은 잡지 꼭지
 * (위아래 잉크 줄 · `( SHEET )` · 바탕체 제목 · 점선). 예전엔 그림자 뜨는 흰 카드였다.
 * ⚠️ 지우기 단추를 링크 **안에** 두지 않는다(링크 안 단추는 잘못된 HTML) — 링크는 꼭지 전체를 덮고(`after:inset-0`)
 *    단추는 그 위(`z-10`)에 형제로 둔다. 단추는 늘 보인다(마우스를 올려야 보이면 태블릿에서 못 지운다).
 */
export default function ConceptSheetCard({ sheet, onDelete }: ConceptSheetCardProps) {
  const categoryLabel = [sheet.grade, sheet.publisher, sheet.semester, sheet.unit, sheet.subunit]
    .filter(Boolean)
    .join(' ');
  const markCount = Array.isArray(sheet.marks) ? sheet.marks.length : 0;

  return (
    <div className="group relative flex h-full flex-col border-y-2 border-ink pt-1.5 pb-3.5 text-ink">
      <TileHead
        label="SHEET"
        aside={(
          <button
            type="button"
            className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
            onClick={() => onDelete(sheet.id, sheet.title)}
            aria-label={`${sheet.title} 삭제`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      />

      {/* 외부지문 level 은 '외부지문 및 프린트' 라 길다 — 좁으면 줄을 바꾼다 */}
      <Badge variant="outline" wrap className="mt-1.5 self-start">{sheet.level}</Badge>

      {/* 제목은 h3 그대로 — 화면 읽기 프로그램의 제목 탐색에서 꼭지마다 잡힌다(코덱스 2R). 링크가 꼭지 전체를 덮는다 */}
      <h3 className="mt-2 font-display text-[17px] leading-snug font-bold break-keep [overflow-wrap:anywhere] group-hover:text-primary">
        <Link href={`/exam/builder/${sheet.id}`} className="line-clamp-2 after:absolute after:inset-0">
          {sheet.title}
        </Link>
      </h3>
      {categoryLabel && <p className="mt-1 truncate text-xs text-gray-500">{categoryLabel}</p>}

      <div className="mt-auto pt-3">
        <hr className="mb-2 border-0 border-t-2 border-dotted border-ink" />
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
          <Badge variant="muted">마킹 {markCount}개</Badge>
          <span>{formatDateKR(sheet.updated_at)}</span>
        </div>
      </div>
    </div>
  );
}
