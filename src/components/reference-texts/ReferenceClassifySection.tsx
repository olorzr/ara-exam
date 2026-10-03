'use client';

import GrammarTagPicker from '@/components/problem-review/GrammarTagPicker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { REFERENCE_NOTE_MAX } from '@/lib/reference-texts/constants';
import type { ReferenceTextDraft } from '@/lib/reference-texts/form';
import ReferenceUnitsField from './ReferenceUnitsField';

interface ReferenceClassifySectionProps {
  draft: ReferenceTextDraft;
  patch: (next: Partial<ReferenceTextDraft>) => void;
}

/**
 * 작품 전문의 **분류** — 교과서 단원(여럿) · 문법 · 판본 메모.
 *
 * 문제 은행처럼 교과서별·작품별로 찾게 하려고 붙인다(sql/60). 학교는 고르지 않는다.
 * 작품은 위의 제목·지은이 칸이 곧 작품이다('작품 고르기' 단추가 문제 은행 작품을 채운다).
 *
 * 판본 메모는 "학교마다 본문이 조금 다를 때" 의 답이다 — 글이 실제로 다르면 전문을 따로
 * 올려 각각 그 교과서 단원만 붙이고 여기 적어 가른다. 거의 같으면 한 편에 단원을 여럿 붙인다.
 * @param props - 편집 중인 값과 고치기 콜백
 * @returns 분류 섹션
 */
export default function ReferenceClassifySection({ draft, patch }: ReferenceClassifySectionProps) {
  const noteTooLong = draft.note.trim().length > REFERENCE_NOTE_MAX;

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 p-4" aria-labelledby="ref-classify">
      <div>
        <h2 id="ref-classify" className="text-sm font-semibold text-gray-800">분류</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          붙여 두면 목록 왼쪽에서 교과서별·작품별·문법별로 찾을 수 있어요. 비워 둬도 저장됩니다.
        </p>
      </div>

      <ReferenceUnitsField value={draft.units} onChange={(units) => patch({ units })} />

      <GrammarTagPicker
        value={draft.grammar_paths}
        suggested={false}
        subjectLabel="전문"
        onChange={(grammar_paths) => patch({ grammar_paths })}
      />

      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="ref-note" className="text-xs text-gray-500">판본 메모</Label>
          <span className={`text-xs ${noteTooLong ? 'font-medium text-red-600' : 'text-gray-400'}`}>
            {draft.note.length} / {REFERENCE_NOTE_MAX}자
          </span>
        </div>
        <Input
          id="ref-note"
          value={draft.note}
          maxLength={REFERENCE_NOTE_MAX}
          placeholder="예: 교학사 수록본 · 현대어 표기"
          onChange={(e) => patch({ note: e.target.value })}
        />
        <p className="text-xs text-gray-500">
          교과서마다 본문이 조금 다르면 판본마다 따로 올리고 여기 적어 구분하세요.
          거의 같으면 한 편에 단원만 여러 개 붙이면 됩니다.
        </p>
      </div>
    </section>
  );
}
