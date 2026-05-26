'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface WordEditForm {
  word: string;
  meaning: string;
}

interface WordEditDialogProps {
  open: boolean;
  form: WordEditForm;
  onFormChange: (form: WordEditForm) => void;
  onClose: () => void;
  onSave: () => void;
}

/**
 * 단어(표제어·뜻) 수정 다이얼로그.
 */
export default function WordEditDialog({
  open,
  form,
  onFormChange,
  onClose,
  onSave,
}: WordEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>단어 수정</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>단어</Label>
            <Input
              value={form.word}
              onChange={(e) => onFormChange({ ...form, word: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>뜻</Label>
            <Input
              value={form.meaning}
              onChange={(e) => onFormChange({ ...form, meaning: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button className="bg-primary hover:bg-primary-hover text-white" onClick={onSave}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
