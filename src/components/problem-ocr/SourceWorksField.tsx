'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  candidateInputValue, describeWorkBasis, type WorkCandidate,
} from '@/lib/problem-bank/work-candidates';

interface SourceWorksFieldProps {
  value: string;
  /** 이 학교에 이미 적혀 있는 작품들 — 무엇을 보고 채웠는지 밝히는 데 쓴다 */
  candidates: WorkCandidate[];
  onChange: (works: string) => void;
}

/**
 * 작품 칸 + 근거 안내.
 *
 * 여기 적은 작품은 **저장되지 않는다** — AI 에게 "이 시험지에는 이런 작품이 실렸을 것" 이라고
 * 알려 줄 뿐이다. 그래야 모델이 인쇄되지 않은 작품명을 알아보고, 알아본 것을 **이 표기 그대로**
 * 적어 작품 트리가 갈라지지 않는다.
 *
 * 학교를 고르면 그 학교의 프린트 시험지·기출 지문에 이미 적힌 작품으로 자동으로 채우고,
 * **무엇을 보고 채웠는지** 아래 한 줄로 밝힌다(틀렸으면 선생님이 고치면 된다).
 */
export default function SourceWorksField({
  value, candidates, onChange,
}: SourceWorksFieldProps) {
  // ⚠️ 근거는 **칸에 든 값이 후보 그대로일 때만** 말한다(코덱스 리뷰). 손으로 고친 뒤에도
  //    "…에 적힌 작품으로 채웠어요" 라고 하면, 선생님이 방금 직접 친 작품까지 어딘가에
  //    등록돼 있던 것처럼 읽힌다
  const filled = candidates.length > 0 && value === candidateInputValue(candidates);
  const basis = describeWorkBasis(candidates);

  return (
    <div className="space-y-2 sm:col-span-2 lg:col-span-3">
      <Label htmlFor="source-works">작품 (선택)</Label>
      <Input
        id="source-works"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="예: 봄봄, 동백꽃 (김유정)"
      />
      {filled && (
        <p className="text-xs text-gray-500">
          {basis}에 적힌 작품으로 채웠어요. 이 시험지에 없는 작품은 지우고, 빠진 작품은 쉼표로
          이어 적어 주세요.
        </p>
      )}
      {!filled && (
        <p className="text-xs text-gray-500">
          실린 작품을 쉼표로 이어 적으면 AI 가 그 작품을 먼저 살펴 작품명을 채웁니다. 몰라도 괜찮아요.
          {candidates.length > 0 && ` (${basis}에 적힌 작품: ${candidateInputValue(candidates)})`}
        </p>
      )}
    </div>
  );
}
