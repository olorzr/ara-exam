'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { formatDateKR } from '@/lib/format';
import type { ConceptSheetListItem } from '@/types';

interface ConceptSheetCardProps {
  sheet: ConceptSheetListItem;
  onDelete: (id: string, title: string) => void;
}

/** 개념지 카드 컴포넌트. 제목, 카테고리, 마킹 수, 수정일을 표시한다. */
export default function ConceptSheetCard({ sheet, onDelete }: ConceptSheetCardProps) {
  const categoryLabel = [sheet.grade, sheet.publisher, sheet.semester, sheet.unit, sheet.subunit]
    .filter(Boolean)
    .join(' ');

  const markCount = Array.isArray(sheet.marks) ? sheet.marks.length : 0;

  return (
    <Link href={`/exam/builder/${sheet.id}`}>
      <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-full">
        <CardContent className="p-5 flex flex-col h-full">
          {/* 상단: 레벨 뱃지 + 삭제 */}
          <div className="flex items-center justify-between mb-3">
            <Badge variant="outline" className="text-xs">
              {sheet.level}
            </Badge>
            <button
              className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(sheet.id, sheet.title);
              }}
              aria-label={`${sheet.title} 삭제`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* 제목 */}
          <h3 className="font-bold text-gray-900 text-base mb-1 line-clamp-2">
            {sheet.title}
          </h3>

          {/* 카테고리 */}
          {categoryLabel && (
            <p className="text-xs text-gray-500 mb-3 truncate">{categoryLabel}</p>
          )}

          {/* 하단: 마킹 수 + 수정일 */}
          <div className="mt-auto flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
            <span>마킹 {markCount}개</span>
            <span>{formatDateKR(sheet.updated_at)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
