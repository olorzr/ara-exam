'use client';

import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_COVER_LAYOUT, type PaperCover } from '@/lib/problem-paper/cover';
import {
  COVER_FONT_SPECS, COVER_FONTS_TIMEOUT_MS, coverFontSample, type CoverFontContext,
} from '@/lib/problem-paper/cover-fonts';

type FontLoader = Pick<FontFaceSet, 'load'>;

function fontLoader(): FontLoader | null {
  if (typeof document === 'undefined') return null;
  const fonts: FontFaceSet | undefined = document.fonts;
  return fonts && typeof fonts.load === 'function' ? fonts : null;
}

/**
 * 디자인 표지의 글꼴 조각을 미리 받았는가.
 *
 * 한글 글꼴은 글자가 처음 그려질 때 그 조각을 받는다. 받기 전에 인쇄하면 표지만 대체 글꼴로 찍히므로
 * 그동안 인쇄 단추를 잠근다. ⚠️ **fail-open** 이다 — 받기가 실패하거나 시간 상한을 넘으면 그냥 연다
 * (모양만 바뀌고 내용은 그대로 나간다. 그림 표지가 빠져 첫 장이 비는 것과 다르다). Cmd/Ctrl+P 는 이
 * 잠금을 건너뛴다 — 그때도 같은 이유로 받아들였다.
 * 기다리는 것은 디자인 표지·디자인 뒷표지뿐이다 — 표지가 없거나 간단(basic)·그림 표지에 디자인 뒷표지도 없으면
 * 기다릴 글꼴이 없다. 간단 앞표지라도 디자인 뒷표지를 붙였으면 그 뒷표지가 디자인 글꼴을 쓴다.
 * @param cover - 표지 (없으면 null)
 * @param context - 문제지 제목 · 만든 해 · 선생님 이름
 * @returns 받았으면(또는 기다릴 것이 없으면) true
 */
export function useCoverFontsReady(cover: PaperCover | null, context: CoverFontContext): boolean {
  const enabled = cover?.kind === 'simple'
    && (cover.layout !== DEFAULT_COVER_LAYOUT || cover.backKind === 'design');
  const { paperTitle, year, teacher } = context;
  // 표지에 찍힐 글자 — 이 글자가 든 조각만 받는다(같은 표지면 같은 문자열이라 다시 받지 않는다)
  const sample = useMemo(
    () => (cover && enabled ? coverFontSample(cover, { paperTitle, year, teacher }) : ''),
    [cover, enabled, paperTitle, year, teacher],
  );
  /** 어느 글자 묶음을 다 받았는가 — 준비 여부는 여기서 파생한다(효과 안 동기 setState 금지 규약) */
  const [doneSample, setDoneSample] = useState<string | null>(null);

  useEffect(() => {
    const loader = enabled ? fontLoader() : null;
    if (!loader) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => { timer = setTimeout(resolve, COVER_FONTS_TIMEOUT_MS); });
    // load 가 동기로 던지는 경우(글꼴 지정이 틀렸다)도 실패 하나로 받는다
    const loads = Promise.allSettled(
      COVER_FONT_SPECS.map((spec) => Promise.resolve().then(() => loader.load(spec, sample))),
    );
    void Promise.race([loads, timeout]).then(() => {
      if (alive) setDoneSample(sample);
    });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [enabled, sample]);

  if (!enabled || !fontLoader()) return true;
  return doneSample === sample;
}
