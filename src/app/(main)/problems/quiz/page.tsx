'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  PassagePickerDialog, PassageQuizForm, PassageQuizKeyView, PassageQuizList, PassageQuizPaperView,
  QuizReferencesSection, ReferencePickerDialog,
  type PickedPassage,
} from '@/components/passage-quiz';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { usePassageQuiz } from '@/hooks/usePassageQuiz';
import { useQuizReferences } from '@/hooks/useQuizReferences';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import {
  EMPTY_DRAFT, draftCounts, referenceBlocker, type PassageQuizDraft,
} from '@/lib/passage-quiz';
import { hasMatchSignals, signalsFromDraft } from '@/lib/quiz-references/signals';
import type { PickedPassageMeta } from '@/lib/quiz-references/types';

type ViewMode = 'edit' | 'paper' | 'key';

const VIEW_LABELS: { mode: ViewMode; label: string }[] = [
  { mode: 'edit', label: '편집' },
  { mode: 'paper', label: '문제지' },
  { mode: 'key', label: '정답표' },
];

/**
 * O,X·단답형 (`/problems/quiz`).
 *
 * 문학 작품이나 비문학 지문을 넣으면 AI 가 O,X 와 단답형 문항을 만든다. 학원에 이미 있는
 * 자료(개념지·학교 프린트·기출 지문·작품 전문)를 **참고자료로 함께 읽어** 잘린 지문만으로는
 * 낼 수 없는 문항까지 근거와 함께 만든다.
 *
 * ⚠️ 만든 문항은 **저장하지 않는다** — 고쳐서 인쇄하면 끝이고 새로고침하면 사라진다.
 *    그래서 목록이 있는 채로 화면을 떠나려 하면 먼저 묻는다(`useUnsavedGuard`).
 *    참고자료는 다시 찾으면 그만이라 지킬 대상이 아니다.
 * @returns O,X·단답형 화면
 */
export default function PassageQuizPage() {
  const ai = useAiEnabled();
  const quiz = usePassageQuiz();
  const refs = useQuizReferences();
  const [draft, setDraft] = useState<PassageQuizDraft>(EMPTY_DRAFT);
  const [mode, setMode] = useState<ViewMode>('edit');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [refPickerOpen, setRefPickerOpen] = useState(false);
  /** 아카이브에서 고른 지문의 단원·학교 — 붙여넣기면 null */
  const [pickedMeta, setPickedMeta] = useState<PickedPassageMeta | null>(null);

  const hasItems = quiz.items.length > 0;
  // 문항이 없으면 인쇄할 것도 없다. 모드를 효과로 되돌리지 않고 **그릴 때 정한다**
  // (효과 안의 setState 는 이 저장소에서 막혀 있고, 되돌린 뒤 한 번 더 그리는 낭비도 없다)
  const view: ViewMode = hasItems ? mode : 'edit';
  const signals = signalsFromDraft(draft, pickedMeta);

  // 저장하지 않는 화면이라 떠나면 사라진다 — 새로고침·닫기와 **메뉴 이동** 양쪽에서 묻는다
  useUnsavedGuard(hasItems, '만든 문항이 사라져요. 이 화면을 떠날까요?');

  /**
   * 입력값을 고친다.
   *
   * ⚠️ **지문이 바뀌면 자동으로 붙은 자료를 걷어낸다**(코덱스 리뷰 1R·3R·4R).
   *    자료는 지문이 아니라 작품명·단원·학교를 보고 붙는데, 다른 작품을 붙여 넣어도 그 값들은
   *    그대로라 **앞 지문의 자료가 새 문항의 근거로 실린다.** 지문 칸은 `onBlur` 로 다시 찾지
   *    않으므로(글자마다 조회할 수는 없다) 여기서 걷어내는 수밖에 없다 — 새 자료는 제목·지은이를
   *    적거나 '참고자료 찾기' 를 누르면 곧바로 붙는다(`dropAuto` 가 마지막 신호 기억도 지운다).
   *    ⚠️ **아카이브에서 골랐는지와 무관하게** 걷어낸다: 붙여넣기로 쓴 경우에도 같은 일이 난다.
   *    직접 고른 자료는 남는다 — 사람이 그 지문을 보고 고른 것일 수 있다.
   *    제목·지은이만 고치는 것은 그대로 둔다(그쪽은 `onBlur` 가 다시 찾는다).
   * @param patch - 바뀐 칸
   */
  const changeDraft = (patch: Partial<PassageQuizDraft>) => {
    if (patch.text !== undefined && patch.text !== draft.text) {
      // 아카이브에서 물려받은 교과서·단원·학교는 **그 지문의 것**이라 함께 버린다
      if (pickedMeta) setPickedMeta(null);
      refs.dropAuto();
    }
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const applyPicked = (picked: PickedPassage) => {
    if (draft.text.trim() && !window.confirm('입력한 지문을 고른 지문으로 바꿀까요?')) return;
    // 제목·지은이는 **고른 지문의 것으로 바꾼다.** 비어 있다고 앞의 값을 남기면
    // 엉뚱한 작품 이름이 다른 글 위에 찍히고 AI 에게도 그렇게 넘어간다
    setDraft((prev) => ({
      ...prev, text: picked.text, title: picked.title, author: picked.author,
    }));
    setPickedMeta(picked.meta);
    // ⚠️ 신호를 **고른 값으로 직접** 만든다 — state 는 아직 안 바뀌어 있어 `signals` 를 쓰면
    //    앞 지문의 신호로 찾는다. 지문이 바뀌었으니 같은 신호여도 다시 찾는다(`force`)
    void refs.suggest(
      signalsFromDraft({ title: picked.title, author: picked.author }, picked.meta),
      { force: true },
    );
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
            onChange={changeDraft}
            running={quiz.running}
            extraBlocker={referenceBlocker(draft, {
              referenceChars: refs.referenceChars,
              loading: refs.loading,
              searching: refs.suggesting,
            })}
            onSignalsBlur={() => { void refs.suggest(signals); }}
            onGenerate={() => quiz.run({
              text: draft.text,
              title: draft.title,
              author: draft.author,
              counts: draftCounts(draft),
              references: refs.promptReferences,
            })}
            onCancel={quiz.cancel}
            onOpenPicker={() => setPickerOpen(true)}
          />

          <QuizReferencesSection
            attached={refs.attached}
            suggesting={refs.suggesting}
            canSuggest={hasMatchSignals(signals)}
            hasRoom={refs.hasRoom}
            textChars={draft.text.length}
            referenceChars={refs.referenceChars}
            onSuggest={() => { void refs.suggest(signals, { force: true }); }}
            onOpenPicker={() => setRefPickerOpen(true)}
            onRemove={refs.remove}
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

          <ReferencePickerDialog
            open={refPickerOpen}
            attachedKeys={refs.attachedKeys}
            onClose={() => setRefPickerOpen(false)}
            onPick={refs.add}
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
        <PassageQuizKeyView
          title={quiz.source?.title ?? ''}
          items={quiz.items}
          references={quiz.source?.references ?? []}
        />
      )}
    </div>
  );
}
