import { describe, expect, it } from 'vitest';
import { ARA_AI_FILES_ORIGIN } from './constants';
import { DEFAULT_CODEX_PORT } from './localPort';
import { WIN_INSTALL_URL, WIN_INSTALLED_CMD, WIN_REMOVE_COMMAND, winPortCommand } from './winInstaller';

describe('WIN_INSTALL_URL', () => {
  it('설치 파일은 ara-system 이 호스팅한다', () => {
    // 여기서 다시 배포하면 선생님 PC 에 브릿지가 두 벌이 되어 포트를 두고 다툰다.
    expect(WIN_INSTALL_URL.startsWith(ARA_AI_FILES_ORIGIN)).toBe(true);
    expect(WIN_INSTALL_URL).toBe('https://www.araeducation.co.kr/ara-ai/ara-ai.cmd');
  });

  it('받는 파일은 하나다', () => {
    // 예전에는 세 개였고, 그래서 브릿지를 갱신할 길이 없었다.
    expect(WIN_INSTALL_URL.endsWith('.cmd')).toBe(true);
  });
});

describe('winPortCommand', () => {
  it('깔린 자리의 파일을 부른다', () => {
    // 다운로드 폴더는 선생님이 치우는 자리라, 거기를 안내하면 몇 주 뒤에 깨진다.
    expect(winPortCommand(8900)).toBe(`"${WIN_INSTALLED_CMD}" --port 8900`);
    expect(WIN_INSTALLED_CMD).toContain('%LOCALAPPDATA%');
  });

  it('인자를 생략하면 기본 포트로 본다', () => {
    expect(winPortCommand()).toBe(winPortCommand(DEFAULT_CODEX_PORT));
  });
});

describe('WIN_REMOVE_COMMAND', () => {
  it('끄는 명령도 같은 파일을 쓴다', () => {
    expect(WIN_REMOVE_COMMAND).toBe(`"${WIN_INSTALLED_CMD}" --remove`);
  });
});
