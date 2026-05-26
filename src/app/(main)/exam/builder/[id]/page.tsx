'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save } from 'lucide-react';
import {
  ExamCategoryBar,
  ExamEditor,
  ExamMarkingSidebar,
  ExamPreview,
} from '@/components/exam-builder';
import { useConceptSheetEditor } from '@/hooks/useConceptSheetEditor';

/**
 * 개념지 에디터 페이지.
 * 상태·로딩·저장(sanitize)·마킹 로직은 useConceptSheetEditor 훅이 담당하고,
 * 이 컴포넌트는 에디터/미리보기 화면 구성만 한다.
 */
export default function ConceptEditorPage() {
  const e = useConceptSheetEditor();

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
        <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 eb-preview-wrap" style={{ height: 'calc(100vh - 64px)' }}>
          <ExamPreview
            editorHTML={e.editorHTML}
            category={e.category}
            markCount={e.marks.length}
            activeTab={e.previewTab}
            onTabChange={e.setPreviewTab}
            onBack={() => e.router.push('/exam/builder')}
            onEdit={() => e.setScreen('editor')}
            onConceptClick={e.removeMarkByText}
            onConceptDrag={e.addMarkByText}
          />
        </div>
      )}

      {/* 에디터 화면 — preview 중에는 숨김 (언마운트하지 않음) */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-8" style={{ display: e.screen === 'editor' ? undefined : 'none' }}>
        {/* 상단 바: 뒤로가기 + 제목 + 저장 */}
        <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3 sticky top-16 z-50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => e.router.push('/exam/builder')}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            목록
          </Button>

          <Input
            placeholder="개념지 제목을 입력하세요"
            value={e.title}
            onChange={(ev) => e.handleTitleChange(ev.target.value)}
            className="flex-1 max-w-md border-transparent hover:border-gray-300 focus:border-primary bg-transparent text-base font-semibold"
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

        {/* 에디터 + 사이드바 */}
        <div className="flex gap-5 p-5 overflow-hidden" style={{ height: 'calc(100vh - 64px - 56px - 80px)' }}>
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
            />
          </div>
        </div>
      </div>
    </>
  );
}
