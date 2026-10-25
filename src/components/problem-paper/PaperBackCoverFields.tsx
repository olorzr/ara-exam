'use client';

import type { PaperBackCoverKind } from '@/lib/problem-paper/cover';
import { useObjectUrl } from '@/hooks/useObjectUrl';

interface PaperBackCoverFieldsProps {
  /** 지금 고른 뒷표지 종류(앞표지에 붙일 수 없는 값은 호출부가 이미 `none` 으로 맞춘 것) */
  value: PaperBackCoverKind;
  onChange: (kind: PaperBackCoverKind) => void;
  /** '앞표지와 같은 디자인' 을 내줄까 — 간단 표지일 때만(그림 앞표지에는 디자인이 없다) */
  allowDesign: boolean;
  /** 새로 고른 뒷표지 그림 */
  file: File | null;
  onFile: (file: File | null) => void;
  /** 이미 올려 둔 뒷표지 그림의 서명 URL — 새로 고르지 않았을 때 미리보기로 쓴다 */
  savedImageUrl?: string;
  disabled: boolean;
}

/**
 * 표지 창의 뒷표지 칸 — 없음 / 앞표지와 같은 디자인 / 그림 올리기(사용자 결정 2026-10-25).
 * 디자인 뒷표지는 학원 이름 · 저작권 안내 · 연도를 앞표지 디자인의 글꼴·꾸밈으로 찍는다(`BackCover`).
 */
export default function PaperBackCoverFields({
  value, onChange, allowDesign, file, onFile, savedImageUrl, disabled,
}: PaperBackCoverFieldsProps) {
  const fileUrl = useObjectUrl(file);
  const previewUrl = fileUrl ?? savedImageUrl;
  const choices: { value: PaperBackCoverKind; label: string }[] = [
    { value: 'none', label: '뒷표지 없음' },
    ...(allowDesign ? [{ value: 'design' as const, label: '앞표지와 같은 디자인' }] : []),
    { value: 'image', label: '뒷표지 그림 올리기' },
  ];

  return (
    <fieldset className="space-y-1.5 border-t border-gray-100 pt-3" disabled={disabled}>
      <legend className="text-sm text-gray-600">뒷표지 (선택)</legend>
      {choices.map((c) => (
        <label key={c.value} className="flex items-center gap-2 text-sm text-gray-800">
          <input
            type="radio" name="paper-cover-back-kind" value={c.value}
            checked={value === c.value}
            onChange={() => onChange(c.value)}
          />
          {c.label}
        </label>
      ))}
      {value === 'design' && (
        <p className="ml-6 text-xs text-gray-400">학원 이름 · 저작권 안내 · 연도를 앞표지 디자인으로 찍어요.</p>
      )}
      {value === 'image' && (
        <div className="ml-6 space-y-2">
          <label className="block space-y-1 text-sm">
            <span className="text-gray-600">뒷표지 그림</span>
            <input
              type="file" accept="image/*" className="block w-full text-sm"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl} alt="뒷표지 미리보기"
              className="mx-auto max-h-48 rounded border border-gray-200 object-contain"
            />
          )}
        </div>
      )}
    </fieldset>
  );
}
