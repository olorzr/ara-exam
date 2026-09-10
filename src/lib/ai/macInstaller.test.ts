import { describe, expect, it } from 'vitest';
import { ARA_AI_FILES_ORIGIN } from './constants';
import { DEFAULT_CODEX_PORT } from './localPort';
import { MAC_INSTALL_URL, MAC_REMOVE_COMMAND, macInstallCommand } from './macInstaller';

describe('macInstallCommand', () => {
  it('기본 포트면 옵션 없이 짧은 명령을 준다', () => {
    expect(macInstallCommand(DEFAULT_CODEX_PORT)).toBe(`curl -fsSL ${MAC_INSTALL_URL} | bash`);
  });

  it('포트를 바꾼 선생님에게는 그 번호가 명령에 들어간다', () => {
    // 윈도우에서 start-codex.cmd 를 메모장으로 고치던 단계를 대신한다.
    expect(macInstallCommand(8900)).toBe(`curl -fsSL ${MAC_INSTALL_URL} | bash -s -- --port 8900`);
  });

  it('인자를 생략하면 기본 포트로 본다', () => {
    expect(macInstallCommand()).toBe(macInstallCommand(DEFAULT_CODEX_PORT));
  });
});

describe('MAC_INSTALL_URL', () => {
  it('설치 스크립트는 ara-system 이 호스팅한다', () => {
    // 여기서 다시 배포하면 선생님 PC 에 브릿지가 두 벌이 되어 포트를 두고 다툰다.
    expect(MAC_INSTALL_URL.startsWith(ARA_AI_FILES_ORIGIN)).toBe(true);
    expect(MAC_INSTALL_URL).toBe('https://www.araeducation.co.kr/ara-ai/install-mac.sh');
  });

  it('끄는 명령도 같은 스크립트를 쓴다', () => {
    expect(MAC_REMOVE_COMMAND.startsWith(`curl -fsSL ${MAC_INSTALL_URL}`)).toBe(true);
    expect(MAC_REMOVE_COMMAND).toContain('--remove');
  });
});
