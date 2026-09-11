'use client';

import { useState } from 'react';
import { BookOpenText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * '다음 쪽 이어 읽기' 단추와 쪽 고르기.
 *
 * 쪽을 **사람이 고른다.** 지문이 몇 쪽까지 이어졌는지는 저장된 행에 없고(시작 쪽만 있다),
 * 우리가 짐작해 엉뚱한 쪽을 읽으면 ChatGPT 한 번을 헛되이 쓴다.
 * 기본값만 '시작 쪽 다음' 으로 둔다.
 */

interface PassageContinueButtonProps {
  /** 기본으로 제안할 쪽 */
  defaultPage: number;
  /** 원본 문서의 마지막 쪽 — 없는 쪽을 읽으러 가지 않게 가둔다 */
  maxPage: number;
  busy: boolean;
  onRead: (page: number) => void;
}

export default function PassageContinueButton({
  defaultPage, maxPage, busy, onRead,
}: PassageContinueButtonProps) {
  const [page, setPage] = useState(String(defaultPage));

  const parsed = Number(page);
  const valid = Number.isInteger(parsed) && parsed >= 1 && (maxPage === 0 || parsed <= maxPage);

  return (
    <div className="flex flex-wrap items-end gap-2 rounded border border-dashed border-gray-300 p-2">
      <div className="space-y-1">
        <Label htmlFor={`continue-page-${defaultPage}`} className="text-xs text-gray-500">
          이어지는 쪽
        </Label>
        <Input
          id={`continue-page-${defaultPage}`}
          value={page}
          onChange={(e) => setPage(e.target.value)}
          inputMode="numeric"
          className="h-8 w-20 text-sm"
        />
      </div>
      <Button
        type="button" variant="outline" size="sm"
        disabled={busy || !valid}
        onClick={() => onRead(parsed)}
      >
        <BookOpenText className="h-3.5 w-3.5" />
        <span className="ml-1">{busy ? '읽는 중…' : '다음 쪽 이어 읽기'}</span>
      </Button>
      <p className="flex-1 text-[11px] text-gray-400">
        그 쪽 머리에서 이어지는 글만 읽어 본문 끝에 붙입니다. ChatGPT 를 한 번 쓰고,
        <strong className="font-medium"> 저장은 직접 눌러야</strong> 반영돼요.
      </p>
    </div>
  );
}
