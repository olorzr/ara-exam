'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * 열어 둔 문제지가 다른 곳에서 고쳐졌다는 안내 — **인쇄물에도 찍힌다**(`data-no-print` 를 붙이지 않는다).
 *
 * 인쇄 단추는 잠그지만 Cmd/Ctrl+P 는 단추를 건너뛰므로, 옛 차례로 뽑은 종이에 이 안내가 함께 나와야 조용히 나가지 않는다
 * (번호 어긋남 안내와 같은 규약). 새로 고치는 단추만 인쇄물에서 뺀다.
 * @returns 안내 띠
 */
export default function PaperStaleNotice() {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      <p className="min-w-0 flex-1">
        <strong>다른 곳에서 이 문제지가 고쳐졌어요.</strong> 지금 화면은 고치기 전 내용이라 이대로 인쇄하면 학원 성적의
        정답표와 번호가 어긋날 수 있어요. 새로 고친 뒤 인쇄해 주세요.
      </p>
      <Button type="button" size="sm" variant="outline" data-no-print onClick={() => window.location.reload()}>
        <RefreshCw className="h-3.5 w-3.5" /><span className="ml-1">새로 고치기</span>
      </Button>
    </div>
  );
}
