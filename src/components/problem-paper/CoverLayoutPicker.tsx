'use client';

import { useId } from 'react';
import {
  COVER_LAYOUT_LABELS, COVER_LAYOUTS, type PaperCoverLayout,
} from '@/lib/problem-paper/cover';
import { toCoverLayoutProps } from '@/lib/problem-paper/cover-text';
import { A4_HEIGHT_PX, A4_WIDTH_PX } from '@/lib/print/constants';
import { COVER_LAYOUT_COMPONENTS } from './covers';

/** 고르기 칸의 작은 표지 배율 — A4 낱장(794px)이 111px 폭이 된다(창 폭에 세 칸) */
export const COVER_THUMB_SCALE = 0.14;

interface CoverLayoutPickerProps {
  value: PaperCoverLayout;
  onChange: (layout: PaperCoverLayout) => void;
  /** 작은 표지에 넣을 지금 입력값 — 치는 대로 바뀐다 */
  preview: { title: string; subtitle: string; showNameBox: boolean; year: string };
  disabled?: boolean;
}

/**
 * 간단 표지의 디자인 고르기 — 디자인마다 **실제 표지를 줄여** 보여 준다(이름만으로는 고를 수 없다).
 *
 * 단추는 진짜 라디오다 — 화살표 키 이동·탭 한 번에 묶음 하나가 저절로 되고, 고른 칸은 색만이 아니라
 * 라디오 동그라미로도 보인다.
 * 작은 표지는 꾸밈이라 `aria-hidden` 이고 이름은 아래 글자가 맡는다.
 * ⚠️ 칸을 `<label>` 로 감싸지 않는다 — 작은 표지 안에 `h1`·`div` 가 있어 `label`(글줄 요소만 담는다)에
 *    넣으면 틀린 HTML 이다. 대신 이름표의 `::after` 가 칸 전체를 덮어 어디를 눌러도 고른다.
 */
export default function CoverLayoutPicker({ value, onChange, preview, disabled }: CoverLayoutPickerProps) {
  const props = toCoverLayoutProps(preview);
  const idBase = useId();
  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-sm text-gray-600">디자인</legend>
      <div className="grid grid-cols-3 gap-2">
        {COVER_LAYOUTS.map((layout) => {
          const Layout = COVER_LAYOUT_COMPONENTS[layout];
          const checked = value === layout;
          const id = `${idBase}-${layout}`;
          return (
            <div
              key={layout}
              className={`relative flex flex-col items-center gap-1 rounded-md border p-1.5 text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50 ${
                checked ? 'border-primary bg-primary/5 text-gray-900' : 'border-gray-200 text-gray-600'
              }`}
            >

              <div
                className="relative overflow-hidden rounded-sm border border-gray-200 bg-white"
                style={{ width: A4_WIDTH_PX * COVER_THUMB_SCALE, height: A4_HEIGHT_PX * COVER_THUMB_SCALE }}
                aria-hidden="true"
              >
                <div
                  className="absolute left-0 top-0 flex flex-col"
                  style={{
                    width: A4_WIDTH_PX, height: A4_HEIGHT_PX,
                    transform: `scale(${COVER_THUMB_SCALE})`, transformOrigin: 'top left',
                  }}
                >
                  <Layout {...props} />
                </div>
              </div>
              <span className="flex items-center gap-1">
                {/* 고른 칸을 색으로만 알리지 않는다 — 동그라미가 차는 진짜 라디오가 보인다(코덱스 6R) */}
                <input
                  id={id} type="radio" name="paper-cover-layout" value={layout}
                  className="h-3.5 w-3.5 accent-[color:var(--primary)]"
                  checked={checked} onChange={() => onChange(layout)}
                />
                <label htmlFor={id} className="cursor-pointer after:absolute after:inset-0">
                  {COVER_LAYOUT_LABELS[layout]}
                </label>
              </span>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
