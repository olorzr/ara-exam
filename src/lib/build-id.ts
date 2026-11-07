/** 배포본이 아닌 곳(개발 서버·테스트)의 빌드 값 — 이 값이면 새 배포를 살피지 않는다 */
export const DEV_BUILD_ID = 'dev';

/**
 * 이 번들이 지어진 배포.
 *
 * `next.config.ts` 의 `env` 가 빌드 때 글자로 박는다 — 브라우저 번들과 서버 번들이 같은 값을 갖고, 그래서
 * 열어 둔 탭의 이 값과 `/api/version` 의 답이 다르면 그 탭은 옛 코드다.
 * ⚠️ `process.env.NEXT_PUBLIC_BUILD_ID` 를 글자 그대로 쓸 것 — 변수에 담아 읽으면 치환되지 않는다.
 */
export const BUILD_ID: string = process.env.NEXT_PUBLIC_BUILD_ID || DEV_BUILD_ID;
