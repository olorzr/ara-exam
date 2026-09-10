'use client';

import { ARA_AI_FILES, ARA_AI_FILES_ORIGIN } from '@/lib/ai/constants';
import CopyCommand from './CopyCommand';

const INSTALL_COMMAND = 'npm install -g @openai/codex';

/**
 * 윈도우 설치 4단계. 마지막 단계가 **파일 3개 내려받기 + 더블클릭**이다.
 *
 * 설치 파일은 **학원 관리 시스템(ara-system)이 호스팅한다** — 선생님 PC 에는 브릿지가
 * 한 벌만 있으면 되고(두 앱이 공유), 여기서 또 배포하면 같은 포트를 두고 다투게 된다.
 */
export default function AiSetupStepsWindows() {
  return (
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
        <CopyCommand command={INSTALL_COMMAND} />
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
  );
}
