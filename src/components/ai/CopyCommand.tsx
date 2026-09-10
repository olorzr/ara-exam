'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CopyCommandProps {
  /** 붙여넣을 명령 한 줄 */
  command: string;
}

/**
 * 명령 한 줄 + 복사 버튼. 윈도우·맥 안내가 함께 쓴다.
 *
 * 대상은 컴퓨터를 잘 모르는 선생님이라 손으로 옮겨 적게 하지 않는다.
 * 복사 상태는 이 컴포넌트가 각자 들고 있어, 안내에 명령이 여럿이어도 서로 안 섞인다.
 */
export default function CopyCommand({ command }: CopyCommandProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드가 막힌 환경 — 명령어가 화면에 그대로 보이므로 손으로 옮겨 적으면 된다
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="min-w-0 flex-1 rounded bg-gray-100 px-3 py-2 font-mono text-xs break-all">
        {command}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        <span className="ml-1">{copied ? '복사됨' : '복사'}</span>
      </Button>
    </div>
  );
}
