'use client';

import { useEffect, useState } from 'react';
import LabeledSelect from '@/components/problem-ocr/LabeledSelect';
import { Button } from '@/components/ui/button';
import { getPublishers } from '@/lib/category-master';
import { UNSPECIFIED_OPTION, toOptionValue, toStoredValue } from '@/lib/external-category';
import { describeBasis } from '@/lib/problem-bank/scope-pick';
import { levelFromGrade } from '@/lib/problem-bank/source-form';
import { useScopeHint } from '@/hooks/useScopeHint';
import type { ProblemSource } from '@/types/problem-bank';

/** 교과서를 고르고 힌트를 찾는 데 필요한 출처 정보만 */
export type TextbookPickerSource =
  Pick<ProblemSource, 'textbook' | 'grade' | 'school_id' | 'year' | 'semester' | 'exam_type'>;

interface SourceTextbookPickerProps {
  /** 지금 출처 (교과서 `''` 는 미지정) */
  source: TextbookPickerSource;
  /** 저장이 끝날 때까지 기다린다 — 그 사이 칸을 잠가 요청 역전을 막는다 */
  onChange: (textbook: string) => Promise<void>;
}

/**
 * 검수 화면에서 교과서를 고치는 칸.
 *
 * 교과서가 없으면 단원 칸 자체가 안 뜬다 — 업로드 때 못 골랐거나 잘못 고른 출처(첫
 * 업로드분 포함)를 여기서 고칠 수 있어야 **옛 문항도 단원별로 찾을 수 있다**.
 * 비어 있으면 내신 관리에 등록된 교과서를 찾아 **버튼 하나로** 넣을 수 있게 한다.
 *
 * ⚠️ 저장은 즉시다(문항 카드처럼 '저장' 버튼을 따로 두지 않는다). 값 하나짜리라
 *    잃을 입력이 없고, 바꾸는 순간 단원 트리가 따라와야 한다.
 * ⚠️ 저장 중에는 칸을 잠근다. 빠르게 두 번 바꾸면 먼저 보낸 요청이 나중에 도착해
 *    화면과 DB 가 어긋날 수 있다(코덱스 리뷰 2R).
 * ⚠️ 힌트는 **자동으로 저장하지 않는다.** 화면을 열었다는 이유로 공유 표를 고치면
 *    붙어 있던 단원 태그가 말없이 지워진다(교과서를 바꾸면 태그를 지운다).
 */
export default function SourceTextbookPicker({ source, onChange }: SourceTextbookPickerProps) {
  const [textbooks, setTextbooks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { textbook, grade } = source;

  useEffect(() => {
    let alive = true;
    getPublishers(levelFromGrade(grade) ?? undefined)
      .then((rows) => { if (alive) setTextbooks(rows.map((p) => p.name)); })
      .catch(() => { if (alive) setTextbooks([]); });
    return () => { alive = false; };
  }, [grade]);

  // 비어 있을 때만 찾는다 — 이미 고른 교과서 옆에 다른 이름을 권하면 헷갈리기만 한다
  const scope = useScopeHint({
    schoolId: source.school_id ?? '',
    grade,
    year: source.year,
    semester: source.semester,
    examType: source.exam_type,
    textbookNames: textbooks,
    enabled: textbook === '',
  });

  if (textbooks.length === 0) return null;

  const suggestion = scope?.matchedTextbook ?? null;

  const save = async (next: string) => {
    setSaving(true);
    try {
      await onChange(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-56">
      <LabeledSelect
        label="교과서"
        value={toOptionValue(textbook)}
        options={[UNSPECIFIED_OPTION, ...textbooks]}
        placeholder="교과서 선택"
        disabled={saving}
        onChange={(v) => save(toStoredValue(v))}
      />
      {suggestion && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-1 w-full"
          disabled={saving}
          onClick={() => save(suggestion)}
        >
          {scope?.basis && !scope.exact
            ? `내신 관리 ${describeBasis(scope.basis)}: ${suggestion} 넣기`
            : `내신 관리: ${suggestion} 넣기`}
        </Button>
      )}
    </div>
  );
}
