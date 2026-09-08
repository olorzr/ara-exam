'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import {
  GRAMMAR_DEPTH_LABELS, GRAMMAR_TREE, formatGrammarPath,
} from '@/lib/problem-bank/grammar-tree';
import AreaPathPicker from '@/components/problem-review/AreaPathPicker';

interface GrammarBulkTagDialogProps {
  open: boolean;
  /** 지금 선택된 문항 수 — 확인 문구가 거짓이 되면 안 된다 */
  count: number;
  busy: boolean;
  onClose: () => void;
  onApply: (path: string[]) => void;
}

/**
 * 고른 문항들에 문법 분류를 한 번에 붙인다.
 *
 * ⚠️ **고른 경로 하나만** 붙인다(아래 잎으로 펴지 않는다). 잎을 펴는 것은 찾을 때 하는
 *    일이고, 여기서 펴면 문항마다 개념이 아홉 개씩 붙는다.
 * ⚠️ 붙이기만 하고 **지우지 않는다** — 이미 붙어 있던 태그는 그대로 남는다(RPC 가 합집합).
 */
export default function GrammarBulkTagDialog({
  open, count, busy, onClose, onApply,
}: GrammarBulkTagDialogProps) {
  const [path, setPath] = useState<string[]>([]);
  const label = formatGrammarPath(path);

  const close = () => {
    setPath([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) close(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="text-base">문법 분류 붙이기</DialogTitle>

        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            고른 <b className="text-gray-800">{count}개</b> 문항에 아래 분류를 더합니다.
            이미 붙어 있는 분류는 그대로 남습니다.
          </p>

          <AreaPathPicker
            tree={GRAMMAR_TREE}
            value={path}
            labels={GRAMMAR_DEPTH_LABELS}
            onChange={setPath}
          />

          {label && (
            <p className="rounded bg-gray-50 px-2 py-1 text-sm text-gray-700">{label}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={close} disabled={busy}>
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onApply(path)}
            disabled={!label || busy || count === 0}
          >
            {busy ? '붙이는 중…' : '붙이기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
