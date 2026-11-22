'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface PaperListSearchProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * 문제지 목록 찾기 칸 — 두 탭(내 것 / 다른 선생님 것)이 같이 쓴다. 탭을 바꿔도 친 말이 남는다.
 * 찾기는 제목과 만든 선생님 이름으로 서버에서 한다(paper-search.ts).
 */
export default function PaperListSearch({ value, onChange }: PaperListSearchProps) {
  return (
    <div className="relative w-full sm:max-w-sm">
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-gray-400" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="제목 · 만든 선생님 이름으로 찾기"
        aria-label="문제지 찾기"
        className="h-9 pl-8 text-sm"
      />
    </div>
  );
}
