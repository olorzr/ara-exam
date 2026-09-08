'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ARA_AI_FILES, ARA_AI_FILES_ORIGIN } from '@/lib/ai/constants';

const INSTALL_COMMAND = 'npm install -g @openai/codex';

/**
 * 처음 설치하는 선생님을 위한 4단계 안내.
 *
 * 설치 파일은 **학원 관리 시스템(ara-system)이 호스팅한다** — 선생님 PC 에는 브릿지가
 * 한 벌만 있으면 되고(두 앱이 공유), 여기서 또 배포하면 같은 포트를 두고 다투게 된다.
 */
export default function AiSetupGuide() {
  const [copied, setCopied] = useState(false);

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드가 막힌 환경 — 명령어가 화면에 그대로 보이므로 손으로 옮겨 적으면 된다
    }
  };

  return (
    <div className="space-y-4 text-sm text-gray-700">
      <p className="text-gray-500">
        내 컴퓨터에서 내 ChatGPT 계정으로 동작합니다. 학원 서버는 로그인 정보를 보지도 저장하지도
        않아요. <strong>윈도우에서만</strong> 사용할 수 있습니다.
      </p>

      <ol className="space-y-3 list-decimal list-inside">
        <li>
          <a
            href="https://nodejs.org"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            nodejs.org
          </a>
          에서 Node.js 를 설치합니다.
        </li>

        <li>
          명령 프롬프트에서 아래를 실행합니다.
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded bg-gray-100 px-3 py-2 font-mono text-xs">
              {INSTALL_COMMAND}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={copyCommand}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="ml-1">{copied ? '복사됨' : '복사'}</span>
            </Button>
          </div>
        </li>

        <li>
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">codex login</code> 을
          실행하고 열린 브라우저에서 ChatGPT 에 로그인합니다.
        </li>

        <li>
          아래 파일 3개를 <strong>같은 폴더</strong>에 내려받고,{' '}
          <strong>install-autostart.cmd</strong> 만 두 번 누릅니다.
          <ul className="mt-2 space-y-1">
            {ARA_AI_FILES.map((file) => (
              <li key={file.name} className="flex items-baseline gap-2">
                <a
                  href={`${ARA_AI_FILES_ORIGIN}/ara-ai/${file.name}`}
                  download
                  className="font-mono text-xs text-primary underline underline-offset-2"
                >
                  {file.name}
                </a>
                <span className="text-xs text-gray-500">{file.desc}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            <code className="rounded bg-gray-100 px-1 py-0.5">[OK] Auto start registered</code> 가 뜨면
            성공입니다. 크롬이 &lsquo;일반적으로 다운로드되지 않는 파일&rsquo;이라고 경고하면 <strong>유지</strong>를
            누르세요. 관리자 권한은 필요 없습니다.
          </p>
        </li>
      </ol>

      <p className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
        학원 관리 시스템에서 이미 설치했다면 다시 설치할 필요는 없지만,{' '}
        <strong>2026년 9월 이전에 받은 파일이라면 다시 내려받아야</strong> 합니다 — 예전 파일은 이
        사이트 주소를 모르기 때문에 연결을 거부합니다.
      </p>
    </div>
  );
}
