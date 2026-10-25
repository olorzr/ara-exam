'use client';

import { useEffect, useRef, useState } from 'react';
import { SPINE_COLOR_PRESETS, type BookSettings } from '@/lib/book';

/** 색 고르기 창을 움직이는 동안은 저장하지 않고, 이만큼 멈춘 뒤 한 번 저장한다 */
const COLOR_SAVE_DELAY_MS = 500;

interface BookSpineColorFieldProps {
  settings: BookSettings;
  disabled: boolean;
  onSettings: (settings: BookSettings) => void;
}

/**
 * 책등 색 — 바로 고르는 색 여섯과 직접 고르기. 바로 고르는 색은 그 자리에서 저장하고, 직접 고르기는 멈춘 뒤 한 번 저장한다.
 * (구성 화면의 책 설정에서 표지 만들기 화면으로 옮겨 왔다 — 동작은 그대로다.)
 */
export default function BookSpineColorField({ settings: s, disabled, onSettings }: BookSpineColorFieldProps) {
  // 색 고르기 창은 끄는 동안 change 를 계속 낸다 — 그때마다 저장하지 않고 화면에만 두었다가 멈추면 한 번 저장한다
  const [draftColor, setDraftColor] = useState<string | null>(null);
  const shownColor = draftColor ?? s.spineColor;
  /** 아직 안 보낸 색 저장 — 기다리는 사이 화면을 떠나면 그 자리에서 보낸다(코덱스 2R) */
  const pendingRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (draftColor === null || draftColor === s.spineColor) {
      pendingRef.current = null;
      return;
    }
    // 보내면서 고른 색을 비운다 — 남겨 두면 저장이 실패해 설정이 되돌아갈 때마다 다시 보낸다(코덱스 1R).
    // 화면은 낙관적으로 얹힌 설정 색을 보여 주고, 실패하면 저장된 색으로 돌아간다
    const send = () => {
      pendingRef.current = null;
      setDraftColor(null);
      onSettings({ ...s, spineColor: draftColor });
    };
    pendingRef.current = send;
    const timer = setTimeout(send, COLOR_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draftColor, s, onSettings]);
  useEffect(() => {
    const pending = pendingRef;
    return () => pending.current?.();
  }, []);

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm text-gray-600">책등 색</legend>
      <div className="flex flex-wrap items-center gap-2">
        {SPINE_COLOR_PRESETS.map((c) => (
          <button
            key={c.value} type="button"
            onClick={() => { setDraftColor(null); onSettings({ ...s, spineColor: c.value }); }}
            aria-pressed={shownColor === c.value} aria-label={c.label} title={c.label}
            className={`h-7 w-7 rounded-full border ${shownColor === c.value ? 'ring-2 ring-primary ring-offset-2' : 'border-gray-300'}`}
            style={{ background: c.value }}
          />
        ))}
        <label className="flex items-center gap-1 text-xs text-gray-500">
          직접
          <input
            type="color" value={shownColor} aria-label="책등 색 직접 고르기"
            onChange={(e) => setDraftColor(e.target.value.toLowerCase())}
            className="h-7 w-10 cursor-pointer rounded border border-gray-300"
          />
        </label>
      </div>
    </fieldset>
  );
}
