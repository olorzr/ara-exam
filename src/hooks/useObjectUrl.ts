'use client';

import { useEffect, useMemo } from 'react';

/**
 * 고른 파일의 미리보기 주소 — 파일이 바뀌거나 화면을 떠나면 주소를 돌려준다(메모리 새는 것을 막는다).
 * @param file - 고른 파일 (없으면 null)
 * @returns `blob:` 주소. 파일이 없거나 이 환경에 `URL.createObjectURL` 이 없으면 null
 */
export function useObjectUrl(file: File | null): string | null {
  const url = useMemo(
    () => (file && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}
