// 선생님 컴퓨터 환경 감지 — 어떤 설치 안내를 보여줄지, 이 브라우저로 쓸 수 있는지.
//
// ⚠️ 원본은 ara-system `app/lib/ai/setupOs.ts` 다. 브릿지·설치 스크립트를 그쪽이
//    호스팅하므로 판정도 같은 규칙이어야 한다 — 한쪽만 고치면 두 화면의 안내가 갈린다.

/** 설치 안내의 갈래. 윈도우가 기본값 — 대부분의 선생님이 윈도우를 쓴다. */
export type SetupOs = 'windows' | 'mac';

/** 브라우저 갈래. 연결 가능 여부가 갈리는 축만 구분한다. */
export type BrowserKind = 'safari' | 'other';

/**
 * 어느 OS 안내를 기본으로 펼칠지.
 *
 * ⚠️ 감지는 **기본 탭을 고르는 것일 뿐**이다 — 화면에는 항상 윈도우·맥 전환이 있어야 한다.
 * 선생님이 다른 컴퓨터에 깔아 주려고 이 화면을 여는 경우가 실제로 있다.
 *
 * @param ua - 테스트 주입용. 생략하면 navigator.userAgent (SSR 이면 빈 문자열)
 */
export function detectSetupOs(ua: string = defaultUserAgent()): SetupOs {
  return /Macintosh|Mac OS X/i.test(ua) ? 'mac' : 'windows';
}

/**
 * Safari 인지.
 *
 * ⚠️ **Safari 로는 이 기능을 쓸 수 없다.** WebKit 은 https 문서에서 `ws://127.0.0.1` 을
 *   mixed content 로 **동기 차단**한다(2026-09-10 실측: 프로덕션 페이지에서 0ms 만에 onerror,
 *   같은 주소가 http 문서에서는 열리고 `wss://` 는 차단 지점을 통과한다).
 *   127.0.0.1 을 potentially trustworthy 로 보아 예외를 주는 것은 **Chromium 뿐**이다 —
 *   `codex/README.md`·`localNetworkAccess.ts` 의 "mixed content 가 아니다" 주석은 Chrome 기준이다.
 *   권한을 허용해도, 브릿지를 켜도 풀리지 않으므로 다른 어떤 안내보다 먼저 나와야 한다.
 *
 * 판별에서 Chrome·Edge·Firefox 를 빼는 이유: 이들 UA 에도 `Safari/` 가 들어 있다.
 * (Edge 는 `Edg/`, iOS 크롬은 `CriOS/`, iOS 파이어폭스는 `FxiOS/` 로만 구분된다)
 *
 * @param ua - 테스트 주입용. 생략하면 navigator.userAgent
 */
export function detectBrowser(ua: string = defaultUserAgent()): BrowserKind {
  if (!/Safari\//.test(ua)) return 'other';
  if (/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua)) return 'other';
  return 'safari';
}

/** SSR 에서도 던지지 않게 감싼 navigator.userAgent. */
function defaultUserAgent(): string {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent || '';
}
