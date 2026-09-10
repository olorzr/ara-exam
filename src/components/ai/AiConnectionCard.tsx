'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { readLocalStatus, readLocalUsage, type LocalStatus, type UsageInfo } from '@/lib/ai/codex/localClient';
import { DEFAULT_CODEX_PORT, getCodexPort, isValidPort, setCodexPort } from '@/lib/ai/localPort';
import { hintKind, showsPromptNote, statusLabel } from '@/lib/ai/connectionStatusText';
import { detectBrowser, detectSetupOs } from '@/lib/ai/setupOs';
import ConnectionHint from './ConnectionHint';
import AiModelSelect from './AiModelSelect';

/**
 * 개인 ChatGPT 연결 상태 카드.
 *
 * **서버에 묻지 않는다** — 브라우저가 선생님 PC 의 브릿지에 직접 붙어 판정한다.
 * 로그인 정보(auth.json)는 선생님 PC 를 벗어나지 않고 학원 서버는 토큰을 보지 않는다.
 *
 * 상태를 셋으로 나누는 이유는 선생님이 할 일이 각각 다르기 때문이다:
 * 미실행(프로그램 켜기) / 미로그인(codex login) / 연결됨(바로 사용).
 */
export default function AiConnectionCard() {
  // 안내 문구가 갈리는 축. lazy 초기화 — 효과에서 setState 하면 lint 가 막는다.
  // (윈도우/맥 전환은 아래 '처음 설치하기' 안내에 있다. 여기 감지는 문구용 기본값일 뿐)
  const [env] = useState(() => ({ os: detectSetupOs(), browser: detectBrowser() }));
  const [port, setPort] = useState(DEFAULT_CODEX_PORT);
  const [portInput, setPortInput] = useState(String(DEFAULT_CODEX_PORT));
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    const saved = getCodexPort();
    setPort(saved);
    setPortInput(String(saved));
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const check = useCallback(async (p: number) => {
    setChecking(true);
    try {
      const next = await readLocalStatus(p);
      if (!aliveRef.current) return;
      setStatus(next);
      if (next.kind === 'connected') {
        const info = await readLocalUsage(p);
        if (aliveRef.current) setUsage(info);
      } else {
        setUsage(null);
      }
    } finally {
      if (aliveRef.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    check(port);
  }, [port, check]);

  const handleSavePort = () => {
    const n = Number.parseInt(portInput, 10);
    if (!isValidPort(n)) {
      toast.error('포트는 1024~65535 사이 숫자로 입력해 주세요.');
      return;
    }
    setCodexPort(n);
    setPort(n);
    toast.success('포트를 저장했어요.');
  };

  const connected = status?.kind === 'connected';

  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg border p-4 ${
          connected ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900">{statusLabel(status, env.browser)}</p>
            {connected && status.email && (
              <p className="mt-0.5 text-sm text-gray-600">{status.email}</p>
            )}
            {connected && usage?.percentUsed !== null && usage?.percentUsed !== undefined && (
              <p className="mt-0.5 text-sm text-gray-600">약 {usage.percentUsed}% 사용</p>
            )}
          </div>
          <Button type="button" variant="outline" onClick={() => check(port)} disabled={checking}>
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            <span className="ml-1">다시 확인</span>
          </Button>
        </div>
      </div>

      {status && !connected && (
        <ConnectionHint
          kind={hintKind(status, env.browser)}
          showPromptNote={showsPromptNote(status, env.browser)}
          os={env.os}
        />
      )}

      {connected && <AiModelSelect port={port} />}

      <div className="space-y-2">
        <Label htmlFor="codex-port">연결 포트</Label>
        <div className="flex items-center gap-2">
          <Input
            id="codex-port"
            inputMode="numeric"
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
            className="w-32"
          />
          <Button type="button" variant="outline" onClick={handleSavePort}>
            저장
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          기본값은 {DEFAULT_CODEX_PORT} 입니다. 바꿨다면 브릿지도 같은 번호로 맞춰야 합니다 —
          윈도우는 <code className="rounded bg-gray-100 px-1 py-0.5">start-codex.cmd</code> 안의{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5">set &quot;CODEX_PORT=...&quot;</code> 를 고치고,
          맥은 <strong>처음 설치하기 → 맥</strong>의 설치 명령을 다시 실행하세요.
          (바꾼 뒤 새로고침하면 안내에도 반영됩니다)
        </p>
      </div>
    </div>
  );
}
