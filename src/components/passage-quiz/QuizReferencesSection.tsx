'use client';

import { BookMarked, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PASSAGE_QUIZ_BUNDLE_LIMIT, QUIZ_REFERENCE_TEXT_MAX } from '@/lib/passage-quiz';
import {
  QUIZ_REFERENCE_KIND_LABELS, type AttachedReference,
} from '@/lib/quiz-references/types';

/**
 * 이 지문과 함께 읽힐 **참고자료** 목록.
 *
 * 자동으로 붙이되 **왜 붙었는지 반드시 보여 준다**(`reason`) — 근거 없이 붙으면 엉뚱한 자료가
 * 끼었을 때 선생님이 고칠 실마리가 없다. 뺀 자료는 다시 찾기로 되살아나지 않는다.
 */

interface QuizReferencesSectionProps {
  attached: AttachedReference[];
  /** 지금 찾는 중인가 */
  suggesting: boolean;
  /** 찾을 신호가 있는가 (제목·지은이를 적었거나 아카이브에서 골랐는가) */
  canSuggest: boolean;
  hasRoom: boolean;
  /** 지문 글자 수 — 합이 상한을 넘는지 사람이 보고 판단한다 */
  textChars: number;
  referenceChars: number;
  onSuggest: () => void;
  onOpenPicker: () => void;
  onRemove: (key: string) => void;
}

/**
 * 참고자료 구간을 그린다.
 * @param props - 붙은 자료와 찾기·추가·빼기 콜백
 * @returns 참고자료 구간
 */
export default function QuizReferencesSection({
  attached, suggesting, canSuggest, hasRoom, textChars, referenceChars,
  onSuggest, onOpenPicker, onRemove,
}: QuizReferencesSectionProps) {
  const total = textChars + referenceChars;

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <BookMarked className="h-4 w-4 text-primary" />
            참고자료 {attached.length > 0 && <span className="text-gray-500">{attached.length}개</span>}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            개념지·학교 프린트·기출 지문·작품 전문을 함께 읽어요. 여기서 가져온 근거도 정답표에 출처가 찍힙니다.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canSuggest || suggesting}
            onClick={onSuggest}
          >
            <Search className="h-3.5 w-3.5" />
            <span className="ml-1">{suggesting ? '찾는 중…' : '참고자료 찾기'}</span>
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={!hasRoom} onClick={onOpenPicker}>
            <Plus className="h-3.5 w-3.5" />
            <span className="ml-1">직접 추가</span>
          </Button>
        </div>
      </div>

      {attached.length === 0 ? (
        <p className="text-xs text-gray-500">
          {canSuggest
            ? '아직 붙은 자료가 없어요. 참고자료 찾기를 누르거나 직접 골라 주세요.'
            : '작품 제목·지은이를 적거나 아카이브에서 지문을 고르면 알맞은 자료를 자동으로 찾아 붙여요.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {attached.map((ref) => (
            <li key={ref.key} className="flex items-start gap-2 py-2">
              <span className="mt-0.5 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                {QUIZ_REFERENCE_KIND_LABELS[ref.kind]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-900">{ref.label}</p>
                {ref.subtitle && <p className="truncate text-xs text-gray-400">{ref.subtitle}</p>}
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                  <span>{ref.auto ? `자동 · ${ref.reason}` : ref.reason}</span>
                  {ref.plain === null && <span className="text-primary">본문 불러오는 중…</span>}
                  {ref.truncated && (
                    <span
                      className="text-amber-700"
                      title={`${QUIZ_REFERENCE_TEXT_MAX.toLocaleString()}자까지만 보냅니다`}
                    >
                      앞부분만 보냄
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(ref.key)}
                aria-label={`${ref.label} 빼기`}
                className="mt-0.5 h-7 w-7 shrink-0 rounded text-gray-400 hover:bg-gray-100 hover:text-red-600"
              >
                <Trash2 className="mx-auto h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {attached.length > 0 && (
        <p className={`text-xs ${total > PASSAGE_QUIZ_BUNDLE_LIMIT ? 'font-medium text-red-600' : 'text-gray-400'}`}>
          지문 {textChars.toLocaleString()}자 + 참고자료 {referenceChars.toLocaleString()}자
          {' = '}
          {total.toLocaleString()} / {PASSAGE_QUIZ_BUNDLE_LIMIT.toLocaleString()}자
        </p>
      )}
    </section>
  );
}
