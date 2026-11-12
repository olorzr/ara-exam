'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import PaperEditBanner from '@/components/problem-paper/PaperEditBanner';
import PaperEditWorkspace from '@/components/problem-paper/PaperEditWorkspace';
import { usePaperEditLoad } from '@/hooks/usePaperEditLoad';

interface PaperEditScreenProps {
  paperId: string;
  /** 평가문제집을 보이는가 — 책 만들기 쪽 주소(`/books/papers/[id]/edit`, 원장 전용)만 켠다 */
  withWorkbook?: boolean;
  /** 저장한 뒤 갈 곳 — 없으면 그 문제지 보기 화면 */
  doneHref?: string;
}

/**
 * 문제지 고치기 화면(`/problems/papers/[id]/edit` · `/books/papers/[id]/edit`) — 만든 뒤에도 순서 바꾸기·빼기·넣기.
 *
 * 읽기 → 고칠 수 있는지(작성자·원장, 책에 담기면 원장만, OMR 은 채점 전까지만 — sql/103) → 만들기와 **같은 몸통**.
 * 막힌 문제지는 몸통을 그리지 않고 까닭만 보인다(서버도 같은 판정으로 저장을 막는다).
 * @param props - 문제지 id · 평가문제집 · 저장 뒤 갈 곳
 * @returns 고치기 화면
 */
export default function PaperEditScreen({ paperId, withWorkbook = false, doneHref }: PaperEditScreenProps) {
  const { load, version, reload } = usePaperEditLoad(paperId);
  const viewHref = `/problems/papers/${paperId}`;

  if (load.status === 'loading') {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (load.status === 'missing' || load.status === 'error') {
    return (
      <Card>
        <CardContent className="space-y-3 py-12 text-center text-sm text-gray-500">
          <p>{load.status === 'missing' ? '문제지를 찾지 못했어요. 지워졌을 수 있어요.' : load.message}</p>
          <div className="flex justify-center gap-2">
            {load.status === 'error' && <Button type="button" size="sm" variant="outline" onClick={reload}>다시 불러오기</Button>}
            <Link href="/problems/papers" className="text-primary underline underline-offset-2">문제지 목록으로</Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (load.state.reason) {
    return (
      <div className="space-y-3">
        <PaperEditBanner kind="blocked" reason={load.state.reason} />
        <Link href={viewHref} className="text-sm text-primary underline underline-offset-2">문제지로 돌아가기</Link>
      </div>
    );
  }

  return (
    <PaperEditWorkspace
      key={version}
      data={load.data}
      state={load.state}
      withWorkbook={withWorkbook}
      doneHref={doneHref ?? viewHref}
      onReload={reload}
    />
  );
}
