'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import type { ConceptSheetEditorState } from '@/hooks/useConceptSheetEditor';
import ExamCategoryBar from './ExamCategoryBar';
import ExamEditor from './ExamEditor';
import ExamMarkingSidebar from './ExamMarkingSidebar';
import ExamPreview from './ExamPreview';
import PassPercentageField from './PassPercentageField';

interface ConceptSheetWorkspaceProps {
  /** `useConceptSheetEditor` 가 돌려준 것 그대로 */
  editor: ConceptSheetEditorState;
  /** 목록으로 돌아갈 경로 */
  backHref: string;
  /**
   * 편집기 왼쪽에 붙일 칸 (학교 프린트의 원본 쪽 이미지).
   * 미리보기로 넘어가면 편집기 블록째 숨으므로 따로 감출 필요가 없다.
   */
  sidePanel?: ReactNode;
  titlePlaceholder?: string;
}

/**
 * 개념지 편집·미리보기 화면.
 *
 * 개념지(`/exam/builder/[id]`)와 학교 프린트 시험지(`/print-sheets/[bundleId]`)가
 * **이 컴포넌트 하나**를 공유한다 — 두 벌로 두면 한쪽만 고쳐져 인쇄·마킹·저장이 갈라진다.
 */
export default function ConceptSheetWorkspace({
  editor: e, backHref, sidePanel, titlePlaceholder = '개념지 제목을 입력하세요',
}: ConceptSheetWorkspaceProps) {
  const ai = useAiEnabled();

  if (e.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      {/* 미리보기 화면 */}
      {e.screen === 'preview' && (
        <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 eb-preview-wrap" style={{ height: 'calc(100vh - var(--app-topbar-h))' }}>
          <ExamPreview
            editorHTML={e.editorHTML}
            category={e.category}
            markCount={e.marks.length}
            passPercentage={e.passPercentage}
            activeTab={e.previewTab}
            onTabChange={e.setPreviewTab}
            onBack={() => e.router.push(backHref)}
            onEdit={() => e.setScreen('editor')}
            onConceptClick={e.removeMarkByText}
            onConceptDrag={e.addMarkByText}
          />
        </div>
      )}

      {/* 에디터 화면 — preview 중에는 숨김 (언마운트하지 않음) */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-8" style={{ display: e.screen === 'editor' ? undefined : 'none' }}>
        {/* 상단 바: 뒤로가기 + 제목 + 저장 */}
        <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3 sticky top-[var(--app-topbar-h)] z-50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => e.router.push(backHref)}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            목록
          </Button>

          <Input
            placeholder={titlePlaceholder}
            value={e.title}
            onChange={(ev) => e.handleTitleChange(ev.target.value)}
            className="flex-1 max-w-md border-transparent hover:border-gray-300 focus:border-primary bg-transparent text-base font-semibold"
          />

          {/* 합격 기준 — 단어 시험지 생성 화면과 같은 자리(제목과 저장 사이) */}
          <PassPercentageField
            value={e.passPercentage}
            onChange={e.setPassPercentage}
            markCount={e.marks.length}
          />

          <Button
            size="sm"
            className="bg-primary hover:bg-primary-hover text-white ml-auto shrink-0"
            onClick={e.handleSave}
            disabled={e.saving}
          >
            <Save className="h-4 w-4 mr-1" />
            {e.saving ? '저장 중...' : '저장'}
          </Button>
        </div>

        {/* 카테고리 바 */}
        <ExamCategoryBar category={e.category} onChange={e.handleCategoryChange} />

        {/* (원본) + 에디터 + 사이드바 */}
        <div className="flex gap-5 p-5 overflow-hidden" style={{ height: 'calc(100vh - var(--app-topbar-h) - 56px - 80px)' }}>
          {sidePanel && (
            <div className="hidden xl:block flex-[3] min-w-[240px] h-full overflow-y-auto">
              {sidePanel}
            </div>
          )}
          <div className="flex-[7] min-w-0 h-full">
            <ExamEditor
              onHTMLChange={e.setEditorHTML}
              onMarksChange={e.setMarks}
              editorRef={e.editorRef}
              initialContent={e.initialHTML ?? undefined}
            />
          </div>
          <div className="flex-[3] min-w-[280px] h-full overflow-y-auto">
            <ExamMarkingSidebar
              marks={e.marks}
              onDelete={e.deleteMark}
              onClearAll={e.clearAllMarks}
              onPreview={() => { e.setPreviewTab('concept'); e.setScreen('preview'); }}
              aiPick={{
                enabled: ai.features.concept_pick,
                editorRef: e.editorRef,
                marks: e.marks,
                addMarkByText: e.addMarkByText,
                removeMarkByText: e.removeMarkByText,
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
