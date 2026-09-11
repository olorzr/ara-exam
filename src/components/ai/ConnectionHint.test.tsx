import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ConnectionHint from './ConnectionHint';
import type { HintKind } from '@/lib/ai/connectionStatusText';
import type { SetupOs } from '@/lib/ai/setupOs';

// 실제 렌더 결과를 본다 — 순수 함수만 검증하면 컴포넌트가 그 결과를 무시하거나
// 잘못 매핑해도 테스트가 통과한다.
function render(kind: HintKind, os: SetupOs = 'windows', showPromptNote = false) {
  return renderToStaticMarkup(<ConnectionHint kind={kind} os={os} showPromptNote={showPromptNote} />);
}

const NOT_RUNNING = 'ARA AI 가 실행되어 있지 않아요';
const SAFARI = 'Safari에서는 쓸 수 없어요';

describe('ConnectionHint — 원인마다 맞는 조치를 보여준다', () => {
  it('로그인이 안 됐으면 codex login 안내', () => {
    const html = render('login_required');
    expect(html).toContain('codex login');
    expect(html).toContain('명령 프롬프트');
  });

  it('브라우저가 막았으면 권한 복구 안내', () => {
    const html = render('browser_blocked');
    expect(html).toContain('로컬 네트워크');
    expect(html).not.toContain(NOT_RUNNING);
  });

  it('윈도우는 바탕화면 아이콘을 누르라고 한다', () => {
    const html = render('not_running', 'windows');
    expect(html).toContain('바탕화면');
  });

  // ⚠️ 옛 3파일 설치의 바로가기는 갱신을 하지 않는다. "알아서 최신이 된다" 고만 적으면
  // 그분들은 낡은 브릿지를 영원히 다시 켜게 된다 — 2026-09-11 장애가 길어진 이유다.
  it('옛 설치는 새 파일을 한 번 받으라고 먼저 말한다', () => {
    const html = render('not_running', 'windows');
    expect(html).toContain('새 설치 파일');
    expect(html).toContain('한 번만');

    const once = html.indexOf('한 번만');
    const auto = html.indexOf('켤 때마다 알아서 최신');
    expect(auto, '자동 갱신 문장이 없다').toBeGreaterThan(-1);
    expect(once, '자동 갱신을 먼저 말해 옛 설치가 그냥 넘어간다').toBeLessThan(auto);
  });
});

// 맥은 프로그램을 더블클릭하지 않는다 — LaunchAgent 가 로그인할 때 배경에서 띄운다.
describe('맥 — 윈도우와 조치가 다르다', () => {
  it('실행 안 됨: 바탕화면 아이콘 대신 자동 시작을 설명한다', () => {
    // 프로그램 이름(ARA AI)은 맥에서도 그대로다 — 없어야 하는 건 찾을 수 없는 물건이다.
    const html = render('not_running', 'mac');
    expect(html).not.toContain('바탕화면');
    expect(html).not.toContain('두 번 눌러');
    expect(html).toContain('배경에서 저절로 켜집니다');
    // 맥은 파일을 받지 않으므로 '새로 받기' 가 아니라 '명령 재실행' 이다.
    expect(html).not.toContain('새 설치 파일');
    expect(html).toContain('설치 명령을 다시 실행하면');
  });

  it('로그인 필요: codex login 을 치라고 하지 않는다', () => {
    // 설치 스크립트가 sudo 를 피하려고 codex 를 ~/.ara-ai/npm 에 깔기 때문에
    // 선생님 셸 PATH 에는 codex 가 없다 — 그대로 치면 command not found 다.
    const html = render('login_required', 'mac');
    expect(html).not.toContain('codex login');
    expect(html).not.toContain('명령 프롬프트');
    expect(html).toContain('터미널에 다시');
  });

  it('브라우저 차단 안내는 OS 와 무관하게 같다', () => {
    expect(render('browser_blocked', 'mac')).toBe(render('browser_blocked', 'windows'));
  });
});

// Safari 는 https 문서에서 ws://127.0.0.1 을 mixed content 로 막는다(2026-09-10 실측).
describe('Safari — 무엇을 해도 안 되므로 단독 안내', () => {
  it('Chrome 으로 바꾸라고만 말한다', () => {
    const html = render('browser_unsupported', 'mac');
    expect(html).toContain(SAFARI);
    expect(html).toContain('Chrome');
    // 켜라거나 로그인하라거나 권한을 바꾸라는 말이 함께 나오면 헤맨다.
    expect(html).not.toContain(NOT_RUNNING);
    expect(html).not.toContain('codex login');
    expect(html).not.toContain('로컬 네트워크');
  });

  it('설치를 다시 하라고 하지 않는다', () => {
    // 설치는 멀쩡하다 — 브라우저만 바꾸면 된다.
    expect(render('browser_unsupported', 'mac')).toContain('설치는 다시 하지 않아도 됩니다');
  });
});
