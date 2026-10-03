'use client';

import { X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { REFERENCE_UNITS_MAX } from '@/lib/reference-texts/constants';
import { unitKey, unitLabel } from '@/lib/reference-texts/units';
import type { ReferenceUnit } from '@/types/reference-text';
import UnitPickSheet from './UnitPickSheet';

interface ReferenceUnitsFieldProps {
  value: ReferenceUnit[];
  onChange: (units: ReferenceUnit[]) => void;
}

/**
 * 작품 전문의 **교과서 단원** 칸 — 붙은 단원 칩과 '단원 고르기' 단추.
 *
 * 단원은 여럿이다(같은 「봄봄」이 천재·비상 교과서에 다 실린다). 칩의 ✕ 로 하나씩 빼고,
 * 고르기 시트에서 붙이고 뗀다. 학교는 고르지 않는다(원장님 결정).
 * @param props - 붙은 단원과 바뀐 목록 콜백
 * @returns 단원 칸
 */
export default function ReferenceUnitsField({ value, onChange }: ReferenceUnitsFieldProps) {
  const remove = (unit: ReferenceUnit) => {
    const key = unitKey(unit);
    onChange(value.filter((u) => unitKey(u) !== key));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs text-gray-500">
          교과서 단원 <span className="text-gray-400">({value.length} / {REFERENCE_UNITS_MAX})</span>
        </Label>
        <UnitPickSheet value={value} onChange={onChange} />
      </div>

      {value.length === 0 ? (
        <p className="rounded border border-dashed border-gray-200 px-2 py-3 text-center text-xs text-gray-400">
          아직 붙인 단원이 없어요. 이 작품이 실린 교과서 단원을 고르면 목록에서 교과서별로 찾을 수 있어요.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((unit) => {
            const label = unitLabel(unit);
            return (
              <li
                key={unitKey(unit)}
                className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
              >
                {label}
                <button
                  type="button"
                  onClick={() => remove(unit)}
                  aria-label={`${label} 빼기`}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
