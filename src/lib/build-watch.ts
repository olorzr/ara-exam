import { DEV_BUILD_ID } from './build-id';

/** 지금 배포본을 묻는 곳 */
export const VERSION_ENDPOINT = '/api/version';
/** 탭을 보고 있는 동안 다시 묻는 간격 */
export const BUILD_POLL_MS = 10 * 60 * 1000;
/** 창을 오갈 때 다시 묻기까지의 최소 간격 — focus 는 창을 누를 때마다 온다 */
export const BUILD_RECHECK_GAP_MS = 60 * 1000;
/**
 * 이만큼 비운 탭으로 돌아올 때만 말없이 새로 고친다.
 * 몇 초짜리 저장이 그 탭에서 아직 돌고 있을 틈을 없앤다 — 쓰기마다 표시를 달아 막는 길은 빠뜨리는 곳이 남는다(코덱스 4R).
 */
export const BUILD_AWAY_MS = 3 * 60 * 1000;

const RELOADED_FOR_KEY = 'build-watch:reloaded-for';

/**
 * 말없이 새로 고쳐도 잃을 것이 없다고 확인한 화면 — 조건이 주소에 있거나 읽기만 하는 곳이다.
 *
 * ⚠️ 허용 목록이다. 거꾸로 '작업 표시가 없으면 새로 고친다' 로 하면 입력 보호가 없는 화면(단어 입력·시험 만들기 등)에서
 *    쓰던 글이 창을 오가는 것만으로 사라진다. 화면을 더할 때는 잃는 것이 없는지 보고, 있으면 `useWorkInProgress` 를 건다.
 * ⚠️ 문제지 조합(`/problems/papers/new`·`/books/papers/new`)은 넣지 않는다 — 담은 문항뿐 아니라 제목·인쇄 설정·고른 행·
 *    필터까지 주소에 없어 문항을 담기 전에도 잃는 것이 있다(코덱스 1R). 그 화면은 안내만 받는다.
 */
export const AUTO_RELOAD_PATHS: readonly string[] = ['/dashboard', '/problems/archive', '/problems/sources'];

/** 언제 물었는가 — 들어올 때 · 오래 비운 탭으로 돌아올 때 · 그 밖의 때 */
export type BuildCheckTrigger = 'mount' | 'return' | 'poll';

/** 물은 뒤 할 일 */
export type BuildAction = 'none' | 'reload' | 'notify';

/** 판단 재료 */
export interface BuildCheck {
  /** 이 탭의 빌드 */
  current: string;
  /** 서버가 답한 빌드 — 못 물었으면 null */
  latest: string | null;
  trigger: BuildCheckTrigger;
  /** 지금 주소 */
  pathname: string;
  /** 새로 고치면 사라질 것이 있는가 */
  busy: boolean;
  /** 이 빌드로 이미 새로 고쳤는가 */
  alreadyReloaded: boolean;
}

/**
 * 새 배포를 본 탭이 무엇을 할지 정한다.
 *
 * 보고 있는 동안 알게 된 것은 새로 고치지 않는다 — 쓰던 손을 끊지 않으려고 안내만 한다.
 * @param check - 판단 재료
 * @returns 할 일
 */
export function decideBuildAction(check: BuildCheck): BuildAction {
  const { current, latest } = check;
  if (latest === null || latest === DEV_BUILD_ID || latest === current) return 'none';
  const quiet = check.trigger !== 'poll' && !check.busy && !check.alreadyReloaded;
  return quiet && AUTO_RELOAD_PATHS.includes(check.pathname) ? 'reload' : 'notify';
}

function parseBuild(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('build' in body)) return null;
  return typeof body.build === 'string' && body.build ? body.build : null;
}

/**
 * 지금 배포본의 빌드를 묻는다. 쿠키가 필요 없는 곳이라 싣지 않는다.
 * @returns 빌드 값. 오프라인·서버 오류·이상한 답이면 null (다음에 다시 묻는다)
 */
export async function fetchLatestBuild(): Promise<string | null> {
  try {
    const res = await fetch(VERSION_ENDPOINT, { cache: 'no-store', credentials: 'omit' });
    return res.ok ? parseBuild(await res.json()) : null;
  } catch {
    return null;
  }
}

/**
 * 이 탭이 이 빌드로 이미 새로 고쳤는가 — 새로 고쳐도 옛 문서가 오면 끝없이 돌지 않게 본다.
 * @param build - 서버가 답한 빌드
 * @returns 이미 새로 고쳤으면 true
 */
export function alreadyReloadedFor(build: string): boolean {
  try {
    return window.sessionStorage.getItem(RELOADED_FOR_KEY) === build;
  } catch {
    return false;
  }
}

/**
 * 이 빌드로 새로 고친다고 적어 둔다.
 * @param build - 서버가 답한 빌드
 * @returns 적었으면 true. 저장소가 막혔으면 false — 되돌이를 못 막으니 새로 고치지 말 것
 */
export function rememberReloadFor(build: string): boolean {
  try {
    window.sessionStorage.setItem(RELOADED_FOR_KEY, build);
    return window.sessionStorage.getItem(RELOADED_FOR_KEY) === build;
  } catch {
    return false;
  }
}

/** 문서를 새로 받는다 — 테스트가 갈아 끼우는 자리다 */
export function reloadPage(): void {
  window.location.reload();
}
