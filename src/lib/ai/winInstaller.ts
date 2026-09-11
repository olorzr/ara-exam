// 윈도우 설치 안내가 쓰는 주소·명령 — 화면에 그대로 붙는 문자열.
//
// 파일 본체(`ara-ai.cmd`)는 **ara-system 이 호스팅한다.** 브릿지와 같은 이유다 —
// 선생님 PC 에는 한 벌만 깔리고, 여기서 다시 배포하면 포트 8899 를 두고 프로세스가 다툰다.
// 이 앱은 `macInstaller.ts` 처럼 **문자열만** 만든다.

import { ARA_AI_FILES_ORIGIN } from './constants';
import { DEFAULT_CODEX_PORT } from './localPort';

/** 설치 파일 주소 (ara-system 프로덕션 고정). */
export const WIN_INSTALL_URL = `${ARA_AI_FILES_ORIGIN}/ara-ai/ara-ai.cmd`;

/**
 * 설치가 끝난 뒤 그 파일이 놓이는 자리.
 *
 * ⚠️ 포트 변경·제거 명령은 **받은 폴더가 아니라 여기**를 가리켜야 한다.
 *    다운로드 폴더는 선생님이 치우는 자리라, 거기를 안내하면 몇 주 뒤에 깨진다.
 */
export const WIN_INSTALLED_CMD = '%LOCALAPPDATA%\\ara-ai\\ara-ai.cmd';

/**
 * 포트를 바꿔 다시 설치하는 명령.
 * 예전에는 `start-codex.cmd` 를 메모장으로 열어 고치게 했는데, 그 파일은 이제 없다.
 *
 * @param port - 연결 포트
 */
export function winPortCommand(port: number = DEFAULT_CODEX_PORT): string {
  return `"${WIN_INSTALLED_CMD}" --port ${port}`;
}

/** 자동 시작 해제 + 설치 파일 삭제. codex 와 ChatGPT 로그인은 남는다. */
export const WIN_REMOVE_COMMAND = `"${WIN_INSTALLED_CMD}" --remove`;
