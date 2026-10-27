'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeTags } from '@/lib/reference-texts/body-format';
import { REFERENCE_TAG_MAX_LEN, REFERENCE_TAG_SUGGESTIONS, REFERENCE_TAGS_MAX } from '@/lib/reference-texts/constants';

interface ReferenceTagsFieldProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

/**
 * 태그 칸 — Enter·쉼표로 더하고, 칩의 X 로 뺀다. 제안 단추는 평가문제집 적재가 쓰는 이름이다.
 *
 * 치던 글자는 지역 state 다(저장값이 아니다). 더할 때 `normalizeTags` 로 다듬어 겹침·상한을 막는다.
 * @param props - 지금 태그와 바꾸는 콜백
 * @returns 태그 입력
 */
export default function ReferenceTagsField({ value, onChange }: ReferenceTagsFieldProps) {
  const [text, setText] = useState('');
  const full = value.length >= REFERENCE_TAGS_MAX;

  const add = (raw: string) => {
    const next = normalizeTags([...value, raw]);
    if (next.length !== value.length) onChange(next);
    setText('');
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="ref-tags" className="text-xs text-gray-500">태그</Label>
        <span className="text-xs text-gray-400">{value.length} / {REFERENCE_TAGS_MAX}</span>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="붙인 태그">
          {value.map((tag) => (
            <li key={tag} className="flex items-center gap-1 rounded border border-primary/30 px-1.5 py-0.5 text-xs text-primary">
              #{tag}
              <button
                type="button"
                aria-label={`${tag} 태그 빼기`}
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="text-gray-400 hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id="ref-tags"
        value={text}
        disabled={full}
        maxLength={REFERENCE_TAG_MAX_LEN}
        placeholder={full ? '태그를 다 붙였어요' : '예: 핵심 정리 — Enter 로 붙여요'}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(',')) add(v.slice(0, -1));
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
          e.preventDefault();
          if (text.trim()) add(text);
        }}
      />
      <div className="flex flex-wrap gap-1">
        {REFERENCE_TAG_SUGGESTIONS.filter((t) => !value.includes(t)).map((tag) => (
          <button
            key={tag}
            type="button"
            disabled={full}
            onClick={() => add(tag)}
            className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-500 hover:border-primary/50 disabled:opacity-50"
          >
            + {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
