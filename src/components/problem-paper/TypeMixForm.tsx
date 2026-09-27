'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PAPER_MAX_ITEMS } from '@/lib/problem-paper/bulk-add';
import {
  clampInt, countUnaddedByKind, planTypeMix, shortfallMessage,
  TYPE_MIX_DEFAULT_OBJECTIVE_PERCENT, TYPE_MIX_DEFAULT_TOTAL, TYPE_MIX_PRESETS,
  type TypeMixRow,
} from '@/lib/problem-paper/type-mix';

interface TypeMixFormProps {
  /** 조건에 걸린 문항의 가벼운 풀 */
  rows: readonly TypeMixRow[];
  /** 이미 담긴 문항 id */
  added: ReadonlySet<string>;
  busy: boolean;
  onConfirm: (request: { total: number; objectivePercent: number }) => void;
  onCancel: () => void;
}

/**
 * 비율 담기 폼 — **순수 화면**이다(조회도 저장도 하지 않는다).
 *
 * ⚠️ 고른 값을 state 로 두되 **계산은 전부 렌더에서 파생**한다(효과 안 setState 금지 규약).
 *    부르는 쪽이 `key={session}` 으로 다시 마운트하므로 창을 열 때마다 기본값으로 돌아간다 —
 *    지난번 값을 기억하지 않는다(사용자 결정: 시험마다 비율이 다르다).
 */
export default function TypeMixForm({
  rows, added, busy, onConfirm, onCancel,
}: TypeMixFormProps) {
  const available = countUnaddedByKind(rows, added);
  const room = Math.max(0, PAPER_MAX_ITEMS - added.size);
  /** 실제로 담을 수 있는 최대 — 남은 자리와 풀에 남은 문항 가운데 작은 쪽 */
  const maxTotal = Math.min(room, available.objective + available.subjective);

  const [totalText, setTotalText] = useState(
    () => String(Math.min(TYPE_MIX_DEFAULT_TOTAL, Math.max(1, maxTotal))),
  );
  const [percentText, setPercentText] = useState(String(TYPE_MIX_DEFAULT_OBJECTIVE_PERCENT));

  const total = clampInt(Number(totalText), 0, maxTotal);
  const percent = clampInt(Number(percentText), 0, 100);
  const plan = planTypeMix(total, percent, available);
  const takeTotal = plan.take.objective + plan.take.subjective;
  const shortfall = shortfallMessage(plan);

  if (maxTotal <= 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {room <= 0
            ? `문제지가 가득 찼어요 (한 장은 ${PAPER_MAX_ITEMS}문항까지).`
            : '이 조건의 문항이 모두 담겨 있어요. 왼쪽에서 다른 폴더를 골라 주세요.'}
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>닫기</Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && takeTotal > 0) onConfirm({ total, objectivePercent: percent });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="type-mix-total">문항 수</Label>
        <Input
          id="type-mix-total" type="number" inputMode="numeric"
          min={1} max={maxTotal} value={totalText}
          onChange={(e) => setTotalText(e.target.value)}
        />
        <p className="text-xs text-gray-500">
          최대 {maxTotal}문항 · 남은 문항 객관식 {available.objective} · 주관식 {available.subjective}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="type-mix-percent">객관식 비율</Label>
        {/* 프리셋은 네이티브 button 이라 키보드로 그대로 쓸 수 있다 */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="객관식 비율 고르기">
          {TYPE_MIX_PRESETS.map((preset) => (
            <Button
              key={preset.percent} type="button" size="sm"
              variant={percent === preset.percent ? 'default' : 'outline'}
              aria-pressed={percent === preset.percent}
              onClick={() => setPercentText(String(preset.percent))}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            id="type-mix-percent" type="number" inputMode="numeric"
            min={0} max={100} className="w-24" value={percentText}
            onChange={(e) => setPercentText(e.target.value)}
          />
          <span className="text-sm text-gray-500">% 가 객관식</span>
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
        <p className="font-medium text-gray-900">
          객관식 {plan.take.objective} · 주관식 {plan.take.subjective}
        </p>
        {shortfall && <p className="mt-1 text-xs text-amber-700">{shortfall}</p>}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {/* 담는 중에도 눌린다 — 창 오른쪽 위 X 와 같은 길이고, 그것이 곧 취소다 */}
        <Button type="button" variant="outline" onClick={onCancel}>취소</Button>
        <Button type="submit" disabled={busy || takeTotal === 0}>
          {busy ? '담는 중…' : `${takeTotal}문항 담기`}
        </Button>
      </div>
    </form>
  );
}
