'use client';

import { Button } from '@/components/ui/button';
import { Trash2, Eye } from 'lucide-react';
import AiPickSection, { type AiPickSectionProps } from './AiPickSection';

/** 마킹된 개념 아이템 */
export interface MarkItem {
  text: string;
  pos: number;
  len: number;
}

interface ExamMarkingSidebarProps {
  marks: MarkItem[];
  onDelete: (pos: number, len: number) => void;
  onClearAll: () => void;
  onPreview: () => void;
  /** AI 추천 빈칸을 얹을 때 (기능이 꺼져 있으면 그려지지 않는다) */
  aiPick?: AiPickSectionProps;
}

/**
 * 에디터 우측 마킹 목록 사이드바.
 * 마킹된 개념 번호 목록 + 개별/전체 삭제 + 미리보기 전환,
 * 그리고 (열려 있으면) AI 추천 빈칸.
 */
export default function ExamMarkingSidebar({
  marks, onDelete, onClearAll, onPreview, aiPick,
}: ExamMarkingSidebarProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-900">마킹 개념</h3>
        <span className="text-[13px] font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
          총 {marks.length}개
        </span>
      </div>

      {/* AI 추천 — 목록 위에 둔다(마킹을 만드는 도구이므로 결과보다 앞이다) */}
      {aiPick && <AiPickSection {...aiPick} />}

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {marks.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            마킹 모드를 켜고<br />텍스트를 드래그하세요
          </p>
        )}
        {marks.map((m, i) => (
          <div
            key={`${m.pos}-${m.text}`}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-gray-50 group"
          >
            <span className="text-xs font-bold text-primary bg-primary/10 w-7 h-7 flex items-center justify-center rounded-md shrink-0">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="flex-1 text-sm text-gray-700 truncate" title={m.text}>
              {m.text}
            </span>
            <button
              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onDelete(m.pos, m.len)}
              aria-label={`${m.text} 마킹 해제`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* 하단 버튼 */}
      <div className="p-3 border-t border-gray-200 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onClearAll}
          disabled={marks.length === 0}
        >
          전체 해제
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-primary text-white hover:bg-primary-hover"
          onClick={onPreview}
          disabled={marks.length === 0}
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          미리보기
        </Button>
      </div>
    </div>
  );
}
