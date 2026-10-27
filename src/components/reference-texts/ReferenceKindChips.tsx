'use client';

import { REFERENCE_KINDS } from '@/lib/reference-texts/constants';
import type { ReferenceTextKind } from '@/types/reference-text';

interface ReferenceKindChipsProps {
  /** 지금 고른 종류 — 없으면 둘 다 */
  value: ReferenceTextKind | undefined;
  onChange: (next: ReferenceTextKind | undefined) => void;
}

/** 칩 하나 — 값이 없으면 '전체' */
const CHOICES: readonly { label: string; value: ReferenceTextKind | undefined }[] = [
  { label: '전체', value: undefined },
  ...REFERENCE_KINDS.map((kind) => ({ label: kind, value: kind })),
];

/**
 * 작품 / 개념 칩 — 목록을 종류로 거른다(왼쪽 축·검색어와 함께 걸린다).
 * 눌린 칩은 `aria-pressed` 로 알린다(색만으로 알리지 않는다).
 * @param props - 지금 값과 바꾸는 콜백
 * @returns 칩 묶음
 */
export default function ReferenceKindChips({ value, onChange }: ReferenceKindChipsProps) {
  return (
    <div className="flex gap-1" role="group" aria-label="종류">
      {CHOICES.map((choice) => {
        const pressed = choice.value === value;
        return (
          <button
            key={choice.label}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(choice.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${pressed
              ? 'border-primary bg-primary text-white'
              : 'border-gray-200 bg-white text-gray-600 hover:border-primary/50'}`}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
