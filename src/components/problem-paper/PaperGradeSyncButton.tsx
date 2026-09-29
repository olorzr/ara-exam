'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { gradeSyncFailureMessage, requestGradeSync } from '@/lib/grade-sync-client';

interface PaperGradeSyncButtonProps {
  paperId: string;
}

/**
 * OMR 문제지를 학원 성적 시스템에 (다시) 등록하는 단추.
 *
 * 만들 때 한 번 자동으로 보내지만(fire-and-forget), 연동이 잠깐 막혔거나 경고 토스트를 놓쳤으면
 * 여기서 다시 보낸다 — 수신부가 멱등이라 여러 번 눌러도 시험이 늘지 않는다. 등록 상태를 이 앱에
 * 저장하지 않으므로(진실은 성적 시스템에 있다) 결과는 **응답을 그대로** 알린다.
 */
export default function PaperGradeSyncButton({ paperId }: PaperGradeSyncButtonProps) {
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const res = await requestGradeSync('/api/sync-paper-to-grades', { paperId });
      if (res === null) {
        toast.error('로그인이 만료됐어요. 새로고침 후 다시 눌러 주세요.');
        return;
      }
      const failure = gradeSyncFailureMessage(res);
      if (failure) {
        toast.error(`학원 성적 등록 실패 — ${failure}`);
        return;
      }
      const result = res?.result;
      const where = result?.teacher ? `'문제은행 시험지 › ${result.teacher}' 폴더` : '문제은행 시험지 폴더';
      toast.success(`${where}에 ${result?.created ? '새로 등록했어요' : '다시 보냈어요(이미 등록돼 있었어요)'}.`);
      // 채점을 시작한 시험은 정답표가 얼어 있어 고친 값이 반영되지 않는다 — 알리지 않으면 반영된 줄 안다
      if (result?.answerKeyFrozen) toast.warning('이미 채점한 시험이라 정답표는 바뀌지 않았어요.');
      if (result?.omrTemplateDetached) toast.warning('정답표가 OMR 로 채점할 수 없는 모양이라 90A 양식을 뗐어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" size="sm" variant="outline" onClick={send} disabled={busy} data-no-print>
      <Send className="h-3.5 w-3.5" />
      <span className="ml-1">{busy ? '보내는 중…' : '학원 성적에 등록'}</span>
    </Button>
  );
}
