import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AiSetupStepsWindows from './AiSetupStepsWindows';
import { DEFAULT_CODEX_PORT } from '@/lib/ai/localPort';

const render = (port: number) => renderToStaticMarkup(<AiSetupStepsWindows port={port} />);

describe('윈도우 설치 안내', () => {
  it('파일 하나만 받게 한다', () => {
    const html = render(DEFAULT_CODEX_PORT);
    expect(html).toContain('/ara-ai/ara-ai.cmd');
    // 옛 3파일 방식의 잔재가 남으면 선생님이 없는 파일을 찾는다.
    for (const gone of ['install-autostart.cmd', 'start-codex.cmd', '/ara-ai/bridge.cjs']) {
      expect(html, `옛 파일 "${gone}" 안내가 남아 있다`).not.toContain(gone);
    }
  });

  it('선생님이 손으로 하는 것은 설치 하나뿐이다', () => {
    // 예전 4단계(npm 설치·codex login)를 다시 꺼내지 말 것 — 파일이 대신 한다.
    const html = render(DEFAULT_CODEX_PORT);
    expect(html).not.toContain('npm install');
    expect(html).not.toContain('codex login');
  });

  it('중간에 ChatGPT 로그인 창이 뜬다고 미리 알린다', () => {
    // 예고 없이 브라우저가 열리면 선생님이 무엇을 하는 창인지 모른다.
    const html = render(DEFAULT_CODEX_PORT);
    expect(html).toContain('ChatGPT 로그인 창');
    expect(html).toContain('OpenAI 공식 화면');
  });

  it('뜰 수 있는 보안 경고 세 가지를 미리 알린다', () => {
    // 이걸 안 적으면 "일반적으로 다운로드되지 않는 파일" 에서 선생님이 멈춘다.
    const html = render(DEFAULT_CODEX_PORT);
    expect(html).toContain('유지');
    expect(html).toContain('보안 경고');
    expect(html).toContain('추가 정보');
  });

  it('켤 때마다 스스로 갱신된다고 알린다', () => {
    expect(render(DEFAULT_CODEX_PORT)).toContain('켤 때마다 스스로 최신');
  });

  it('맥 어휘가 섞이지 않는다', () => {
    const html = render(DEFAULT_CODEX_PORT);
    for (const word of ['curl', '터미널', 'sudo', 'launchctl']) {
      expect(html, `윈도우 안내에 "${word}" 가 있다`).not.toContain(word);
    }
    expect(html).toContain('바탕화면');
  });

  it('기본 포트면 --port 를 붙이지 않는다', () => {
    expect(render(DEFAULT_CODEX_PORT)).not.toContain('--port');
  });

  it('바꾼 포트가 재설치 명령에 들어간다', () => {
    // 메모장으로 start-codex.cmd 를 고치던 단계가 사라졌다.
    const html = render(8900);
    expect(html).toContain('--port 8900');
    expect(html).not.toContain('메모장');
  });

  it('끄는 방법을 함께 준다', () => {
    expect(render(DEFAULT_CODEX_PORT)).toContain('--remove');
  });
});
