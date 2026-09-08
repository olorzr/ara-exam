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
  /** 저장이 끝날 때까지 기다린다 — 그 사이 칸을 잠가 요청 역전을 막는다 */
  onChange: (textbook: string) => Promise<void>;
}

/**
 * 검수 화면에서 교과서를 고치는 칸.
 *
 * 교과서가 없으면 단원 칸 자체가 안 뜬다 — 업로드 때 못 골랐거나 잘못 고른 출처(첫
 * 업로드분 포함)를 여기서 고칠 수 있어야 **옛 문항도 단원별로 찾을 수 있다**.
 *
 * ⚠️ 저장은 즉시다(문항 카드처럼 '저장' 버튼을 따로 두지 않는다). 값 하나짜리라
 *    잃을 입력이 없고, 바꾸는 순간 단원 트리가 따라와야 한다.
 * ⚠️ 저장 중에는 칸을 잠근다. 빠르게 두 번 바꾸면 먼저 보낸 요청이 나중에 도착해
 *    화면과 DB 가 어긋날 수 있다(코덱스 리뷰 2R).
 */
export default function SourceTextbookPicker({ value, grade, onChange }: SourceTextbookPickerProps) {
  const [textbooks, setTextbooks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

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
        disabled={saving}
        onChange={async (v) => {
          setSaving(true);
          try {
            await onChange(toStoredValue(v));
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
