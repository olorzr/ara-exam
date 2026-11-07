import { useEffect, useLayoutEffect } from 'react';

/** SSR 에서는 useLayoutEffect 경고가 나므로 useEffect 로 대체 */
export const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
