'use client';

import { Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { numberPrintQaItems } from '@/lib/print-qa';
import type { PrintQaItem } from '@/types/print-scan';
import PrintQaItemRow from './PrintQaItemRow';

/**
 * 나눠 놓은 문답 목록 — 고르고, 고치고, 모범답안을 만든다.
 *
 * ⚠️ 번호는 `numberPrintQaItems` **한 곳**에서 매긴다. 목록이 따로 세면 화면의 번호와
 *    인쇄물의 번호가 달라져, 선생님이 "3번을 고쳤다" 고 한 것이 다른 문항이 된다.
 */

interface PrintQaListProps {
  items: PrintQaItem[];
  /** 모범답안을 만들 대상으로 골라 둔 문항 id 들 */
  picked: ReadonlySet<string>;
  /** 저장하지 않은 수정이 있는가 */
  dirty: boolean;
  saving: boolean;
  /** AI 나 저장이 도는 중 — 편집을 잠근다 */
  disabled: boolean;
  /** 지금 모범답안을 만들 수 없는 까닭 (없으면 null) */
  generateBlocker: string | null;
  onPick: (id: string, picked: boolean) => void;
  onApproveLead: (id: string, approved: boolean) => void;
  onPickDefault: () => void;
  onPickNone: () => void;
  onQuestion: (id: string, value: string) => void;
  onAnswer: (id: string, value: string) => void;
  onRemove: (id: string) => void;
  onGenerate: () => void;
  onSave: () => void;
}

/**
 * 문답 목록을 그린다.
 * @param props - 문항·고름 상태와 수정·생성·저장 콜백
 * @returns 목록 (문항이 없으면 아무것도 그리지 않는다)
 */
export default function PrintQaList({
  items, picked, dirty, saving, disabled, generateBlocker,
  onPick, onApproveLead, onPickDefault, onPickNone,
  onQuestion, onAnswer, onRemove, onGenerate, onSave,
}: PrintQaListProps) {
  // ⚠️ **비었다고 통째로 숨기지 않는다**(코덱스 리뷰). 마지막 문항을 지우면 목록이 비는데
  //    그 삭제는 아직 저장 전이다 — 숨기면 저장 단추까지 사라져 되돌릴 길이 없다
  if (items.length === 0 && !dirty) return null;
  const numbered = numberPrintQaItems(items);

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-gray-600">
            {items.length === 0
              ? '문항을 모두 지웠어요 — 저장하면 반영됩니다.'
              : <>고른 문항 <b className="text-gray-900">{picked.size}</b> / {items.length}</>}
          </span>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onPickDefault}>
            답 없는 것만 고르기
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onPickNone}>
            고름 해제
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            className="bg-primary text-white hover:bg-primary-hover"
            disabled={disabled || items.length === 0 || picked.size === 0 || generateBlocker !== null}
            title={generateBlocker ?? undefined}
            onClick={onGenerate}
          >
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            모범답안 만들기 ({picked.size})
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            // AI 가 도는 동안에는 저장도 막는다 — 끝나면 그쪽이 저장한다.
            // 열어 두면 늦게 도착한 저장이 **AI 결과를 옛 문항으로 덮는다**(코덱스 리뷰)
            disabled={disabled || !dirty || saving}
            onClick={onSave}
          >
            <Save className="mr-1 h-3.5 w-3.5" />
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>

      {/* 못 만드는 까닭을 단추 옆이 아니라 **글로도** 보여 준다 — 잠긴 단추만 보면 왜인지 모른다 */}
      {generateBlocker && <p className="text-xs text-amber-700">{generateBlocker}</p>}
      {dirty && (
        <p className="text-xs text-amber-700">
          고친 내용이 아직 저장되지 않았어요. 인쇄 전에 저장해 주세요.
        </p>
      )}

      <ol className="divide-y divide-gray-100">
        {numbered.map(({ item, number }) => (
          <PrintQaItemRow
            key={item.id}
            item={item}
            number={number}
            picked={picked.has(item.id)}
            disabled={disabled}
            onPick={(next) => onPick(item.id, next)}
            onApproveLead={(next) => onApproveLead(item.id, next)}
            onQuestion={(value) => onQuestion(item.id, value)}
            onAnswer={(value) => onAnswer(item.id, value)}
            onRemove={() => onRemove(item.id)}
          />
        ))}
      </ol>
    </section>
  );
}
