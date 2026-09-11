'use client';

import LabeledSelect from './LabeledSelect';
import { UNSPECIFIED_OPTION, toOptionValue, toStoredValue } from '@/lib/external-category';
import { describeBasis } from '@/lib/problem-bank/scope-pick';
import type { ScopeHint } from '@/lib/problem-bank/scope-resolve';

interface SourceTextbookFieldProps {
  value: string;
  /** 그 학교급의 교과서 이름 목록 (= exam.publishers.name) */
  textbooks: string[];
  /** 관리자시스템 내신 관리에서 찾은 힌트. 없으면 안내를 그리지 않는다 */
  scope: ScopeHint | null;
  onChange: (textbook: string) => void;
}

/** 범위 단원을 몇 개까지 보여 줄지 — 줄줄이 나오면 아무도 안 읽는다 */
const UNIT_PREVIEW = 3;

/**
 * 교과서 칸 + 내신 범위 안내.
 *
 * 교과서를 고르면 문항에 **단원**을 붙일 수 있다. 학교를 고르면 그 학교의 교과서가 이미
 * 관리자시스템 내신 관리에 등록돼 있으므로 자동으로 골라 주고, **무엇을 보고 골랐는지**
 * 아래 한 줄로 밝힌다(틀렸으면 선생님이 바꾸면 된다).
 */
export default function SourceTextbookField({
  value, textbooks, scope, onChange,
}: SourceTextbookFieldProps) {
  return (
    <LabeledSelect
      label="교과서"
      value={toOptionValue(value)}
      options={[UNSPECIFIED_OPTION, ...textbooks]}
      placeholder="교과서 선택"
      onChange={(v) => onChange(toStoredValue(v))}
      hint={<ScopeNote scope={scope} />}
    />
  );
}

/** 교과서를 어느 슬롯에서 가져왔는지 — 그 시험이 아니면 반드시 밝힌다 */
function basisNote(scope: ScopeHint): string {
  return scope.basis && !scope.exact ? `내신 관리 ${describeBasis(scope.basis)} 기준` : '내신 관리';
}

/** 내신 관리에서 무엇을 찾았는지 한 줄로 */
function ScopeNote({ scope }: { scope: ScopeHint | null }) {
  if (!scope) return null;

  if (scope.textbookName && !scope.matchedTextbook) {
    return (
      <p className="text-xs text-amber-700">
        {basisNote(scope)}에는 &lsquo;{scope.textbookName}&rsquo; 로 등록돼 있는데 카테고리 관리에
        같은 이름의 교과서가 없어요. 직접 골라 주세요.
      </p>
    );
  }

  // '안 보는 시험'이어도 다른 슬롯에서 교과서는 빌려 올 수 있다 — 둘 다 알린다
  if (scope.noExam) {
    return (
      <p className="text-xs text-gray-500">
        🚫 이 학교는 이 시험을 보지 않는다고 등록돼 있어요.
        {scope.matchedTextbook && ` 교과서는 ${basisNote(scope)}으로 채웠어요: ${scope.matchedTextbook}`}
      </p>
    );
  }

  const units = scope.units.slice(0, UNIT_PREVIEW).join(', ');
  return (
    <p className="text-xs text-gray-500">
      {scope.matchedTextbook
        ? `${basisNote(scope)}에 등록된 교과서: ${scope.matchedTextbook}`
        : '내신 관리에 등록된 교과서가 없어요.'}
      {scope.units.length > 0 && (
        <> · 범위 {units}{scope.units.length > UNIT_PREVIEW && ` 외 ${scope.units.length - UNIT_PREVIEW}개`}</>
      )}
    </p>
  );
}
