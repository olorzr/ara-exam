'use client';

import { BookCheck, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BookFinishControlProps {
  /** 다 만든 때(ISO). null 이면 만드는 중 */
  finishedAt: string | null;
  onToggle: (finished: boolean) => void;
}

/**
 * '다 만들었어요' / '다시 작업' — 다 만든 항목은 사이드바 '다 만든 책' 목록으로 옮겨 간다.
 * 인쇄했는지는 기계가 알 수 없어 사람이 누른다.
 */
export default function BookFinishControl({ finishedAt, onToggle }: BookFinishControlProps) {
  if (!finishedAt) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => onToggle(true)}>
        <BookCheck className="h-3.5 w-3.5" />
        <span className="ml-1">다 만들었어요</span>
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800">
        다 만든 책 · {new Date(finishedAt).toLocaleDateString('ko-KR')}
      </span>
      <Button type="button" size="sm" variant="outline" onClick={() => onToggle(false)}>
        <RotateCcw className="h-3.5 w-3.5" />
        <span className="ml-1">다시 작업</span>
      </Button>
    </span>
  );
}
