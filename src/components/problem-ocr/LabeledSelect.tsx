'use client';

import { Label } from '@/components/ui/label';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';

export type { SelectOption };

interface LabeledSelectProps {
  label: string;
  value: string;
  options: readonly SelectOption[] | readonly string[];
  placeholder?: string;
  error?: string;
  /** 칸 아래에 붙일 안내 (시험범위 힌트 등) */
  hint?: React.ReactNode;
  /** 저장 중처럼 잠깐 못 고르게 할 때 */
  disabled?: boolean;
  onChange: (value: string) => void;
}

/**
 * 라벨 + Select 한 칸.
 *
 * 출처 정보 폼에 같은 모양의 칸이 열 개 가까이 들어가서 한 곳으로 모았다.
 * 고르는 칸 자체는 [OptionSelect](../ui/option-select.tsx) 가 그린다 — 값과 이름을
 * 한 배열에서 꺼내야 트리거에 이름이 나오기 때문이다(그 파일의 ⚠️ 주석 참고).
 */
export default function LabeledSelect({
  label, value, options, placeholder, error, hint, disabled, onChange,
}: LabeledSelectProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <OptionSelect
        value={value}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full"
        ariaLabel={label}
        onChange={onChange}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint}
    </div>
  );
}
