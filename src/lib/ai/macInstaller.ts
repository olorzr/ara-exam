// 맥 설치 명령 조립 — 화면에 그대로 붙여 넣을 한 줄.
//
// 스크립트 본체(`install-mac.sh`)는 **ara-system 이 호스팅한다**. 브릿지와 같은 이유다 —
// 선생님 PC 에는 한 벌만 깔리고, 여기서 다시 배포하면 포트 8899 를 두고 프로세스가 다툰다.

import { ARA_AI_FILES_ORIGIN } from './constants';
import { DEFAULT_CODEX_PORT } from './localPort';

/** 설치 스크립트 주소 (ara-system 프로덕션 고정). */
export const MAC_INSTALL_URL = `${ARA_AI_FILES_ORIGIN}/ara-ai/install-mac.sh`;

/**
 * 설치 명령 한 줄. 기본 포트가 아니면 스크립트에 그 번호를 넘긴다
 * (윈도우에서 start-codex.cmd 를 메모장으로 고치던 단계를 대신한다).
 *
 * @param port - 연결 포트. 기본값이면 옵션 없이 짧은 명령을 준다
 */
export function macInstallCommand(port: number = DEFAULT_CODEX_PORT): string {
  const base = `curl -fsSL ${MAC_INSTALL_URL} | bash`;
  return port === DEFAULT_CODEX_PORT ? base : `${base} -s -- --port ${port}`;
}

/** 자동 시작 해제 + 설치 파일 삭제. codex 와 ChatGPT 로그인은 남는다. */
export const MAC_REMOVE_COMMAND = `curl -fsSL ${MAC_INSTALL_URL} | bash -s -- --remove`;
