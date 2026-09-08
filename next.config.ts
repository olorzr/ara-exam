import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

const scriptSrc = isProd
  ? "'self' 'unsafe-inline'"
  : "'self' 'unsafe-inline' 'unsafe-eval'";

const cspDirectives = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  // globals.css 가 cdn.jsdelivr.net 에서 Pretendard/GmarketSans 폰트 스타일시트를
  // @import 하고, 그 시트가 같은 CDN 의 woff2 폰트를 불러온다. self 만 허용하면
  // 프로덕션에서 폰트가 차단되므로 해당 CDN 을 style-src/font-src 에 추가한다.
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  // ws://127.0.0.1:* — 선생님 PC 의 코덱스 브릿지(기본 8899). 포트는 사용자가 바꿀 수 있어
  // (src/lib/ai/localPort.ts) 와일드카드로 둔다. 127.0.0.1 은 potentially trustworthy 라
  // https 문서에서도 mixed content 가 아니며, upgrade-insecure-requests 도 loopback 은
  // 면제한다(스펙). ⚠️ 프로덕션 배포 후 DevTools 로 실제 업그레이드 여부를 한 번 확인할 것 —
  // 만약 wss 로 올라가면 핸드셰이크가 조용히 실패하므로 그 지시어를 빼야 한다.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://auth.worksmobile.com https://www.worksapis.com ws://127.0.0.1:*",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isProd ? ['upgrade-insecure-requests'] : []),
];

const contentSecurityPolicy = cspDirectives.join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // 카테고리 관리가 단어 관리 하위에서 최상위 메뉴로 올라갔다. 북마크·옛 링크 보호용.
      // permanent:false — 브라우저가 영구 캐시하지 않게 해서 되돌릴 여지를 남긴다.
      { source: '/words/categories', destination: '/categories', permanent: false },
      // 기출 문제 은행의 대표 화면은 아카이브다. `/problems` 를 실제 페이지로 두면
      // isNavItemActive 가 세그먼트 접두사로 판정하므로 하위 메뉴와 함께 활성이 된다.
      { source: '/problems', destination: '/problems/archive', permanent: false },
    ];
  },
};

export default nextConfig;
