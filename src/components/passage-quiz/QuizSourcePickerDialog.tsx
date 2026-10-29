'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePickGate } from '@/hooks/usePickGate';
import type { PickedPassage } from '@/lib/quiz-references/types';
import PassagePickBody from './PassagePickBody';
import ReferenceTextPickBody from './ReferenceTextPickBody';

/** 지문을 불러올 곳 */
type QuizSource = 'reference' | 'passage';

const QUIZ_SOURCES: readonly QuizSource[] = ['reference', 'passage'];

/** 값이 불러올 곳 이름인가 — base-ui 는 탭 값으로 아무 값이나(null 포함) 줄 수 있다 */
function isQuizSource(value: unknown): value is QuizSource {
  return QUIZ_SOURCES.some((source) => source === value);
}

interface QuizSourcePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onPick: (picked: PickedPassage) => void;
}

/**
 * 지문 불러오기 창 — **작품 전문·개념**(기본)과 **기출 지문** 두 곳에서 고른다.
 *
 * 직접 붙여 넣는 길은 폼의 지문 칸 그대로다 — 이 창은 이미 학원에 쌓인 글을 다시 치지 않게 하는 길이다.
 * @param props - 열림 여부와 닫기·고르기 콜백
 * @returns 창 (닫혀 있으면 속을 그리지 않는다)
 */
export default function QuizSourcePickerDialog({ open, onClose, onPick }: QuizSourcePickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        {/* 창을 다시 열면 처음부터 — 마운트를 갈아 끼우면 옛 검색어·분류·목록이 남지 않는다 */}
        {open && <SourcePickerBody onClose={onClose} onPick={onPick} />}
      </DialogContent>
    </Dialog>
  );
}

/**
 * 실제 내용 — 열릴 때 마운트되므로 상태가 저절로 초기화된다.
 *
 * 탭은 `ReferenceSidePanel` 과 같은 규약이다: 패널은 언제나 `TabsContent` 안(ARIA 로 이어지게),
 * `keepMounted` 로 감춘 탭도 남기고(오가도 검색어·분류가 그대로), **한 번이라도 연 탭만** 그린다
 * (기출 탭을 안 열면 그 조회가 나가지 않는다).
 *
 * ⚠️ 본문을 읽는 잠금은 **두 탭이 하나를 쓴다**(`usePickGate`) — 탭마다 두면 한쪽을 읽는 사이 다른 탭에서
 *    또 골라, 먼저 고른 것이 늦게 와서 나중에 고른 지문을 덮는다(코덱스 1R).
 */
function SourcePickerBody({ onClose, onPick }: Omit<QuizSourcePickerDialogProps, 'open'>) {
  const gate = usePickGate();
  const [source, setSource] = useState<QuizSource>('reference');
  const [seen, setSeen] = useState<ReadonlySet<QuizSource>>(() => new Set<QuizSource>(['reference']));

  const changeSource = (value: unknown) => {
    if (!isQuizSource(value)) return;
    setSource(value);
    setSeen((prev) => (prev.has(value) ? prev : new Set(prev).add(value)));
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <DialogTitle className="text-base">지문 불러오기</DialogTitle>
        <p className="mt-1 text-sm text-gray-500">
          고른 글이 지문 칸에 들어가요. 지문 칸에 직접 붙여 넣어도 돼요.
        </p>
      </div>

      <Tabs value={source} onValueChange={changeSource}>
        <TabsList>
          <TabsTrigger value="reference">작품 전문·개념</TabsTrigger>
          <TabsTrigger value="passage">기출 지문</TabsTrigger>
        </TabsList>
        <TabsContent value="reference" keepMounted>
          {seen.has('reference') && <ReferenceTextPickBody gate={gate} onClose={onClose} onPick={onPick} />}
        </TabsContent>
        <TabsContent value="passage" keepMounted>
          {seen.has('passage') && <PassagePickBody gate={gate} onClose={onClose} onPick={onPick} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
