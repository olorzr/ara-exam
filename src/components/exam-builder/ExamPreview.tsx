'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil } from 'lucide-react';
import ExamSheetRenderer, { SHEET_CONFIGS } from './ExamSheetRenderer';
import type { BuilderCategory } from './ExamCategoryBar';

/** 미리보기 탭 목록 */
const TABS = [
  { key: 'concept', label: '개념지', pink: false },
  { key: 'stage1', label: '1단계: 초성', pink: false },
  { key: 'stage2', label: '2단계: □', pink: true },
  { key: 'stage3', label: '3단계: ____', pink: true },
  { key: 'answer', label: '답안지', pink: true },
  { key: 'all', label: '전체 출력', pink: false },
] as const;

interface ExamPreviewProps {
  editorHTML: string;
  category: BuilderCategory;
  markCount: number;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onBack: () => void;
  /** 수정 모드로 전환 */
  onEdit?: () => void;
  /** 개념지 탭에서 마킹 클릭/드래그 시 에디터 동기화 콜백 */
  onConceptClick?: (text: string) => void;
  onConceptDrag?: (text: string) => void;
}

/**
 * 미리보기 화면: 탭 전환 + A4 렌더링 + 인쇄.
 */
export default function ExamPreview({
  editorHTML,
  category,
  markCount,
  activeTab,
  onTabChange,
  onBack,
  onEdit,
  onConceptClick,
  onConceptDrag,
}: ExamPreviewProps) {
  /** 개념지 미리보기 클릭/드래그 핸들러 */
  const handlePreviewMouseUp = useCallback(() => {
    if (activeTab !== 'concept') return;
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (selectedText && selectedText.length > 0) {
      onConceptDrag?.(selectedText);
      selection?.removeAllRanges();
      return;
    }
    // 클릭 해제는 이벤트 위임으로 처리
  }, [activeTab, onConceptDrag]);

  const handleConceptClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.getAttribute('data-concept-interactive') === 'true') {
        e.preventDefault();
        const text = target.getAttribute('data-original') ?? target.textContent ?? '';
        onConceptClick?.(text);
      }
    },
    [onConceptClick],
  );

  const renderSheets = () => {
    if (activeTab === 'all') {
      const keys = ['concept', 'stage1', 'stage2', 'stage3', 'answer'] as const;
      return keys.map((key, i) => {
        const cfg = { ...SHEET_CONFIGS[key] };
        if (key === 'concept') cfg.mode = 'concept';
        return (
          <ExamSheetRenderer
            key={key}
            editorHTML={editorHTML}
            config={cfg}
            category={category}
            markCount={markCount}
            // 마지막 시트를 뺀 나머지는 뒤에서 페이지를 넘겨 시트마다 새 장에서 시작하게 한다
            breakAfterLast={i < keys.length - 1}
          />
        );
      });
    }
    const config = SHEET_CONFIGS[activeTab];
    if (!config) return null;
    return (
      <ExamSheetRenderer
        editorHTML={editorHTML}
        config={config}
        category={category}
        markCount={markCount}
        interactive={activeTab === 'concept'}
      />
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* 탭 바 */}
      <div className="bg-white border-b-2 border-gray-200 px-6 flex sticky top-16 z-40" data-no-print>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-3 text-sm font-semibold border-b-[3px] transition-colors whitespace-nowrap
              ${activeTab === tab.key
                ? tab.pink
                  ? 'text-[#C83C6E] border-[#C83C6E]'
                  : 'text-primary border-primary'
                : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 미리보기 영역 */}
      <div
        className="flex-1 overflow-y-auto p-8 bg-gray-100 flex justify-center eb-preview-area"
        onClick={handleConceptClick}
        onMouseUp={handlePreviewMouseUp}
      >
        <div className="flex flex-col items-center gap-4">{renderSheets()}</div>
      </div>

      {/* 하단 액션 바 */}
      <div className="bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center" data-no-print>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> 목록
          </Button>
          {onEdit && (
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-1" /> 수정하기
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            인쇄
          </Button>
        </div>
      </div>
    </div>
  );
}
