'use client';

import { useParams } from 'next/navigation';
import { ConceptSheetWorkspace } from '@/components/exam-builder';
import { useConceptSheetEditor } from '@/hooks/useConceptSheetEditor';

/** 개념지 목록 경로 — 뒤로 가기와 새로 만든 뒤 주소의 기준 */
const LIST_HREF = '/exam/builder';

/**
 * 개념지 에디터 페이지.
 *
 * 상태·로딩·저장(sanitize)은 `useConceptSheetEditor` 가, 화면 구성은
 * `ConceptSheetWorkspace` 가 맡는다 — 그 화면을 학교 프린트 시험지도 그대로 쓴다.
 */
export default function ConceptEditorPage() {
  const params = useParams<{ id: string }>();
  const editor = useConceptSheetEditor({ sheetId: params.id, listHref: LIST_HREF });

  return <ConceptSheetWorkspace editor={editor} backHref={LIST_HREF} />;
}
