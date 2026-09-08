'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** 값과 보여 줄 글이 다른 선택지(예: 학교 id ↔ 학교 이름) */
export interface SelectOption {
  value: string;
  label: string;
}

interface LabeledSelectProps {
  label: string;
  value: string;
  options: readonly SelectOption[] | readonly string[];
  placeholder?: string;
  error?: string;
  /** 칸 아래에 붙일 안내 (시험범위 힌트 등) */
  hint?: React.ReactNode;
  onChange: (value: string) => void;
}

/** 문자열 목록도 그대로 받도록 맞춰 준다 */
function toOptions(options: readonly SelectOption[] | readonly string[]): SelectOption[] {
  return options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
}

/**
 * 라벨 + Select 한 칸.
 *
 * 출처 정보 폼에 같은 모양의 칸이 열 개 가까이 들어가서 한 곳으로 모았다.
 * `onValueChange` 가 `string | null` 을 주는 것(CLAUDE.md Known Issues)도 여기서 흡수한다.
 */
export default function LabeledSelect({
  label, value, options, placeholder, error, hint, onChange,
}: LabeledSelectProps) {
  const items = toOptions(options);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value}
        items={items}
        onValueChange={(v) => { if (v) onChange(v); }}
      >
        <SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {items.map((o) => (
            <SelectItem key={o.value} value={o.value} label={o.label}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint}
    </div>
  );
}
