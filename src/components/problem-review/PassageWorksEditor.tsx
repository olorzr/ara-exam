'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WORKS_MAX } from '@/lib/problem-bank/work-title';
import type { PassageWork } from '@/types/problem-bank';

interface PassageWorksEditorProps {
  works: PassageWork[];
  onChange: (works: PassageWork[]) => void;
}

/**
 * 지문에 실린 **작품 목록** 편집기.
 *
 * `(가) 진달래꽃 – 김소월 / (나) 엄마 걱정 – 기형도` 처럼 한 지문에 여러 편이 실린다.
 * 예전에는 칸이 하나뿐이라 두 편을 한 칸에 이어 적었고, 그러면 작품 트리에 그 이름의
 * **가짜 작품 하나**가 생겨 한 편만 골라서는 그 문항을 찾을 수 없었다(sql/33).
 *
 * ⚠️ 줄을 지우거나 이름을 고치면 **딸린 문항의 작품명까지 DB 트리거가 따라 바꾼다.**
 *    한 편만 묻도록 사람이 좁혀 둔 문항은 그 좁힘이 보존된다.
 */
export default function PassageWorksEditor({ works, onChange }: PassageWorksEditorProps) {
  const patch = (index: number, part: Partial<PassageWork>) => {
    onChange(works.map((w, i) => (i === index ? { ...w, ...part } : w)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-gray-500">작품</Label>
        {/* 트리거가 딸린 문항의 작품명까지 함께 바꾼다 — 모르고 고치면 놀란다 */}
        <p className="text-[11px] text-gray-400">딸린 문항의 작품명도 함께 바뀝니다</p>
      </div>

      {works.length === 0 && (
        <p className="rounded border border-dashed border-gray-200 px-2 py-3 text-center text-xs text-gray-400">
          이 지문에 실린 작품이 없어요. 문학 지문이면 아래에서 추가해 주세요.
        </p>
      )}

      {works.map((work, i) => (
        // 줄 차례가 곧 (가)(나) 차례라 순번이 곧 정체다(제목은 치는 중에 겹친다)
        <div key={i} className="flex items-center gap-2">
          <Input
            value={work.label}
            onChange={(e) => patch(i, { label: e.target.value })}
            className="h-8 w-14 text-center text-sm"
            placeholder="가"
            aria-label={`${i + 1}번째 작품 구분`}
          />
          <Input
            value={work.title}
            onChange={(e) => patch(i, { title: e.target.value })}
            className="h-8 flex-1 text-sm"
            placeholder="작품명"
            aria-label={`${i + 1}번째 작품명`}
          />
          <Input
            value={work.author}
            onChange={(e) => patch(i, { author: e.target.value })}
            className="h-8 w-32 text-sm"
            placeholder="지은이"
            aria-label={`${i + 1}번째 지은이`}
          />
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => onChange(works.filter((_, j) => j !== i))}
            aria-label={`${i + 1}번째 작품 빼기`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      {works.length < WORKS_MAX && (
        <Button
          type="button" variant="outline" size="sm"
          onClick={() => onChange([...works, { label: '', title: '', author: '' }])}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="ml-1">작품 추가</span>
        </Button>
      )}
    </div>
  );
}
