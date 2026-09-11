'use client';

import { DEFAULT_CODEX_PORT } from '@/lib/ai/localPort';
import { WIN_INSTALL_URL, WIN_REMOVE_COMMAND, winPortCommand } from '@/lib/ai/winInstaller';
import CopyCommand from './CopyCommand';

interface AiSetupStepsWindowsProps {
  /** 연결 포트. 기본값이 아니면 재설치 명령에 --port 로 실린다 */
  port: number;
}

/**
 * 윈도우 설치 — 선생님이 하는 일은 **두 가지**뿐이다.
 *   1단계: Node.js 설치 (nodejs.org 설치 프로그램 더블클릭)
 *   2단계: 파일 하나 내려받아 더블클릭 (codex 설치 + ChatGPT 로그인 + 자동 시작을 전부 한다)
 *
 * 예전에는 4단계였다(Node → npm 으로 codex → codex login → 파일 3개 받아 더블클릭).
 * 합친 이유가 둘이다:
 *   ① 붙여넣기·다운로드 횟수가 곧 실패 지점이다(맥을 2단계로 줄인 것과 같은 판단).
 *   ② **파일 3개 방식에는 브릿지를 갱신할 길이 없었다.** 받아 둔 bridge.cjs 를 영원히
 *      그대로 실행해서, 2026-09-11 에 이 앱 주소가 바뀌었을 때 윈도우 선생님은 아무리
 *      기다려도 고쳐지지 않았다. 이제 설치가 만드는 런처가 켤 때마다 최신을 받는다.
 *
 * ⚠️ 설치 파일은 **ara-system 이 호스팅한다** — 여기서 다시 배포하면 포트 8899 를 두고
 *   프로세스 둘이 다툰다. 이 컴포넌트는 링크·명령 문자열만 만든다.
 */
export default function AiSetupStepsWindows({ port }: AiSetupStepsWindowsProps) {
  return (
    <>
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
          에서 <strong>Windows Installer</strong> 를 내려받아 <strong>더블클릭</strong>으로 설치합니다.
          이미 있으면 넘어가세요.
        </li>

        <li>
          아래 파일 <strong>하나</strong>를 내려받아 <strong>더블클릭</strong>합니다.{' '}
          <strong>나머지는 알아서 진행됩니다.</strong>
          <p className="mt-2">
            <a
              href={WIN_INSTALL_URL}
              download
              className="inline-block rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-white no-underline"
            >
              ⬇ ARA AI 설치 파일 (ara-ai.cmd)
            </a>
          </p>
          <p className="mt-2 text-xs text-gray-500">
            검은 창이 뜨고 <strong>Codex 설치</strong>가 시작됩니다(처음에는 1~2분쯤 걸립니다).
            이어서 <strong>ChatGPT 로그인 창</strong>이 열리니 본인 계정으로 로그인해 주세요.
            학원 사이트가 아니라 <strong>OpenAI 공식 화면</strong>이며, 로그인 정보는 내 컴퓨터에만
            저장됩니다.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            <code className="rounded bg-gray-100 px-1 py-0.5">[완료] ARA AI 자동 시작이 등록되었습니다</code> 가
            뜨면 성공입니다. 관리자 권한은 필요 없습니다.
          </p>
          <p className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-600">
            <strong>중간에 뜨는 경고는 눌러서 넘기시면 됩니다.</strong> 내려받을 때 브라우저가
            &lsquo;일반적으로 다운로드되지 않는 파일&rsquo;이라고 하면 <strong>유지</strong>,
            더블클릭할 때 &lsquo;열린 파일 &ndash; 보안 경고&rsquo;가 뜨면 <strong>실행</strong>,
            파란 &lsquo;Windows의 PC 보호&rsquo; 화면이 뜨면 <strong>추가 정보 → 실행</strong>을 누르세요.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            설치가 끝나면 바탕화면에 <strong>ARA AI</strong> 아이콘이 생깁니다. 문제가 생기면 그
            아이콘을 더블클릭하세요 &mdash; <strong>켤 때마다 스스로 최신으로 갱신됩니다.</strong>
          </p>
          {port !== DEFAULT_CODEX_PORT && (
            <>
              <p className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-600">
                <strong>연결 포트를 {port}로 바꾸셨습니다.</strong> 설치가 끝난 뒤{' '}
                <strong>명령 프롬프트</strong>(시작 버튼 → <code>cmd</code>)에 아래를 붙여넣어 같은
                번호로 다시 설치해 주세요. 두 곳이 같아야 연결됩니다.
              </p>
              <CopyCommand command={winPortCommand(port)} />
            </>
          )}
        </li>
      </ol>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-gray-500">끄고 싶을 때</summary>
        <p className="mt-2 text-xs text-gray-500">
          <strong>명령 프롬프트</strong>에 아래를 붙여넣으면 자동 시작이 해제되고 설치 파일이
          지워집니다. ChatGPT 로그인은 그대로 남습니다.
        </p>
        <CopyCommand command={WIN_REMOVE_COMMAND} />
      </details>
    </>
  );
}
