'use client';

import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { useConceptPick } from '@/hooks/useConceptPick';
import type { MarkItem } from './ExamMarkingSidebar';

export interface AiPickSectionProps {
  /** AI 기능이 열려 있는가 (`/api/ai/status` 의 concept_pick) */
  enabled: boolean;
  editorRef: { current: Editor | null };
  marks: MarkItem[];
  addMarkByText: (text: string, context?: string) => boolean;
  removeMarkByText: (text: string) => void;
}

/**
 * 마킹 사이드바 안의 'AI 추천 빈칸'.
 *
 * 개념지와 학교 프린트 시험지가 **같은 편집기**를 쓰므로 양쪽에서 그대로 쓸 수 있다.
 * 기능이 꺼져 있으면 아무것도 그리지 않는다 — 설정에서 끄면 없던 기능처럼 보여야 한다.
 *
 * 개수를 묻는 칸은 없다 — 선생님이 손으로 뚫어 둔 **밀도**를 기준으로 AI 가 본문 길이에 맞춰 낸다.
 *
 * ⚠️ 긴 본문은 묶음으로 나눠 **몇 분** 걸린다. 그래서 진행(`n/N`)을 버튼에 띄우고,
 *    붙인 낱말은 **근거 없이 칩으로만** 보여 준다 — 수십~수백 개라 한 줄씩 늘어놓으면
 *    사이드바가 그것만으로 가득 찬다.
 *
 * 검증에 걸려 **버린 추천의 수도 밝힌다.** 안 그러면 표에서 구절을 골라 전부 걸러졌을 때
 * "왜 이렇게 적게 나오지" 만 남는다.
 */
export default function AiPickSection(props: AiPickSectionProps) {
  const pick = useConceptPick(props);

  if (!props.enabled) return null;

  const progress = pick.progress && pick.progress.total > 1
    ? ` ${pick.progress.done}/${pick.progress.total}`
    : '';

  return (
    <div className="border-b border-gray-200 px-4 py-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="text-sm font-semibold text-gray-900">AI 추천 빈칸</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="flex-1 bg-primary text-white hover:bg-primary-hover"
          onClick={pick.run}
          disabled={pick.running}
        >
          {pick.running ? `고르는 중…${progress}` : '추천받기'}
        </Button>
        {pick.running && (
          <Button type="button" size="sm" variant="outline" onClick={pick.cancel}>
            취소
          </Button>
        )}
      </div>

      <p className="mt-1.5 text-xs text-gray-400">
        선생님이 개념지에 뚫어 둔 기준(설명 100자에 5개, 표의 내용 칸과 &apos;답:&apos; 문장)으로 골라요.
        긴 본문은 나눠서 차례로 마킹하니 멈추면 거기까지는 남아요.{' '}
        <Link href="/settings/ai" className="underline underline-offset-2">AI 연결</Link>
      </p>

      {pick.applied.length > 0 && (
        <div className="mt-2">
          <div className="flex max-h-44 flex-wrap gap-1 overflow-y-auto">
            {pick.applied.map((item) => (
              <span
                key={item.text}
                className="group inline-flex items-center gap-0.5 rounded bg-gray-100 py-0.5 pl-1.5 pr-1 text-xs text-gray-800"
              >
                {item.text}
                <button
                  type="button"
                  onClick={() => pick.removeOne(item.text)}
                  disabled={pick.running}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                  aria-label={`${item.text} 추천 빼기`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          {/* ⚠️ 생성 중에는 잠근다(코덱스 리뷰) — 되돌린 뒤 남은 묶음이 다시 붙이면
              '되돌렸는데 그대로' 가 되고 완료 토스트의 수도 실제와 어긋난다 */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-1.5 w-full"
            onClick={pick.undoAll}
            disabled={pick.running}
          >
            {pick.running ? '고르는 중에는 되돌릴 수 없어요' : `추천 전부 되돌리기 (${pick.applied.length}개)`}
          </Button>
        </div>
      )}

      {pick.dropped && pick.dropped.malformed > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          띄어쓰기가 든 추천 {pick.dropped.malformed}개는 뺐어요 — 빈칸은 한 어절만 돼요.
        </p>
      )}

      {pick.dropped && pick.dropped.notInText > 0 && (
        <p className="mt-1 text-xs text-gray-500">
          본문에 없는 말 {pick.dropped.notInText}개는 뺐어요.
        </p>
      )}

      {pick.notFound.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          본문에서 자리를 못 찾은 용어: {pick.notFound.join(', ')} — 서식으로 나뉜 낱말은
          직접 드래그해 마킹해 주세요.
        </p>
      )}
    </div>
  );
}
