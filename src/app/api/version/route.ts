import { NextResponse } from 'next/server';
import { BUILD_ID } from '@/lib/build-id';

/** 빌드 때 값을 굳히지 않고 부를 때마다 지금 배포본이 답한다 */
export const dynamic = 'force-dynamic';

/**
 * 지금 배포본의 빌드 값 — 열어 둔 탭이 자기가 옛 코드인지 묻는 곳(`useBuildWatch`).
 *
 * 비밀이 아니라 로그인을 요구하지 않는다. ⚠️ 캐시되면 옛 탭이 끝내 모르므로 `no-store` 를 뺄 것 없다.
 * @returns `{ build }`
 */
export function GET(): NextResponse {
  return NextResponse.json({ build: BUILD_ID }, { headers: { 'Cache-Control': 'no-store' } });
}
