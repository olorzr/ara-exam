'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  COVER_SUBTITLE_MAX, COVER_TITLE_MAX, DEFAULT_SIMPLE_COVER, type PaperCover,
} from '@/lib/problem-paper/cover';

type CoverChoice = 'none' | 'simple' | 'image';

interface PaperCoverDialogProps {
  open: boolean;
  /** 제목 칸을 비웠을 때 쓰일 문제지 제목 */
  paperTitle: string;
  /** 지금 표지 (없으면 null) */
  cover: PaperCover | null;
  /** 지금 그림 표지의 서명 URL — 그림을 새로 고르지 않을 때 미리보기로 쓴다 */
  coverImageUrl?: string;
  busy: boolean;
  onClose: () => void;
  /** 저장 — 그림을 새로 골랐으면 `file` 이 온다. 저장했으면 true */
  onSave: (next: PaperCover, file: File | null) => Promise<boolean>;
  /** 표지 빼기. 뺐으면 true */
  onRemove: () => Promise<boolean>;
}

const CHOICES: { value: CoverChoice; label: string }[] = [
  { value: 'none', label: '표지 없음' },
  { value: 'simple', label: '간단 표지 만들기' },
  { value: 'image', label: '만든 표지 그림 올리기' },
];

/**
 * 표지 고르기 창 — 없음 / 간단 표지 / 그림 올리기.
 *
 * 입력 상태는 안쪽 폼이 들고 있다 — 창을 닫으면 내용이 언마운트되어 다음에 열 때 지금 표지에서
 * 새로 시작한다(효과로 되돌리면 `set-state-in-effect` 에 걸린다).
 */
export default function PaperCoverDialog(props: PaperCoverDialogProps) {
  const { open, busy, onClose } = props;
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="text-base">표지</DialogTitle>
        <CoverForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function CoverForm({
  paperTitle, cover, coverImageUrl, busy, onClose, onSave, onRemove,
}: PaperCoverDialogProps) {
  const start = cover ?? DEFAULT_SIMPLE_COVER;
  const [choice, setChoice] = useState<CoverChoice>(cover ? cover.kind : 'simple');
  const [title, setTitle] = useState(start.title);
  const [subtitle, setSubtitle] = useState(start.subtitle);
  const [showNameBox, setShowNameBox] = useState(start.showNameBox);
  const [file, setFile] = useState<File | null>(null);

  // 고른 파일 미리보기 — 주소는 쓰고 나면 돌려준다
  const fileUrl = useMemo(
    () => (file && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  const existingImage = cover?.kind === 'image' ? cover.imagePath : '';
  const previewUrl = fileUrl ?? (existingImage ? coverImageUrl : undefined);
  const canSave = choice !== 'image' || Boolean(file || existingImage);

  const submit = async () => {
    if (choice === 'none') {
      const done = cover ? await onRemove() : true;
      if (done) onClose();
      return;
    }
    const next: PaperCover = {
      kind: choice,
      title,
      subtitle,
      showNameBox,
      imagePath: choice === 'image' ? existingImage : '',
    };
    if (await onSave(next, choice === 'image' ? file : null)) onClose();
  };

  return (
    <>
      <div className="space-y-4">
        <fieldset className="space-y-1.5" disabled={busy}>
          <legend className="sr-only">표지 종류</legend>
          {CHOICES.map((c) => (
            <label key={c.value} className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="radio" name="paper-cover-kind" value={c.value}
                checked={choice === c.value}
                onChange={() => setChoice(c.value)}
              />
              {c.label}
            </label>
          ))}
        </fieldset>

        {choice === 'simple' && (
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="text-gray-600">제목</span>
              <Input
                value={title} maxLength={COVER_TITLE_MAX} placeholder={paperTitle}
                onChange={(e) => setTitle(e.target.value)} disabled={busy}
              />
              <span className="block text-xs text-gray-400">비워 두면 문제지 제목을 써요. 교사용·답지에는 꼬리가 붙어요.</span>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-gray-600">부제 (선택)</span>
              <Input
                value={subtitle} maxLength={COVER_SUBTITLE_MAX} placeholder="예: 2학기 중간고사 대비 3회"
                onChange={(e) => setSubtitle(e.target.value)} disabled={busy}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox" checked={showNameBox} disabled={busy}
                onChange={(e) => setShowNameBox(e.target.checked)}
              />
              학교 · 학년 반 · 이름 칸 넣기
            </label>
          </div>
        )}

        {choice === 'image' && (
          <div className="space-y-2">
            <label className="block space-y-1 text-sm">
              <span className="text-gray-600">표지 그림 (A4 세로 비율이 가장 잘 맞아요)</span>
              <input
                type="file" accept="image/*" disabled={busy}
                className="block w-full text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl} alt="표지 미리보기"
                className="mx-auto max-h-64 rounded border border-gray-200 object-contain"
              />
            )}
            <p className="text-xs text-gray-400">PNG·JPG 모두 돼요. 올릴 때 인쇄용 JPEG 로 바꿔 저장해요.</p>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
          취소
        </Button>
        <Button type="button" size="sm" onClick={submit} disabled={busy || !canSave}>
          {busy ? '저장하는 중…' : '저장'}
        </Button>
      </DialogFooter>
    </>
  );
}
