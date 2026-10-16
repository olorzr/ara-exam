'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ArchiveFailure } from '@/hooks/useProblemArchive';

interface ArchiveLoadErrorProps {
  failure: ArchiveFailure;
  onRetry: () => void;
}

/** 실패 까닭마다 사람에게 보일 말 */
const MESSAGES: Record<ArchiveFailure, string> = {
  refresh: '목록을 새로 불러오지 못했어요. 방금 바꾼 내용이 아직 반영되지 않았을 수 있어요.',
  query: '이 조건의 문항을 불러오지 못했어요.',
};

/**
 * 아카이브 목록을 못 읽었을 때 목록 자리에 세우는 안내 (2026-10-15 리뷰 5번).
 *
 * ⚠️ 옛 조건의 목록을 대신 보여 주지 않는다 — 새 조건의 결과처럼 보이고, 그 행으로
 *    선택·담기·삭제·태깅이 이어진다. 안내와 '다시 시도' 만 둔다.
 * @param props - 실패 까닭과 다시 시도
 * @returns 안내 카드
 */
export default function ArchiveLoadError({ failure, onRetry }: ArchiveLoadErrorProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-sm text-gray-600" role="alert">
        <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
        <p>{MESSAGES[failure]}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>다시 시도</Button>
      </CardContent>
    </Card>
  );
}
