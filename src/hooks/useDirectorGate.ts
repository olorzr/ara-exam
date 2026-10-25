'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { isAdminEmail } from '@/lib/constants';

/** 원장 전용 화면의 문지기 상태 */
export interface DirectorGate {
  /** 로그인 상태를 아직 읽는 중 */
  checking: boolean;
  /** 원장 계정인가 */
  allowed: boolean;
}

/**
 * 원장 전용 화면 — 원장이 아니면 대시보드로 보낸다(감사 로그 화면과 같은 규약).
 *
 * 화면 게이트는 보조다 — 권위는 DB 정책(sql/76 의 원장 이메일 RLS)이다. 주소를 직접 쳐서 들어와도 표가 0행이다.
 * @returns 문지기 상태 — `checking` 이거나 `allowed` 가 아니면 화면은 스피너만 그린다
 */
export function useDirectorGate(): DirectorGate {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = isAdminEmail(user?.email);

  useEffect(() => {
    if (!loading && !allowed) router.replace('/dashboard');
  }, [loading, allowed, router]);

  return { checking: loading, allowed };
}
