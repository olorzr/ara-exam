'use client';

import { useId } from 'react';
import { SPINE_FONTS, spineFontFamily, type BookSettings } from '@/lib/book';

/** 미리보기 글 상한 — 칸 폭(3열)에 한 줄로 들어오는 만큼 */
const SAMPLE_MAX = 8;

interface BookSpineFontFieldProps {
  settings: BookSettings;
  /** 책등에 찍힐 제목 — 칸마다 이 글을 그 글꼴로 보여 준다 */
  sample: string;
  disabled: boolean;
  onSettings: (settings: BookSettings) => void;
}

/**
 * 책등 제목 글꼴 고르기 — 글꼴마다 **책등 제목을 그 글꼴로** 보여 주는 라디오 칸(이름만으로는 고를 수 없다).
 * 고르면 그 자리에서 저장한다. 아래쪽 학원 이름은 고르지 않는다(학원 로고 글꼴 — 지마켓 산스로 고정).
 *
 * 단추는 진짜 라디오다 — 화살표 키 이동이 저절로 되고, 고른 칸은 색만이 아니라 라디오 동그라미로도 보인다
 * (표지 디자인 고르기 `CoverLayoutPicker` 와 같은 규약). 칸 안이 글줄 요소뿐이라 `<label>` 로 감싼다.
 */
export default function BookSpineFontField({ settings: s, sample, disabled, onSettings }: BookSpineFontFieldProps) {
  const name = useId();
  const text = [...(sample.trim() || '국어 문학')].slice(0, SAMPLE_MAX).join('');
  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-sm text-gray-600">책등 글꼴</legend>
      <div className="grid grid-cols-3 gap-1.5">
        {SPINE_FONTS.map((font) => {
          const checked = s.spineFont === font.id;
          return (
            <label
              key={font.id}
              className={`flex cursor-pointer flex-col gap-1 rounded-md border p-2 text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50 ${
                checked ? 'border-primary bg-primary/5 text-gray-900' : 'border-gray-200 text-gray-600'
              }`}
            >
              <span
                className="truncate text-base leading-tight text-gray-900" aria-hidden="true"
                style={{ fontFamily: spineFontFamily(font), fontWeight: font.weight, fontSize: `${font.sizeScale}rem` }}
              >
                {text}
              </span>
              <span className="flex items-center gap-1">
                {/* 이름은 글꼴 이름만 — 칸 안의 미리보기 글(aria-hidden)이 이름에 섞이지 않게 직접 준다 */}
                <input
                  type="radio" name={name} value={font.id} checked={checked} aria-label={font.label}
                  onChange={() => onSettings({ ...s, spineFont: font.id })}
                  className="h-3.5 w-3.5 accent-[color:var(--primary)]"
                />
                {font.label}
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-gray-400">아래쪽 학원 이름은 학원 로고 글꼴(지마켓 산스)로 늘 같아요.</p>
    </fieldset>
  );
}
