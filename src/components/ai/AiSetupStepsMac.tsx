'use client';

import { DEFAULT_CODEX_PORT } from '@/lib/ai/localPort';
import { MAC_REMOVE_COMMAND, macInstallCommand } from '@/lib/ai/macInstaller';
import CopyCommand from './CopyCommand';

interface AiSetupStepsMacProps {
  /** 연결 포트. 기본값이 아니면 설치 명령에 --port 로 실린다 */
  port: number;
}

/**
 * 맥 설치 4단계. 마지막 단계가 **터미널 명령 한 줄**이다.
 *
 * 왜 파일 다운로드가 아닌가: 브라우저로 받은 `.command` 는 실행 권한이 없어 더블클릭이
 * 실패하고, 서명 없는 스크립트는 Gatekeeper 가 우클릭-열기로도 안 풀어 준다.
 * 어차피 2·3단계에서 터미널을 열어 붙여넣으므로 한 줄 더가 가장 짧은 길이다.
 *
 * ⚠️ 맥은 **Chrome 이 필요하다.** Safari(WebKit)는 https 문서에서 ws://127.0.0.1 을
 *   mixed content 로 막고, 허용으로 바꿀 설정이 없다(`src/lib/ai/setupOs.ts` 실측 주석).
 */
export default function AiSetupStepsMac({ port }: AiSetupStepsMacProps) {
  return (
    <>
      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <strong>맥에서는 Chrome으로 이 사이트를 열어 주세요.</strong> Safari는 사이트가 내 컴퓨터
        안의 프로그램에 연결하는 것을 막고, 허용으로 바꿀 설정이 없습니다. 설치는 아래대로 한 번만
        하시면 되고, Chrome을 쓰실 때만 동작합니다.
      </p>

      <ol className="mt-4 space-y-3 list-decimal list-inside">
        <li>
          <a
            href="https://nodejs.org"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            nodejs.org
          </a>
          에서 <strong>macOS Installer</strong> 를 내려받아 설치합니다.
        </li>

        <li>
          <strong>⌘ + 스페이스</strong> → <code className="rounded bg-gray-100 px-1 py-0.5">터미널</code> 을
          열고 아래를 실행합니다.
          <CopyCommand command="sudo npm install -g @openai/codex" />
          <p className="mt-2 text-xs text-gray-500">
            맥 로그인 비밀번호를 물으면 입력하세요. 치는 동안 글자가 안 보이는 것이 정상입니다.
            (Homebrew 로 Node 를 설치하셨다면 <code className="rounded bg-gray-100 px-1 py-0.5">sudo</code> 없이도 됩니다)
          </p>
        </li>

        <li>
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">codex login</code> 을
          실행하고 열린 브라우저에서 ChatGPT 에 로그인합니다.
        </li>

        <li>
          같은 터미널에 아래 한 줄을 붙여넣습니다.
          <CopyCommand command={macInstallCommand(port)} />
          <p className="mt-2 text-xs text-gray-500">
            <code className="rounded bg-gray-100 px-1 py-0.5">[완료] ARA AI 자동 시작이 등록되었습니다</code> 가
            뜨면 성공입니다. 맥 비밀번호는 묻지 않습니다.
            {port !== DEFAULT_CODEX_PORT && ' 바꾸신 포트가 위 명령에 이미 들어 있습니다.'}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            <strong>&lsquo;백그라운드 항목이 추가되었습니다&rsquo; 알림은 정상입니다 — 끄지 마세요.</strong>{' '}
            방화벽이 물으면 <strong>허용</strong>을 누르세요. 이 컴퓨터 안에서만 통신합니다.
            로그인할 때 배경에서 저절로 켜지므로 눌러서 켤 아이콘은 없습니다.
          </p>
        </li>
      </ol>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-gray-500">끄고 싶을 때</summary>
        <p className="mt-2 text-xs text-gray-500">
          자동 시작이 해제되고 설치 파일이 지워집니다. ChatGPT 로그인은 그대로 남습니다.
        </p>
        <CopyCommand command={MAC_REMOVE_COMMAND} />
      </details>
    </>
  );
}
