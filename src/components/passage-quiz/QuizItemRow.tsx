'use client';

import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { QuizItem } from '@/lib/passage-quiz';

/**
 * 만든 문항 한 줄 — 여기서 바로 고친다.
 *
 * 근거는 **고치지 않는다.** 지문·참고자료에서 글자 그대로 옮겨 온 것이고, 손대면 대조를 통과한
 * 문항인지 아닌지 알 수 없어진다. 문항이 마음에 안 들면 고치거나 빼는 편이 낫다.
 */

interface QuizItemRowProps {
  item: QuizItem;
  /** 시험지에 인쇄될 번호 */
  number: number;
  onChange: (patch: Partial<Pick<QuizItem, 'text' | 'answer'>>) => void;
  onRemove: () => void;
}

/**
 * 문항 한 줄을 그린다.
 * @param props - 문항·인쇄 번호와 수정·삭제 콜백
 * @returns 목록의 한 줄
 */
export default function QuizItemRow({ item, number, onChange, onRemove }: QuizItemRowProps) {
  const isOx = item.kind === 'ox';

  return (
    <li className="flex gap-2 py-2.5">
      <span className="mt-1.5 w-6 shrink-0 text-sm font-semibold text-primary">
        {String(number).padStart(2, '0')}
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        <Textarea
          value={item.text}
          rows={2}
          aria-label={`${number}번 ${isOx ? '진술' : '질문'}`}
          onChange={(e) => onChange({ text: e.target.value })}
        />

        <div className="flex flex-wrap items-center gap-2">
          {isOx ? (
            <div className="flex items-center gap-1">
              {(['O', 'X'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={item.answer === value}
                  aria-label={`${number}번 정답 ${value}`}
                  onClick={() => onChange({ answer: value })}
                  className={`h-7 w-9 rounded border text-sm font-semibold ${
                    item.answer === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          ) : (
            <>
              <span className="text-xs font-medium text-gray-500">정답</span>
              <Input
                value={item.answer}
                aria-label={`${number}번 정답`}
                className="h-7 max-w-56"
                onChange={(e) => onChange({ answer: e.target.value })}
              />
            </>
          )}
        </div>

        {item.evidence && (
          <details className="text-xs text-gray-500">
            {/* 어느 자료에서 왔는지 밝힌다 — 참고자료에서 온 근거는 지문을 아무리 봐도 없다 */}
            <summary className="cursor-pointer">
              {item.source ? `근거 · ${item.source}` : '지문 근거'}
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
        aria-label={`${number}번 문항 빼기`}
        className="mt-1 h-7 w-7 shrink-0 rounded text-gray-400 hover:bg-gray-100 hover:text-red-600"
      >
        <Trash2 className="mx-auto h-4 w-4" />
      </button>
    </li>
  );
}
