'use client';

import { useEffect, useState } from 'react';
import LabeledSelect from '@/components/problem-ocr/LabeledSelect';
import { getPublishers } from '@/lib/category-master';
import { UNSPECIFIED_OPTION, toOptionValue, toStoredValue } from '@/lib/external-category';
import { levelFromGrade } from '@/lib/problem-bank/source-form';

interface SourceTextbookPickerProps {
  /** 지금 출처의 교과서 ('' 는 미지정) */
  value: string;
  /** 학교급을 좁히는 데 쓴다 ('' 면 두 급의 교과서를 모두 보여 준다) */
  grade: string;
  onChange: (textbook: string) => void;
}

/**
 * 검수 화면에서 교과서를 고치는 칸.
 *
 * 교과서가 없으면 단원 칸 자체가 안 뜬다 — 업로드 때 못 골랐거나 잘못 고른 출처(첫
 * 업로드분 포함)를 여기서 고칠 수 있어야 **옛 문항도 단원별로 찾을 수 있다**.
 *
 * ⚠️ 저장은 즉시다(문항 카드처럼 '저장' 버튼을 따로 두지 않는다). 값 하나짜리라
 *    잃을 입력이 없고, 바꾸는 순간 단원 트리가 따라와야 한다.
 */
export default function SourceTextbookPicker({ value, grade, onChange }: SourceTextbookPickerProps) {
  const [textbooks, setTextbooks] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    getPublishers(levelFromGrade(grade) ?? undefined)
      .then((rows) => { if (alive) setTextbooks(rows.map((p) => p.name)); })
      .catch(() => { if (alive) setTextbooks([]); });
    return () => { alive = false; };
  }, [grade]);

  if (textbooks.length === 0) return null;

  return (
    <div className="w-56">
      <LabeledSelect
        label="교과서"
        value={toOptionValue(value)}
        options={[UNSPECIFIED_OPTION, ...textbooks]}
        placeholder="교과서 선택"
        onChange={(v) => onChange(toStoredValue(v))}
      />
    </div>
  );
}
