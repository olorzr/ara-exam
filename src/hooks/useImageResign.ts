'use client';

import { useCallback, useState } from 'react';
import { signProblemFile } from '@/lib/problem-bank/storage';

const EMPTY_URLS: ReadonlyMap<string, string> = new Map();
const EMPTY_SET: ReadonlySet<string> = new Set();

/** 집합에 더한 새 집합 */
function withItem(set: ReadonlySet<string>, item: string): ReadonlySet<string> {
  return set.has(item) ? set : new Set(set).add(item);
}

/** 집합에서 뺀 새 집합 */
function withoutItem(set: ReadonlySet<string>, item: string): ReadonlySet<string> {
  if (!set.has(item)) return set;
  const next = new Set(set);
  next.delete(item);
  return next;
}

/**
 * 깨진 그림 하나만 **다시 서명한다** — 읽기 전용 시험 보기의 원본 쪽 이미지.
 *
 * 서명 URL 은 한 시간이면 만료되는데 쪽 이미지는 지연 로딩이라, 탭을 연 채 오래 두었다가 아래로 내리면 만료된 주소로
 * 요청돼 깨진다(코덱스 2R). `useSignedImageUrls` 의 `missing` 은 서명 단계의 실패만 세므로 그 깨짐을 모른다.
 * 그래서 `<img onError>` 를 받아 **그 경로 하나만 한 번** 새로 서명해 갈아 끼우고(검수 화면 `reloadPageUrl` 과 같은 판단),
 * 그래도 깨지면 '못 불러옴' 으로 두어 화면이 '다시 불러오기' 를 내밀게 한다. 뜨면(`onLoad`) 기록을 지워 다음 만료에도 다시 돈다.
 * @param base - 처음 받은 서명 지도
 * @returns 경로의 지금 주소, 이벤트 처리, 손으로 다시 불러오기, 못 불러온 경로들, 다시 받는 중인 경로들
 */
export function useImageResign(base: ReadonlyMap<string, string>) {
  const [fresh, setFresh] = useState<ReadonlyMap<string, string>>(EMPTY_URLS);
  const [retried, setRetried] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [broken, setBroken] = useState<ReadonlySet<string>>(EMPTY_SET);

  const resign = useCallback(async (path: string) => {
    const url = await signProblemFile(path).catch(() => null);
    if (!url) {
      setBroken((prev) => withItem(prev, path));
      return;
    }
    setFresh((prev) => new Map(prev).set(path, url));
  }, []);

  const onError = useCallback((path: string) => {
    if (retried.has(path)) {
      setBroken((prev) => withItem(prev, path));
      return;
    }
    setRetried((prev) => withItem(prev, path));
    void resign(path);
  }, [retried, resign]);

  const onLoad = useCallback((path: string) => {
    setRetried((prev) => withoutItem(prev, path));
    setBroken((prev) => withoutItem(prev, path));
  }, []);

  const retry = useCallback((path: string) => {
    setBroken((prev) => withoutItem(prev, path));
    setRetried((prev) => withItem(prev, path));
    void resign(path);
  }, [resign]);

  return {
    urlOf: (path: string) => fresh.get(path) ?? base.get(path),
    onError,
    onLoad,
    retry,
    /** 다시 서명해도 못 불러온 경로 */
    broken,
    /** 다시 서명하는 중이거나 갈아 끼운 뒤 아직 안 뜬 경로 — 화면은 '불러오는 중' 으로 둔다 */
    pending: retried,
  };
}
