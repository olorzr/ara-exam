'use client';

import { useEffect, useRef, useState } from 'react';
import { SPINE_COLOR_PRESETS, SPINE_INK_AUTO, type BookSettings } from '@/lib/book';

/** 색 고르기 창을 움직이는 동안은 저장하지 않고, 이만큼 멈춘 뒤 한 번 저장한다 */
const COLOR_SAVE_DELAY_MS = 500;

/** 이 칸이 고치는 설정 — 책등 바탕색 / 책등 글자색 */
type ColorField = 'spineColor' | 'spineInk';

interface BookSpineColorFieldProps {
  settings: BookSettings;
  disabled: boolean;
  /**
   * 바꾼 칸만 보낸다 — 받는 쪽이 **마지막 설정 위에** 합쳐 저장한다(`BookCoverPanel.patchSettings`).
   * 설정 전체를 보내면 두 색 칸이 함께 저장을 미뤄 둔 채 화면을 떠날 때, 나중 칸이 같은 렌더의 옛 설정을 통째로 보내
   * 앞 칸의 색을 되돌린다(코덱스 2026-10-26 1R).
   */
  onPatch: (patch: Partial<BookSettings>) => void;
  /** 고치는 설정(기본 책등 바탕색) */
  field?: ColorField;
  /** 칸 이름(기본 '책등 색') */
  legend?: string;
  /** 바로 고르는 색(기본 책등 바탕색 열) */
  presets?: readonly { value: string; label: string }[];
  /**
   * '자동' 단추 — 주면 맨 앞에 그린다(글자색: 바탕과 대비가 큰 쪽). `preview` 는 자동일 때 실제로 찍히는 색이라
   * 동그라미와 직접 고르기 칸에 그 색을 보여 준다.
   */
  auto?: { label: string; preview: string };
}

/**
 * 책등 색 칸 — 바로 고르는 색과 직접 고르기. 바로 고르는 색은 그 자리에서 저장하고, 직접 고르기는 멈춘 뒤 한 번 저장한다.
 * 책등 바탕색(파스텔 여덟 + 진한 둘)과 책등 글자색(자동 + 여덟) 두 칸이 이 한 벌을 쓴다(2026-10-26 글자색 추가).
 */
export default function BookSpineColorField({
  settings: s, disabled, onPatch, field = 'spineColor', legend = '책등 색', presets = SPINE_COLOR_PRESETS, auto,
}: BookSpineColorFieldProps) {
  // 색 고르기 창은 끄는 동안 change 를 계속 낸다 — 그때마다 저장하지 않고 화면에만 두었다가 멈추면 한 번 저장한다
  const [draftColor, setDraftColor] = useState<string | null>(null);
  const saved = s[field];
  const shownColor = draftColor ?? saved;
  const isAuto = auto !== undefined && shownColor === SPINE_INK_AUTO;
  /** 아직 안 보낸 색 저장 — 기다리는 사이 화면을 떠나면 그 자리에서 보낸다(코덱스 2R) */
  const pendingRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (draftColor === null || draftColor === saved) {
      pendingRef.current = null;
      return;
    }
    // 보내면서 고른 색을 비운다 — 남겨 두면 저장이 실패해 설정이 되돌아갈 때마다 다시 보낸다(코덱스 1R).
    // 화면은 낙관적으로 얹힌 설정 색을 보여 주고, 실패하면 저장된 색으로 돌아간다
    const send = () => {
      pendingRef.current = null;
      setDraftColor(null);
      onPatch({ [field]: draftColor });
    };
    pendingRef.current = send;
    const timer = setTimeout(send, COLOR_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draftColor, saved, field, onPatch]);
  useEffect(() => {
    const pending = pendingRef;
    return () => pending.current?.();
  }, []);

  const pick = (value: string) => { setDraftColor(null); onPatch({ [field]: value }); };
  const swatch = (checked: boolean) => `h-7 w-7 rounded-full border ${checked ? 'ring-2 ring-primary ring-offset-2' : 'border-gray-300'}`;

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm text-gray-600">{legend}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {auto && (
          <button
            type="button" onClick={() => pick(SPINE_INK_AUTO)}
            aria-pressed={isAuto} aria-label={auto.label} title={auto.label}
            className={`${swatch(isAuto)} flex items-center justify-center text-[10px] font-semibold`}
            style={{ background: s.spineColor, color: auto.preview }}
          >
            가
          </button>
        )}
        {presets.map((c) => (
          <button
            key={c.value} type="button" onClick={() => pick(c.value)}
            aria-pressed={shownColor === c.value} aria-label={c.label} title={c.label}
            className={swatch(shownColor === c.value)}
            style={{ background: c.value }}
          />
        ))}
        <label className="flex items-center gap-1 text-xs text-gray-500">
          직접
          <input
            type="color" value={isAuto ? auto.preview : shownColor} aria-label={`${legend} 직접 고르기`}
            onChange={(e) => setDraftColor(e.target.value.toLowerCase())}
            className="h-7 w-10 cursor-pointer rounded border border-gray-300"
          />
        </label>
      </div>
    </fieldset>
  );
}
