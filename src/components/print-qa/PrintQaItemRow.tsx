'use client';

import { Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { answerLineCount } from '@/lib/print-qa';
import type { PrintQaItem, PrintQaAnswerSource } from '@/types/print-scan';

/**
 * 문답 한 줄 — 여기서 물음과 답을 바로 고친다.
 *
 * ⚠️ **답이 어디서 왔는지를 늘 보여 준다.** 선생님이 인쇄해 둔 답과 학생이 연필로 적은 답,
 *    AI 가 지은 답은 믿을 만한 정도가 전혀 다른데, 화면에서 같아 보이면 확인할 곳을 알 수 없다.
 * ⚠️ 근거는 **고치지 않는다.** 자료에서 글자 그대로 옮겨 온 것이라 손대면 대조를 통과한
 *    근거인지 알 수 없어진다(`QuizItemRow` 와 같은 규약).
 */

/** 답 출처별 칩 — 색만으로 알리지 않는다(글자를 함께 둔다) */
const SOURCE_CHIP: Record<PrintQaAnswerSource, { label: string; className: string } | null> = {
  printed: { label: '프린트에 적힌 답', className: 'bg-emerald-100 text-emerald-800' },
  handwritten: { label: '학생 손글씨', className: 'bg-amber-100 text-amber-900' },
  ai: { label: 'AI 모범답안', className: 'bg-sky-100 text-sky-800' },
  teacher: { label: '직접 쓴 답', className: 'bg-violet-100 text-violet-800' },
  none: { label: '답 없음', className: 'bg-gray-100 text-gray-600' },
};

interface PrintQaItemRowProps {
  item: PrintQaItem;
  /** 인쇄되는 번호 — 프린트에 찍혀 있던 그 번호다 */
  number: string;
  /** 모범답안을 만들 대상으로 골라 뒀는가 */
  picked: boolean;
  disabled: boolean;
  onPick: (picked: boolean) => void;
  onApproveLead: (approved: boolean) => void;
  onQuestion: (value: string) => void;
  onAnswer: (value: string) => void;
  onRemove: () => void;
}

/**
 * 문답 한 줄을 그린다.
 * @param props - 문항·번호·고름 여부와 수정·삭제 콜백
 * @returns 목록의 한 줄
 */
export default function PrintQaItemRow({
  item, number, picked, disabled, onPick, onApproveLead, onQuestion, onAnswer, onRemove,
}: PrintQaItemRowProps) {
  const chip = SOURCE_CHIP[item.answerSource];

  return (
    <li className="flex gap-2 py-3">
      <div className="flex w-14 shrink-0 flex-col items-center gap-1.5">
        <span className="text-sm font-bold text-primary">{number}</span>
        <Checkbox
          checked={picked}
          disabled={disabled}
          aria-label={`${number}번 모범답안 대상`}
          onCheckedChange={(next) => onPick(next === true)}
        />
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        {/*
          물음 앞에 있던 글 — 길 수 있어 접어 둔다.
          ⚠️ **학생 문제지에는 확인해야 실린다.** 이 글이 지문인지 아직 안 옮긴 답인지는
             기계가 못 가린다(열 번의 리뷰 결론) — 사람이 보고 한 번 누르게 한다.
        */}
        {item.lead.trim() !== '' && (
          <div className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
            <label className="flex items-center gap-1.5 text-xs text-gray-700">
              <Checkbox
                checked={item.leadApproved}
                disabled={disabled}
                aria-label={`${number}번 앞글을 문제지에 싣기`}
                onCheckedChange={(next) => onApproveLead(next === true)}
              />
              <span>
                앞에 있던 글을 <b>문제지에도 싣기</b>
                <span className="ml-1 text-gray-400">({item.lead.length}자)</span>
              </span>
            </label>
            <details className="mt-1 text-xs text-gray-500">
              <summary className="cursor-pointer">글 보기</summary>
              <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-white px-2 py-1 text-gray-600">
                {item.lead}
              </p>
            </details>
            {!item.leadApproved && (
              <p className="mt-1 text-[11px] text-amber-700">
                지문이면 켜 주세요. 켜기 전에는 <b>교사용에만</b> 보입니다 — 못 옮긴 답이
                섞여 있을 수 있어 학생 문제지에는 바로 싣지 않아요.
              </p>
            )}
          </div>
        )}

        <Textarea
          value={item.question}
          rows={2}
          disabled={disabled}
          aria-label={`${number}번 물음`}
          onChange={(e) => onQuestion(e.target.value)}
        />

        <div className="flex flex-wrap items-center gap-1.5">
          {chip && (
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${chip.className}`}>
              {chip.label}
            </span>
          )}
          {/* 원문과 글자가 다른 물음 — 옮겨 적다 바뀌었을 수 있다(문항은 그대로 둔다) */}
          {!item.verified && (
            <span
              className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700"
              title="이 물음은 프린트 원문에서 글자 그대로 찾지 못했어요. 원본과 대조해 주세요."
            >
              원문과 달라요
            </span>
          )}
          {item.answerSource === 'ai' && item.evidenceSource === null && (
            <span
              className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900"
              title="자료에서 근거 구절을 찾지 못한 답이에요. 꼭 확인해 주세요."
            >
              근거 없음
            </span>
          )}
        </div>

        <Textarea
          value={item.answer}
          rows={answerLineCount(item)}
          disabled={disabled}
          placeholder="답이 없어요. 모범답안을 만들거나 직접 적어 주세요."
          aria-label={`${number}번 답`}
          onChange={(e) => onAnswer(e.target.value)}
        />

        {/* 학생이 적어 둔 답 — 모범답안으로 덮어도 남긴다(무엇을 고쳐 줘야 하는지 알아야 한다) */}
        {item.studentAnswer && item.studentAnswer !== item.answer && (
          <p className="text-xs text-gray-500">
            학생이 쓴 답: <span className="text-gray-700">{item.studentAnswer}</span>
          </p>
        )}

        {item.evidence && (
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer">
              근거 · {item.evidenceSource === '' ? '이 프린트' : item.evidenceSource}
            </summary>
            <p className="mt-1 whitespace-pre-wrap rounded bg-gray-50 px-2 py-1 text-gray-600">
              {item.evidence}
            </p>
          </details>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`${number}번 문항 빼기`}
        className="mt-1 h-7 w-7 shrink-0 rounded text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-30"
      >
        <Trash2 className="mx-auto h-4 w-4" />
      </button>
    </li>
  );
}
