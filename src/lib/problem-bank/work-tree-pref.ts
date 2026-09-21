'use client';

import {
  DEFAULT_WORK_TREE_ORDER, isWorkTreeOrder, type WorkTreeOrder,
} from './work-tree';

/**
 * 작품 트리 정렬 선택 (브라우저 전용).
 *
 * 탭을 닫아도 남아야 하므로 localStorage 를 쓴다(`lib/ai/localPort.ts` 와 같은 규약).
 * 정렬 방식은 학생 데이터가 아니라 **보는 방법**이라 공용 PC 에 남아도 위험하지 않다.
 *
 * ⚠️ **주소(필터)에 싣지 않는다.** 필터는 '무엇을 보는가' 라 링크로 주고받아야 하지만,
 *    정렬은 '어떻게 보는가' 라 사람마다 다르다 — 주소에 실으면 받은 사람의 취향까지 바꾼다.
 */

const KEY = 'ara-work-tree-order';

/**
 * 저장된 정렬을 읽는다.
 * @returns 저장값 (없거나 모르는 값이면 기본 정렬)
 */
export function readWorkTreeOrder(): WorkTreeOrder {
  if (typeof window === 'undefined') return DEFAULT_WORK_TREE_ORDER;
  try {
    const raw = window.localStorage.getItem(KEY) ?? '';
    return isWorkTreeOrder(raw) ? raw : DEFAULT_WORK_TREE_ORDER;
  } catch {
    // 시크릿 모드 등에서 localStorage 접근이 막힐 수 있다.
    return DEFAULT_WORK_TREE_ORDER;
  }
}

/**
 * 정렬을 저장한다. 모르는 값은 무시한다.
 * @param order - 저장할 정렬
 */
export function writeWorkTreeOrder(order: WorkTreeOrder): void {
  if (typeof window === 'undefined') return;
  if (!isWorkTreeOrder(order)) return;
  try {
    window.localStorage.setItem(KEY, order);
  } catch {
    // 저장에 실패해도 이번 세션 동안은 고른 대로 보이므로 조용히 넘어간다.
  }
}
