import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AiSetupStepsMac from './AiSetupStepsMac';
import { DEFAULT_CODEX_PORT } from '@/lib/ai/localPort';

const render = (port: number) => renderToStaticMarkup(<AiSetupStepsMac port={port} />);

describe('맥 설치 안내', () => {
  it('터미널 한 줄로 설치한다', () => {
    const html = render(DEFAULT_CODEX_PORT);
    expect(html).toContain('curl -fsSL https://www.araeducation.co.kr/ara-ai/install-mac.sh | bash');
    expect(html).toContain('sudo npm install -g @openai/codex');
    expect(html).toContain('codex login');
  });

  it('윈도우 어휘가 섞이지 않는다', () => {
    // 맥에는 시작 버튼도, 바탕화면 아이콘도, .cmd 파일도 없다.
    const html = render(DEFAULT_CODEX_PORT);
    for (const word of ['명령 프롬프트', '바탕화면', '.cmd', '더블클릭', '내려받고']) {
      expect(html, `맥 안내에 "${word}" 가 있다`).not.toContain(word);
    }
    expect(html).toContain('터미널');
  });

  it('Safari 로는 안 된다고 먼저 알린다', () => {
    // 이 줄이 없으면 Safari 선생님이 설치를 끝내고도 원인을 못 찾는다.
    const html = render(DEFAULT_CODEX_PORT);
    expect(html).toContain('Chrome');
    expect(html).toContain('Safari');
  });

  it('끄는 방법을 함께 준다', () => {
    expect(render(DEFAULT_CODEX_PORT)).toContain('--remove');
  });

  it('기본 포트면 --port 를 붙이지 않는다', () => {
    expect(render(DEFAULT_CODEX_PORT)).not.toContain('--port');
  });

  it('바꾼 포트가 설치 명령에 들어간다', () => {
    // 윈도우처럼 파일을 메모장으로 고치라고 하지 않는다 — 명령에 이미 들어 있다.
    expect(render(8900)).toContain('--port 8900');
  });
});

describe('설치 안내는 포트를 스스로 읽지 않는다', () => {
  it('AiSetupGuide 가 getCodexPort 를 부르지 않는다', () => {
    // 여기서 읽으면 같은 화면의 연결 카드에서 방금 바꾼 번호가 반영되지 않아,
    // 맥 설치 명령을 그대로 복사했을 때 브릿지가 옛 포트로 뜬다.
    // 저장된 포트는 페이지(settings/ai/page.tsx)가 들고 두 카드에 내려 준다.
    const guide = readFileSync(path.join(process.cwd(), 'src/components/ai/AiSetupGuide.tsx'), 'utf8');
    expect(guide).not.toContain('getCodexPort');
  });
});
