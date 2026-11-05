'use client';

import PaperComposeScreen from '@/components/problem-paper/PaperComposeScreen';
import { useDirectorGate } from '@/hooks/useDirectorGate';

/**
 * 책 만들기의 문제지 만들기 (`/books/papers/new`) — **원장 전용**.
 *
 * 문제 은행의 문제지 조합과 같은 화면이고 평가문제집이 보이는 **유일한 곳**이다(2026-11-05).
 * 저장한 문제지는 내지 만들기의 장 담기에서 고른다.
 */
export default function BookPaperComposePage() {
  const gate = useDirectorGate();

  if (gate.checking || !gate.allowed) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return <PaperComposeScreen withWorkbook />;
}
