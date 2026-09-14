'use client';

import Link from 'next/link';
import { Sparkles, Trash2 } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { useConceptPick } from '@/hooks/useConceptPick';
import type { MarkItem } from './ExamMarkingSidebar';

export interface AiPickSectionProps {
  /** AI 기능이 열려 있는가 (`/api/ai/status` 의 concept_pick) */
  enabled: boolean;
  editorRef: { current: Editor | null };
  marks: MarkItem[];
  addMarkByText: (text: string) => boolean;
  removeMarkByText: (text: string) => void;
}

/**
 * 마킹 사이드바 안의 'AI 추천 빈칸'.
 *
 * 개념지와 학교 프린트 시험지가 **같은 편집기**를 쓰므로 양쪽에서 그대로 쓸 수 있다.
 * 기능이 꺼져 있으면 아무것도 그리지 않는다 — 설정에서 끄면 없던 기능처럼 보여야 한다.
 *
 * 개수를 묻는 칸은 없다 — 몇 개를 고를지는 본문을 보고 AI 가 정한다.
 */
export default function AiPickSection(props: AiPickSectionProps) {
  const pick = useConceptPick(props);

  if (!props.enabled) return null;

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
          {pick.running ? '고르는 중…' : '추천받기'}
        </Button>
        {pick.running && (
          <Button type="button" size="sm" variant="outline" onClick={pick.cancel}>
            취소
          </Button>
        )}
      </div>

      <p className="mt-1.5 text-xs text-gray-400">
        몇 개를 고를지는 본문을 보고 AI 가 정해요. 본문에 있는 낱말만 고르고, 이미 마킹한 것은
        다시 고르지 않아요.{' '}
        <Link href="/settings/ai" className="underline underline-offset-2">AI 연결</Link>
      </p>

      {pick.applied.length > 0 && (
        <div className="mt-2">
          <ul className="max-h-40 space-y-0.5 overflow-y-auto">
            {pick.applied.map((item) => (
              <li
                key={item.text}
                className="group flex items-start gap-2 rounded px-2 py-1 hover:bg-gray-50"
              >
                <span className="mt-0.5 text-sm font-medium text-gray-800">{item.text}</span>
                {item.reason && (
                  <span className="flex-1 text-xs text-gray-400">{item.reason}</span>
                )}
                <button
                  type="button"
                  onClick={() => pick.removeOne(item.text)}
                  className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  aria-label={`${item.text} 추천 빼기`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-1.5 w-full"
            onClick={pick.undoAll}
          >
            추천 전부 되돌리기 ({pick.applied.length}개)
          </Button>
        </div>
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
