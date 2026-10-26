'use client';

import { useEffect, useState } from 'react';
import { COVER_FONTS_TIMEOUT_MS } from '@/lib/problem-paper/cover-fonts';

/** 글꼴 지정을 한 글자로 이을 때 쓰는 구분자 — 지정 안에 나오지 않는 글자 */
const SPEC_SEPARATOR = '\n';

type FontLoader = Pick<FontFaceSet, 'load'>;

function fontLoader(): FontLoader | null {
  if (typeof document === 'undefined') return null;
  const fonts: FontFaceSet | undefined = document.fonts;
  return fonts && typeof fonts.load === 'function' ? fonts : null;
}

/**
 * 웹 글꼴 조각을 미리 받았는가 — 인쇄 단추를 그동안 잠그는 데 쓴다.
 *
 * 한글 웹 글꼴은 조각(unicode-range)이 백 개가 넘어 **그 글자가 처음 그려질 때** 조각을 받는다. 받기 전에 인쇄하면
 * 그 글자만 대체 글꼴로 찍히므로 `document.fonts.load(지정, 찍을 글자)` 로 미리 받는다.
 * ⚠️ **fail-open** 이다 — 받기가 실패하거나 시간 상한을 넘으면 그냥 연다(모양만 바뀌고 내용은 그대로 나간다).
 * Cmd/Ctrl+P 는 이 잠금을 건너뛴다 — 같은 이유로 받아들였다.
 * 지정 배열은 렌더마다 새 배열이어도 된다(글자로 이어 견준다).
 * @param specs - `document.fonts.load` 의 첫 인자들(`'700 1em "Gmarket Sans"'` 꼴)
 * @param sample - 찍힐 글자 전부 — 이 글자가 든 조각만 받는다
 * @param enabled - 기다릴 것이 있는가(없으면 늘 true)
 * @returns 받았으면(또는 기다릴 것이 없으면) true
 */
export function useFontsReady(specs: readonly string[], sample: string, enabled: boolean): boolean {
  const specKey = specs.join(SPEC_SEPARATOR);
  /** 무엇을 다 받았는가 — 준비 여부는 여기서 파생한다(효과 안 동기 setState 금지 규약) */
  const [done, setDone] = useState<string | null>(null);
  const want = `${specKey}${SPEC_SEPARATOR}${SPEC_SEPARATOR}${sample}`;

  useEffect(() => {
    const loader = enabled ? fontLoader() : null;
    if (!loader) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => { timer = setTimeout(resolve, COVER_FONTS_TIMEOUT_MS); });
    // load 가 동기로 던지는 경우(글꼴 지정이 틀렸다)도 실패 하나로 받는다
    const loads = Promise.allSettled(
      specKey.split(SPEC_SEPARATOR).filter(Boolean)
        .map((spec) => Promise.resolve().then(() => loader.load(spec, sample))),
    );
    void Promise.race([loads, timeout]).then(() => {
      if (alive) setDone(want);
    });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [enabled, specKey, sample, want]);

  if (!enabled || !fontLoader()) return true;
  return done === want;
}
