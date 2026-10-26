'use client';

import { useId } from 'react';
import {
  SPINE_FONT_GROUP_LABELS, SPINE_FONT_GROUPS, SPINE_FONTS, spineFontFamily, type BookSettings, type SpineFont,
} from '@/lib/book';

/** 미리보기 글 상한 — 칸 폭(3열)에 한 줄로 들어오는 만큼 */
const SAMPLE_MAX = 8;

interface BookSpineFontFieldProps {
  settings: BookSettings;
  /** 책등에 찍힐 제목 — 칸마다 이 글을 그 글꼴로 보여 준다 */
  sample: string;
  /** 책등 글자색(`resolveSpineInk`) — 미리보기를 책등 색 바탕에 이 색으로 그린다 */
  ink: string;
  disabled: boolean;
  onSettings: (settings: BookSettings) => void;
}

/**
 * 책등 제목 글꼴 고르기 — 묶음(고딕·제목 / 귀여운 / 손글씨 / 명조)마다 글꼴 칸을 두고, 칸마다 **책등 제목을 그 글꼴로**
 * 지금 책등 색 · 글자 색 그대로 보여 준다(이름만으로는 고를 수 없다). 고르면 그 자리에서 저장한다.
 * 아래쪽 학원 이름은 고르지 않는다(학원 로고 글꼴 — 지마켓 산스로 고정).
 *
 * 단추는 진짜 라디오다 — 화살표 키 이동이 저절로 되고, 고른 칸은 색만이 아니라 라디오 동그라미로도 보인다
 * (표지 디자인 고르기 `CoverLayoutPicker` 와 같은 규약). 칸 안이 글줄 요소뿐이라 `<label>` 로 감싼다.
 * ⚠️ 미리보기가 글꼴마다 파일을 받는다(눈누 글꼴은 조각 없이 통째 — 수백 KB~3MB). 이 칸은 원장 전용 표지 화면에만 있다.
 */
export default function BookSpineFontField({ settings: s, sample, ink, disabled, onSettings }: BookSpineFontFieldProps) {
  const name = useId();
  const text = [...(sample.trim() || '국어 문학')].slice(0, SAMPLE_MAX).join('');
  const tile = (font: SpineFont) => {
    const checked = s.spineFont === font.id;
    return (
      <label
        key={font.id}
        className={`flex cursor-pointer flex-col gap-1 rounded-md border p-1.5 text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50 ${
          checked ? 'border-primary bg-primary/5 text-gray-900' : 'border-gray-200 text-gray-600'
        }`}
      >
        <span
          className="truncate rounded-sm px-1.5 py-1 leading-tight" aria-hidden="true"
          style={{
            fontFamily: spineFontFamily(font), fontWeight: font.weight, fontSize: `${font.sizeScale}rem`,
            background: s.spineColor, color: ink,
          }}
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
          <span className="truncate">{font.label}</span>
        </span>
      </label>
    );
  };

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm text-gray-600">책등 글꼴</legend>
      {SPINE_FONT_GROUPS.map((group) => (
        <div key={group} className="space-y-1">
          <div className="text-xs font-medium text-gray-500">{SPINE_FONT_GROUP_LABELS[group]}</div>
          <div className="grid grid-cols-3 gap-1.5">
            {SPINE_FONTS.filter((f) => f.group === group).map(tile)}
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-400">
        아래쪽 학원 이름은 학원 로고 글꼴(지마켓 산스)로 늘 같아요. 눈누 글꼴은 인쇄·웹 사용이 허락된 상업용 무료 글꼴만 넣었어요.
      </p>
    </fieldset>
  );
}
