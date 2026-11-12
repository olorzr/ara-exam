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
 *
 * ⚠️ 경쟁을 막는 두 규칙(코덱스 3R — '다시 불러오기' 를 누르자 만료된 이미지가 다시 붙고, 그 오류가 새 주소보다 먼저 와
 *    정상 주소를 받은 뒤에도 '못 불러옴' 으로 남았다):
 *    ① 서명하는 동안(`signing`)은 그 쪽 이미지를 **그리지 않는다** — 화면은 '불러오는 중' 이다.
 *    ② 오류는 **그 이미지의 주소**와 함께 받고, 지금 주소가 아니면 버린다(옛 시도의 오류가 새 시도를 실패로 만들지 않게).
 *       화면은 `<img key={url}>` 로 주소마다 새 요소를 붙인다.
 * @param base - 처음 받은 서명 지도
 * @returns 경로의 지금 주소·그려도 되는가, 이벤트 처리, 손으로 다시 불러오기, 못 불러온 경로들, 서명 중인 경로들
 */
export function useImageResign(base: ReadonlyMap<string, string>) {
  const [fresh, setFresh] = useState<ReadonlyMap<string, string>>(EMPTY_URLS);
  /** 마지막으로 뜬 뒤 자동으로 한 번 다시 서명한 경로 — 또 깨지면 '못 불러옴' */
  const [autoTried, setAutoTried] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [signing, setSigning] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [broken, setBroken] = useState<ReadonlySet<string>>(EMPTY_SET);

  const urlOf = (path: string) => fresh.get(path) ?? base.get(path);

  const resign = useCallback(async (path: string) => {
    setSigning((prev) => withItem(prev, path));
    setBroken((prev) => withoutItem(prev, path));
    const url = await signProblemFile(path).catch(() => null);
    if (url) setFresh((prev) => new Map(prev).set(path, url));
    else setBroken((prev) => withItem(prev, path));
    setSigning((prev) => withoutItem(prev, path));
  }, []);

  const onError = useCallback((path: string, failedUrl: string) => {
    // 서명 중이거나 옛 주소에서 온 오류는 버린다 — 지금 시도와 무관하다
    if (signing.has(path) || failedUrl !== (fresh.get(path) ?? base.get(path))) return;
    if (autoTried.has(path)) {
      setBroken((prev) => withItem(prev, path));
      return;
    }
    setAutoTried((prev) => withItem(prev, path));
    void resign(path);
  }, [signing, fresh, base, autoTried, resign]);

  const onLoad = useCallback((path: string) => {
    setAutoTried((prev) => withoutItem(prev, path));
    setBroken((prev) => withoutItem(prev, path));
  }, []);

  const retry = useCallback((path: string) => {
    if (signing.has(path)) return;
    void resign(path);
  }, [signing, resign]);

  return {
    urlOf,
    /** 이미지를 붙여도 되는가 — 주소가 있고, 서명 중도 못 불러옴도 아닐 때 */
    showable: (path: string) => Boolean(urlOf(path)) && !signing.has(path) && !broken.has(path),
    onError,
    onLoad,
    retry,
    /** 다시 서명해도 못 불러온 경로 */
    broken,
    /** 다시 서명하는 중인 경로 — 화면은 '불러오는 중' 으로 둔다 */
    signing,
  };
}
