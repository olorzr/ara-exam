'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import PaperEditScreen from '@/components/problem-paper/PaperEditScreen';
import { useDirectorGate } from '@/hooks/useDirectorGate';

/** 책 id 모양 — 이 꼴이 아닌 `from` 은 따르지 않는다(주소로 아무 데나 보내지 않게) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  );
}

function BookPaperEdit() {
  const gate = useDirectorGate();
  const params = useParams<{ id: string }>();
  const from = useSearchParams()?.get('from') ?? '';

  if (gate.checking || !gate.allowed) return <Spinner />;

  return (
    <PaperEditScreen
      paperId={params?.id ?? ''}
      withWorkbook
      doneHref={UUID_RE.test(from) ? `/books/inner/${from}` : undefined}
    />
  );
}

/**
 * 책 만들기의 문제지 고치기 (`/books/papers/[id]/edit`) — **원장 전용**, 평가문제집이 보인다(`/books/papers/new` 의 짝).
 * 내지 만들기의 장 목록에서 `?from=<책 id>` 를 달고 오면 저장한 뒤 그 책의 내지 화면으로 돌아간다.
 * useSearchParams 는 Suspense 경계가 필요하다(Next 규약).
 */
export default function BookPaperEditPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <BookPaperEdit />
    </Suspense>
  );
}
