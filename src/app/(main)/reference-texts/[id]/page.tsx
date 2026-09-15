'use client';

import { useParams } from 'next/navigation';
import { ReferenceTextForm } from '@/components/reference-texts';
import { useReferenceTextEditor } from '@/hooks/useReferenceTextEditor';

/** 전문 목록 경로 — 뒤로 가기와 새로 만든 뒤 주소의 기준 */
const LIST_HREF = '/reference-texts';

/**
 * 작품 전문 편집 페이지 (`/reference-texts/[id]`, 'new' 면 새로 만들기).
 *
 * 개념지 편집기와 같은 모양이다 — 상태·로딩·저장은 훅이, 화면은 폼이 맡는다.
 */
export default function ReferenceTextEditorPage() {
  const params = useParams<{ id: string }>();
  const editor = useReferenceTextEditor({ id: params.id, listHref: LIST_HREF });

  return <ReferenceTextForm editor={editor} backHref={LIST_HREF} />;
}
