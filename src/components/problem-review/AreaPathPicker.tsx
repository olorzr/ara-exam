'use client';

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AREA_DEPTH_LABELS, optionsAt, type AreaTreeNode } from '@/lib/problem-bank/area-tree';

/** '고르지 않음' 센티널 — base-ui Select 는 빈 문자열 value 를 싫어한다 */
const NONE = '__none__';

interface AreaPathPickerProps {
  tree: AreaTreeNode[];
  value: string[];
  /** 단계 라벨. 교과서 단원(대단원·소단원)처럼 얕은 트리에 다른 이름을 준다 */
  labels?: readonly string[];
  onChange: (path: string[]) => void;
}

/**
 * 영역 경로를 단계별로 고른다.
 *
 * 마스터는 ara-system 이 소유하고 여기서는 **이름만** 저장한다 —
 * 마스터에서 이름이 바뀌거나 노드가 지워져도 이미 태깅한 문항은 그대로여야 한다.
 *
 * 트리를 못 읽었으면(ara-system 정책 미적용) 아무것도 그리지 않는다 —
 * 자유 입력 칸을 대신 띄우는 것은 호출부 몫이다.
 *
 * 영역 분류와 교과서 단원이 **같은 노드 모양**을 쓰므로 이 컴포넌트를 함께 쓴다.
 * 다른 것은 단계 라벨뿐이다.
 */
export default function AreaPathPicker({
  tree, value, labels = AREA_DEPTH_LABELS, onChange,
}: AreaPathPickerProps) {
  // 단계마다 "지금까지 고른 경로 아래의 선택지"를 미리 구해 둔다
  const levels = useMemo(() => {
    const out: { options: string[]; selected: string }[] = [];
    for (let depth = 0; depth < labels.length; depth += 1) {
      const options = optionsAt(tree, value.slice(0, depth));
      if (options.length === 0) break;
      out.push({ options, selected: value[depth] ?? '' });
    }
    return out;
  }, [tree, value, labels]);

  if (levels.length === 0) return null;

  const handle = (depth: number, next: string) => {
    // 상위를 바꾸면 하위는 버린다 — 남겨 두면 트리에 없는 조합이 생긴다
    const head = value.slice(0, depth);
    onChange(next === NONE ? head : [...head, next]);
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {levels.map((level, depth) => (
        <div key={depth} className="space-y-1">
          <Label className="text-xs text-gray-500">{labels[depth]}</Label>
          <Select
            value={level.selected || NONE}
            onValueChange={(v) => { if (v) handle(depth, v); }}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {level.options.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
