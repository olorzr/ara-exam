'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil } from 'lucide-react';
import ExamSheetRenderer, { SHEET_CONFIGS } from './ExamSheetRenderer';
import MarkingModeToggle from './MarkingModeToggle';
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
  /** 합격 기준(%) — 채점 시트 머리에 '합격 N개 이상' 을 찍는다 */
  passPercentage?: number;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onBack: () => void;
  /** 수정 모드로 전환 */
  onEdit?: () => void;
  /** 개념지 탭에서 마킹 클릭/드래그 시 에디터 동기화 콜백 */
  onConceptClick?: (text: string) => void;
  onConceptDrag?: (text: string) => void;
  /** 마킹 모드 — 켜져 있을 때만 개념지 탭에서 클릭 해제·드래그 마킹이 된다(편집기와 같은 값) */
  markingMode: boolean;
  onToggleMarkingMode: () => void;
}

/**
 * 미리보기 화면: 탭 전환 + A4 렌더링 + 인쇄.
 * 마킹은 **마킹 모드가 켜져 있을 때만** 바뀐다 — 기존 개념지는 이 화면으로 바로 열리므로,
 * 인쇄하려다 단어를 누른 것만으로 문서가 바뀌면 안 된다.
 */
export default function ExamPreview({
  editorHTML,
  category,
  markCount,
  passPercentage,
  activeTab,
  onTabChange,
  onBack,
  onEdit,
  onConceptClick,
  onConceptDrag,
  markingMode,
  onToggleMarkingMode,
}: ExamPreviewProps) {
  /** 개념지 탭 + 마킹 모드 켜짐 — 이때만 미리보기가 마크를 붙이고 뗀다 */
  const canMark = activeTab === 'concept' && markingMode;

  /** 개념지 미리보기 드래그 → 마킹 */
  const handlePreviewMouseUp = useCallback(() => {
    if (!canMark) return;
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (selectedText && selectedText.length > 0) {
      onConceptDrag?.(selectedText);
      selection?.removeAllRanges();
      return;
    }
    // 클릭 해제는 이벤트 위임으로 처리
  }, [canMark, onConceptDrag]);

  /** 개념지 미리보기 마크 클릭 → 해제 */
  const handleConceptClick = useCallback(
    (e: React.MouseEvent) => {
      if (!canMark) return;
      const target = e.target as HTMLElement;
      if (target.getAttribute('data-concept-interactive') === 'true') {
        e.preventDefault();
        const text = target.getAttribute('data-original') ?? target.textContent ?? '';
        onConceptClick?.(text);
      }
    },
    [canMark, onConceptClick],
  );

  const renderSheets = () => {
    if (activeTab === 'all') {
      const keys = ['concept', 'stage1', 'stage2', 'stage3', 'answer'] as const;
      // 인쇄용 탭 — `interactive` 를 안 넘기므로 개념지 시트도 클릭할 수 없는 마크로 그려진다
      return keys.map((key, i) => (
        <ExamSheetRenderer
          key={key}
          editorHTML={editorHTML}
          config={SHEET_CONFIGS[key]}
          category={category}
          markCount={markCount}
          passPercentage={passPercentage}
          // 마지막 시트를 뺀 나머지는 뒤에서 페이지를 넘겨 시트마다 새 장에서 시작하게 한다
          breakAfterLast={i < keys.length - 1}
        />
      ));
    }
    const config = SHEET_CONFIGS[activeTab];
    if (!config) return null;
    return (
      <ExamSheetRenderer
        editorHTML={editorHTML}
        config={config}
        category={category}
        markCount={markCount}
        passPercentage={passPercentage}
        interactive={canMark}
      />
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* 탭 바 — 마킹 모드가 켜져 있으면 밑줄 색으로 알린다(편집기의 테두리와 같은 신호) */}
      <div
        className={`bg-white border-b-2 px-6 flex sticky top-[var(--app-topbar-h)] z-40 ${canMark ? 'border-primary' : 'border-gray-200'}`}
        data-no-print
      >
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

        {/* 마킹 모드 — 개념지 탭에만(다른 탭은 원래 마킹이 없다). 켜져야 클릭 해제·드래그 마킹이 된다 */}
        {activeTab === 'concept' && (
          <MarkingModeToggle pressed={markingMode} onToggle={onToggleMarkingMode} className="ml-auto self-center" />
        )}
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
