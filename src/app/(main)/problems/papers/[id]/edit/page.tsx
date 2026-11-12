'use client';

import { useParams } from 'next/navigation';
import PaperEditScreen from '@/components/problem-paper/PaperEditScreen';

/**
 * 문제지 고치기 (`/problems/papers/[id]/edit`) — 문제 은행 쪽이라 평가문제집은 보이지 않는다.
 * 고칠 수 있는지(작성자·원장, 책에 담기면 원장만, OMR 은 채점 전까지만)는 화면과 DB 가 같은 판정으로 본다(sql/103).
 */
export default function ProblemPaperEditPage() {
  const params = useParams<{ id: string }>();
  return <PaperEditScreen paperId={params?.id ?? ''} />;
}
