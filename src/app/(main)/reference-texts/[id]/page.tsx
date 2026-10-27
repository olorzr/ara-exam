'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ReferenceTextForm } from '@/components/reference-texts';
import { useReferenceTextEditor } from '@/hooks/useReferenceTextEditor';

/** 전문 목록 경로 — 뒤로 가기와 새로 만든 뒤 주소의 기준 */
const LIST_HREF = '/reference-texts';

/**
 * 작품 전문 · 개념 편집 화면 — 주소에서 id 와 종류를 읽는다.
 *
 * 주소의 종류(`?kind=개념`)는 **처음 한 번만** 읽는다(훅의 useState 초기값) — 바꾸는 것은 폼의 종류 칸이다.
 * @returns 편집 폼
 */
function ReferenceTextEditor() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const initialKind = search.get('kind') === '개념' ? '개념' : '작품';
  const editor = useReferenceTextEditor({ id: params.id, listHref: LIST_HREF, initialKind });

  return <ReferenceTextForm editor={editor} backHref={LIST_HREF} />;
}

/**
 * 작품 전문 · 개념 편집 페이지 (`/reference-texts/[id]`, 'new' 면 새로 만들기).
 *
 * 개념지 편집기와 같은 모양이다 — 상태·로딩·저장은 훅이, 화면은 폼이 맡는다.
 * `useSearchParams` 는 Suspense 경계 안에서 부른다(`words/print/page.tsx` 와 같은 규약).
 * @returns 편집 화면
 */
export default function ReferenceTextEditorPage() {
  return (
    <Suspense fallback={null}>
      <ReferenceTextEditor />
    </Suspense>
  );
}
