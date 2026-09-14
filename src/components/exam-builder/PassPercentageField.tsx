'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PERCENTAGE_BASE } from '@/lib/constants';
import { clampPassPercentage, passCountOf } from '@/lib/pass-count';

interface PassPercentageFieldProps {
  value: number;
  onChange: (value: number) => void;
  /** 마킹한 개념 단어 수 — 합격 개수 미리보기에 쓴다 */
  markCount: number;
}

/**
 * 개념지 합격 기준(%) 입력칸.
 *
 * 단어 시험지 생성 화면의 '합격 기준 (%)' 과 같은 규약이다 — 커트라인 미만이면 재시험이고,
 * 이 값이 학원 관리 시스템의 합격/불합격 판정 기준이 된다.
 * 옆에 실제 개수를 같이 보여 준다(80% 17문항 = 14개) — 퍼센트만으로는 몇 개인지 안 와닿는다.
 *
 * ⚠️ 입력값을 **칸에서 바로 정수로 정규화**한다. 소수(80.4)를 그대로 두면 미리보기·인쇄물은
 *    80.4% 로 개수를 세는데 저장은 80% 로 반올림돼(buildConceptSheetPayload) **인쇄물의
 *    '합격 N개' 와 성적의 합격 기준이 달라진다**. 화면에 보이는 값이 곧 저장되는 값이어야 한다.
 */
export default function PassPercentageField({ value, onChange, markCount }: PassPercentageFieldProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <Label htmlFor="concept-pass-percentage" className="text-xs text-gray-500 whitespace-nowrap">
        합격 기준
      </Label>
      <Input
        id="concept-pass-percentage"
        type="number"
        min={0}
        max={PERCENTAGE_BASE}
        value={value}
        onChange={(ev) => onChange(clampPassPercentage(ev.target.value, 0))}
        className="w-16 h-8 text-sm text-center"
      />
      <span className="text-xs text-gray-400 whitespace-nowrap">
        % {markCount > 0 ? `(${passCountOf(value, markCount)}개 이상)` : ''}
      </span>
    </div>
  );
}
