'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface TreeSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** 자리표시 글 — 칸의 이름(`aria-label`)으로도 쓴다 */
  placeholder: string;
}

/**
 * 트리 위의 이름 찾기 칸 — 기출 공유 사이트 문제 찾기 트리와 같은 자리(학교 이름 찾기 등).
 *
 * 스크롤 상자 맨 위에 붙어(`sticky`) 트리를 내려도 칸이 남는다. 바탕은 종이색이라 아래로 지나가는 줄을 가린다.
 * @param props - 찾는 말과 바꾸기
 * @returns 찾기 칸
 */
export default function TreeSearch({ value, onChange, placeholder }: TreeSearchProps) {
  return (
    <div className="sticky top-0 z-10 bg-card pb-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <Input
          type="search"
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 pl-8 text-xs md:text-xs"
        />
      </div>
    </div>
  );
}
