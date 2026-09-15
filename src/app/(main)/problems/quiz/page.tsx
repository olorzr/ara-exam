'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  PassagePickerDialog, PassageQuizForm, PassageQuizKeyView, PassageQuizList, PassageQuizPaperView,
  type PickedPassage,
} from '@/components/passage-quiz';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { usePassageQuiz } from '@/hooks/usePassageQuiz';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { EMPTY_DRAFT, draftCounts, type PassageQuizDraft } from '@/lib/passage-quiz';

type ViewMode = 'edit' | 'paper' | 'key';

const VIEW_LABELS: { mode: ViewMode; label: string }[] = [
  { mode: 'edit', label: '편집' },
  { mode: 'paper', label: '문제지' },
  { mode: 'key', label: '정답표' },
];

/**
 * O,X·단답형 (`/problems/quiz`).
 *
 * 문학 작품이나 비문학 지문을 넣으면 AI 가 O,X 와 단답형 문항을 만든다.
 * ⚠️ 만든 문항은 **저장하지 않는다** — 고쳐서 인쇄하면 끝이고 새로고침하면 사라진다.
 *    그래서 목록이 있는 채로 화면을 떠나려 하면 먼저 묻는다(`useUnsavedGuard`).
 * @returns O,X·단답형 화면
 */
export default function PassageQuizPage() {
  const ai = useAiEnabled();
  const quiz = usePassageQuiz();
  const [draft, setDraft] = useState<PassageQuizDraft>(EMPTY_DRAFT);
  const [mode, setMode] = useState<ViewMode>('edit');
  const [pickerOpen, setPickerOpen] = useState(false);

  const hasItems = quiz.items.length > 0;
  // 문항이 없으면 인쇄할 것도 없다. 모드를 효과로 되돌리지 않고 **그릴 때 정한다**
  // (효과 안의 setState 는 이 저장소에서 막혀 있고, 되돌린 뒤 한 번 더 그리는 낭비도 없다)
  const view: ViewMode = hasItems ? mode : 'edit';

  // 저장하지 않는 화면이라 떠나면 사라진다 — 새로고침·닫기와 **메뉴 이동** 양쪽에서 묻는다
  useUnsavedGuard(hasItems, '만든 문항이 사라져요. 이 화면을 떠날까요?');

  const applyPicked = (picked: PickedPassage) => {
    if (draft.text.trim() && !window.confirm('입력한 지문을 고른 지문으로 바꿀까요?')) return;
    // 제목·지은이는 **고른 지문의 것으로 바꾼다.** 비어 있다고 앞의 값을 남기면
    // 엉뚱한 작품 이름이 다른 글 위에 찍히고 AI 에게도 그렇게 넘어간다
    setDraft((prev) => ({
      ...prev, text: picked.text, title: picked.title, author: picked.author,
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3" data-no-print>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">✅ O,X·단답형</h1>
          <p className="mt-1 text-sm text-gray-500">
            문학 작품이나 비문학 지문을 넣으면 O,X 와 단답형 문항을 만들어 드려요.
            만든 문항은 저장되지 않으니 인쇄해서 쓰세요.
          </p>
        </div>

        {hasItems && (
          <div className="flex items-center gap-1">
            {VIEW_LABELS.map((v) => (
              <Button
                key={v.mode}
                type="button"
                size="sm"
                variant={view === v.mode ? 'default' : 'outline'}
                // 색만으로 알리지 않는다 — 화면 낭독기도 무엇이 골라졌는지 말할 수 있어야 한다
                aria-pressed={view === v.mode}
                onClick={() => setMode(v.mode)}
              >
                {v.label}
              </Button>
            ))}
            {view !== 'edit' && (
              <Button type="button" size="sm" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" />
                <span className="ml-1">인쇄</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {!ai.features.passage_quiz ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-gray-500">
            아직 열리지 않은 기능이에요.{' '}
            <a href="/settings/ai" className="text-primary underline underline-offset-2">
              AI 연결 설정
            </a>
            에서 상태를 확인해 주세요.
          </CardContent>
        </Card>
      ) : view === 'edit' ? (
        <>
          <PassageQuizForm
            draft={draft}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
            running={quiz.running}
            onGenerate={() => quiz.run({
              text: draft.text,
              title: draft.title,
              author: draft.author,
              counts: draftCounts(draft),
            })}
            onCancel={quiz.cancel}
            onOpenPicker={() => setPickerOpen(true)}
          />

          <PassageQuizList
            items={quiz.items}
            dropped={quiz.dropped}
            onChange={quiz.updateItem}
            onRemove={quiz.removeItem}
            onClear={quiz.clear}
          />

          <PassagePickerDialog
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onPick={applyPicked}
          />
        </>
      ) : view === 'paper' ? (
        // 인쇄 뷰는 그 모드에서만 그린다 — A4Document 의 숨은 측정 컨테이너가 편집 화면에 있으면
        // 쓰지도 않을 쪽 나누기를 계속 다시 잰다
        // ⚠️ 입력칸이 아니라 **만들 때 쓴 지문**을 싣는다. 만든 뒤에 지문을 고칠 수 있어서,
        //    입력칸을 실으면 "바꿔 놓은 지문 + 옛 지문으로 낸 문항" 이 한 장에 찍힌다
        <PassageQuizPaperView
          text={quiz.source?.text ?? ''}
          title={quiz.source?.title ?? ''}
          author={quiz.source?.author ?? ''}
          items={quiz.items}
        />
      ) : (
        <PassageQuizKeyView title={quiz.source?.title ?? ''} items={quiz.items} />
      )}
    </div>
  );
}
