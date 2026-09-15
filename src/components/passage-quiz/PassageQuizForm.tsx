'use client';

import Link from 'next/link';
import { FolderOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  PASSAGE_QUIZ_MAX_PER_TYPE, PASSAGE_QUIZ_TEXT_LIMIT, draftBlocker,
  type PassageQuizDraft,
} from '@/lib/passage-quiz';

/**
 * 지문과 출제 조건을 받는 입력 폼.
 *
 * 개수 칸은 **비워 두는 것이 기본**이다 — 지문을 보기 전에 개수를 정하면 짧은 지문을 억지로
 * 채우고 긴 지문에서 빠뜨린다(개념지 빈칸 추천에서 같은 판단을 했다).
 */

interface PassageQuizFormProps {
  draft: PassageQuizDraft;
  onChange: (patch: Partial<PassageQuizDraft>) => void;
  running: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  onOpenPicker: () => void;
}

/**
 * 지문·제목·개수를 받는 폼을 그린다.
 * @param props - 입력값과 만들기·취소·지문 고르기 콜백
 * @returns 입력 폼
 */
export default function PassageQuizForm({
  draft, onChange, running, onGenerate, onCancel, onOpenPicker,
}: PassageQuizFormProps) {
  const blocker = draftBlocker(draft);
  const tooLong = draft.text.length > PASSAGE_QUIZ_TEXT_LIMIT;

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="quiz-title">작품·글 제목</Label>
          <Input
            id="quiz-title"
            value={draft.title}
            placeholder="진달래꽃"
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="quiz-author">지은이</Label>
          <Input
            id="quiz-author"
            value={draft.author}
            placeholder="김소월"
            onChange={(e) => onChange({ author: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="quiz-text">지문</Label>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${tooLong ? 'font-medium text-red-600' : 'text-gray-400'}`}>
              {draft.text.length.toLocaleString()} / {PASSAGE_QUIZ_TEXT_LIMIT.toLocaleString()}자
            </span>
            <Button type="button" variant="outline" size="sm" onClick={onOpenPicker}>
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="ml-1">아카이브에서 불러오기</span>
            </Button>
          </div>
        </div>
        <Textarea
          id="quiz-text"
          value={draft.text}
          rows={12}
          placeholder="문학 작품이나 비문학 지문을 붙여 넣어 주세요."
          className="min-h-56 font-normal"
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CountField
          id="quiz-ox-count"
          label="O,X 개수"
          value={draft.oxCount}
          onChange={(oxCount) => onChange({ oxCount })}
        />
        <CountField
          id="quiz-short-count"
          label="단답형 개수"
          value={draft.shortCount}
          onChange={(shortCount) => onChange({ shortCount })}
        />
      </div>

      <p className="text-xs text-gray-500">
        개수를 비워 두면 지문을 보고 <b>AI 가 정합니다</b>(유형마다 최대 {PASSAGE_QUIZ_MAX_PER_TYPE}개).
        0 을 적으면 그 유형은 만들지 않아요. 근거가 지문에 없는 문항은 자동으로 빠집니다.
        AI 는 선생님 컴퓨터의 ChatGPT 를 씁니다 —{' '}
        <Link href="/settings/ai" className="text-primary underline underline-offset-2">
          AI 연결
        </Link>
        에서 상태를 볼 수 있어요.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onGenerate} disabled={running || blocker !== null}>
          <Sparkles className="h-4 w-4" />
          <span className="ml-1">{running ? '만드는 중…' : '문항 만들기'}</span>
        </Button>
        {running && (
          <Button type="button" variant="outline" onClick={onCancel}>취소</Button>
        )}
        {!running && blocker && <span className="text-sm text-gray-500">{blocker}</span>}
      </div>
    </section>
  );
}

/** 유형 하나의 개수 칸 — 빈 값이 '자동'이라 숫자로 바꾸지 않고 문자열로 들고 있는다 */
function CountField({
  id, label, value, onChange,
}: { id: string; label: string; value: string; onChange: (next: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={PASSAGE_QUIZ_MAX_PER_TYPE}
        value={value}
        placeholder="자동"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
