// AI 기능 활성화 여부 조회 — 화면이 AI UI 를 그릴지 판단하는 용도.
//
// 플래그는 서버 전용 env 라 클라이언트가 직접 못 읽는다.
// **연결 상태·사용량은 여기서 다루지 않는다** — 그건 브라우저가 선생님 PC 의 codex 에
// 직접 물어본다(서버는 AI 를 호출하지 않는다).

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/require-session';
import { isAiOcrEnabled, isFeatureEnabled } from '@/lib/ai/flags';

/** 꺼진 상태 응답 — 마스터가 꺼져 있으면 "없는 기능"처럼 보이게 한다. */
const OFF = { enabled: false, features: { problem_ocr: false } } as const;

/**
 * GET /api/ai/status
 * @returns `{ enabled, features: { problem_ocr } }` (로그인 안 됐으면 401)
 */
export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session.ok) return session.response;

  if (!isAiOcrEnabled()) return NextResponse.json(OFF);

  return NextResponse.json({
    enabled: true,
    features: { problem_ocr: isFeatureEnabled('problem_ocr') },
  });
}
