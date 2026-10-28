'use client';

import { useAuth } from '@/lib/auth-context';
import { isAdminEmail } from '@/lib/constants';

/** 원장 여부 — 화면에서 원장만 쓰는 단추를 가를 때 */
export interface OwnerAccess {
  /** 로그인 상태를 아직 읽는 중 */
  checking: boolean;
  /** 원장 계정인가 */
  isOwner: boolean;
}

/**
 * 지금 사용자가 원장인가 — **보내지 않는다**(`useDirectorGate` 와 다르다).
 *
 * 작품 전문 · 개념처럼 선생님도 읽는 화면에서 올리기·고치기·지우기만 원장에게 보일 때 쓴다.
 * 화면 판정은 보조다 — 권위는 DB 정책(sql/84 의 원장 이메일 RLS)이다.
 * @returns 원장 여부
 */
export function useOwnerAccess(): OwnerAccess {
  const { user, loading } = useAuth();
  return { checking: loading, isOwner: isAdminEmail(user?.email) };
}
