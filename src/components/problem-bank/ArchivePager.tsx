'use client';

import { Button } from '@/components/ui/button';

interface ArchivePagerProps {
  /** 지금 쪽 (0부터) */
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}

/**
 * 목록 쪽 넘김 — 아카이브와 문제지 조합이 함께 쓴다.
 *
 * 목록은 60개씩 끊어 오므로(`PROBLEM_PAGE_SIZE`) 넘기는 길이 없으면 그 뒤 문항은 보이지도
 * 담기지도 않는다. 한 쪽뿐이면 아예 그리지 않는다 — 누를 것이 없는 줄만 남는다.
 */
export default function ArchivePager({ page, pageCount, onPage }: ArchivePagerProps) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        type="button" variant="outline" size="sm"
        onClick={() => onPage(page - 1)}
        disabled={page <= 0}
      >
        이전
      </Button>
      <span className="text-sm text-gray-500">{page + 1} / {pageCount}</span>
      <Button
        type="button" variant="outline" size="sm"
        onClick={() => onPage(page + 1)}
        disabled={page >= pageCount - 1}
      >
        다음
      </Button>
    </div>
  );
}
