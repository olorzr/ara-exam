'use client';
// AI 기능 활성화 여부 훅
//
// 플래그는 서버 전용 env 라 클라이언트가 못 읽으므로 `/api/ai/status` 로 물어본다.
// 기본값은 **꺼짐** — 응답이 오기 전이나 실패했을 때 AI UI 가 잠깐이라도 보이면 안 된다.
//
// 원본: ara-system `app/lib/ai/useAiEnabled.ts`.

import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';

export interface AiEnabled {
  enabled: boolean;
  features: {
    problem_ocr: boolean;
  };
}

// ⚠️ features 타입에 기능을 추가하면 여기 OFF 에도 반드시 넣을 것.
//    빠뜨리면 런타임에 undefined 가 되어 '꺼짐'과 '아직 모름'이 뒤섞인다.
const OFF: AiEnabled = { enabled: false, features: { problem_ocr: false } };

/**
 * 서버에 AI 기능 활성 여부를 물어본다.
 * @returns 활성 상태 (조회 전·실패 시에는 전부 꺼짐)
 */
export function useAiEnabled(): AiEnabled {
  const [state, setState] = useState<AiEnabled>(OFF);

  useEffect(() => {
    let alive = true;
    authFetch('/api/ai/status')
      .then((res) => (res.ok ? res.json() : OFF))
      .then((json: AiEnabled) => {
        if (alive) setState(json?.enabled ? json : OFF);
      })
      .catch(() => {
        /* 실패하면 꺼진 상태를 유지한다 */
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
