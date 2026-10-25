'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { BOOK_TITLE_MAX } from '@/lib/book';

interface BookCreateDialogProps {
  open: boolean;
  onClose: () => void;
  /** 창 제목 — '새 표지' / '새 내지' */
  title: string;
  placeholder: string;
  /** 만든다 — 끝날 때까지 창을 잠근다 */
  onSubmit: (title: string) => Promise<void>;
}

/**
 * 새 항목 제목 받기 — 표지 만들기 · 내지 만들기 목록이 함께 쓴다.
 * 열 때마다 새로 마운트되어(부르는 쪽 `key`) 앞에 친 제목이 남지 않는다.
 */
export default function BookCreateDialog({ open, onClose, title, placeholder, onSubmit }: BookCreateDialogProps) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next = value.trim();
    if (!next || busy) return;
    setBusy(true);
    try {
      await onSubmit(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="text-base">{title}</DialogTitle>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="text-gray-600">제목</span>
            <Input
              autoFocus value={value} maxLength={BOOK_TITLE_MAX} disabled={busy}
              onChange={(e) => setValue(e.target.value)} placeholder={placeholder}
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>취소</Button>
            <Button type="submit" disabled={busy || !value.trim()}>만들기</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
