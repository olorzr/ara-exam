'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import type { CoverFiles } from '@/hooks/usePaperCover';
import {
  COVER_SUBTITLE_MAX, COVER_TEACHER_MAX, COVER_TITLE_MAX, DEFAULT_COVER_LAYOUT, DEFAULT_SIMPLE_COVER,
  type PaperBackCoverKind, type PaperCover, type PaperCoverLayout,
} from '@/lib/problem-paper/cover';
import CoverLayoutPicker from './CoverLayoutPicker';
import PaperBackCoverFields from './PaperBackCoverFields';

type CoverChoice = 'none' | 'simple' | 'image';

interface PaperCoverDialogProps {
  open: boolean;
  /** 제목 칸을 비웠을 때 쓰일 문제지 제목 */
  paperTitle: string;
  /** 지금 표지 (없으면 null) */
  cover: PaperCover | null;
  /** 지금 그림 표지의 서명 URL — 그림을 새로 고르지 않을 때 미리보기로 쓴다 */
  coverImageUrl?: string;
  /** 지금 그림 뒷표지의 서명 URL */
  backImageUrl?: string;
  /** 문제지를 만든 해 — 디자인 미리보기에 찍는다 */
  year?: string;
  /** 문제지를 만든 선생님 이름 — '선생님' 칸을 비우면 이것을 쓴다 */
  creatorName?: string;
  busy: boolean;
  onClose: () => void;
  /** 저장 — 그림을 새로 골랐으면 `files` 에 앞·뒤 그림이 온다. 저장했으면 true */
  onSave: (next: PaperCover, files: CoverFiles) => Promise<boolean>;
  /** 표지 빼기. 뺐으면 true */
  onRemove: () => Promise<boolean>;
}

/** 부제 자리글 — 줄마다 뜻이 있다(디자인 표지는 첫 줄을 과정, 둘째 줄부터를 단원 목록으로 싣는다) */
const SUBTITLE_PLACEHOLDER = '고등 1학년 · 국어 · 2학기\n화자와 정서\n이미지와 감각';

const CHOICES: { value: CoverChoice; label: string }[] = [
  { value: 'none', label: '표지 없음' },
  { value: 'simple', label: '간단 표지 만들기' },
  { value: 'image', label: '만든 표지 그림 올리기' },
];

/**
 * 표지 고르기 창 — 없음 / 간단 표지(디자인 일곱 가지) / 그림 올리기, 그리고 뒷표지(없음 · 디자인 짝 · 그림).
 *
 * 입력 상태는 안쪽 폼이 들고 있다 — 창을 닫으면 내용이 언마운트되어 다음에 열 때 지금 표지에서
 * 새로 시작한다(효과로 되돌리면 `set-state-in-effect` 에 걸린다).
 */
export default function PaperCoverDialog(props: PaperCoverDialogProps) {
  const { open, busy, onClose } = props;
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle className="text-base">표지</DialogTitle>
        <CoverForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function CoverForm({
  paperTitle, cover, coverImageUrl, backImageUrl, year = '', creatorName = '', busy, onClose, onSave, onRemove,
}: PaperCoverDialogProps) {
  const start = cover ?? DEFAULT_SIMPLE_COVER;
  const [choice, setChoice] = useState<CoverChoice>(cover ? cover.kind : 'simple');
  const [title, setTitle] = useState(start.title);
  const [subtitle, setSubtitle] = useState(start.subtitle);
  const [teacher, setTeacher] = useState(start.teacher);
  const [showNameBox, setShowNameBox] = useState(start.showNameBox);
  const [layout, setLayout] = useState<PaperCoverLayout>(start.layout);
  const [backChoice, setBackChoice] = useState<PaperBackCoverKind>(start.backKind);
  const nameHintId = useId();
  const teacherHintId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);

  // 고른 파일 미리보기 — 주소는 쓰고 나면 돌려준다
  const fileUrl = useObjectUrl(file);

  const existingImage = cover?.kind === 'image' ? cover.imagePath : '';
  const previewUrl = fileUrl ?? (existingImage ? coverImageUrl : undefined);
  // 디자인 뒷표지는 간단 표지의 짝이다 — 그림 표지로 바꾸면 '없음' 으로 본다(toCoverRow·sql/75 와 같은 규칙)
  const effectiveBack: PaperBackCoverKind = choice !== 'simple' && backChoice === 'design' ? 'none' : backChoice;
  const existingBack = cover?.backKind === 'image' ? cover.backImagePath : '';
  // '표지 없음' 은 앞·뒤를 다 빼므로 그림 조건을 보지 않는다(뒷표지 그림을 고르다 말고 바꿔도 저장된다, 코덱스 1R)
  const canSave = choice === 'none' || (
    (choice !== 'image' || Boolean(file || existingImage))
    && (effectiveBack !== 'image' || Boolean(backFile || existingBack))
  );

  const submit = async () => {
    if (choice === 'none') {
      const done = cover ? await onRemove() : true;
      if (done) onClose();
      return;
    }
    const next: PaperCover = {
      kind: choice,
      // 그림 표지에는 디자인이 없다(toCoverRow 도 같은 규칙으로 basic 을 저장한다)
      layout: choice === 'simple' ? layout : DEFAULT_COVER_LAYOUT,
      title,
      subtitle,
      showNameBox,
      imagePath: choice === 'image' ? existingImage : '',
      teacher,
      backKind: effectiveBack,
      backImagePath: effectiveBack === 'image' ? existingBack : '',
    };
    const files: CoverFiles = {
      front: choice === 'image' ? file : null,
      back: effectiveBack === 'image' ? backFile : null,
    };
    if (await onSave(next, files)) onClose();
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
              <Textarea
                value={subtitle} rows={3} maxLength={COVER_SUBTITLE_MAX} placeholder={SUBTITLE_PLACEHOLDER}
                onChange={(e) => setSubtitle(e.target.value)} disabled={busy}
              />
              <span className="block text-xs text-gray-400">
                첫 줄은 과정, 둘째 줄부터는 단원이에요(여섯 줄까지 — 넘치면 마지막 단원에 이어 붙여요).
              </span>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-gray-600">선생님</span>
              <Input
                value={teacher} maxLength={COVER_TEACHER_MAX} aria-describedby={teacherHintId}
                placeholder={creatorName || '문제지를 만든 선생님'}
                onChange={(e) => setTeacher(e.target.value)} disabled={busy}
              />
              <span id={teacherHintId} className="block text-xs text-gray-400">
                비워 두면 문제지를 만든 선생님 이름을 써요. 디자인 표지에만 찍혀요.
              </span>
            </label>
            <CoverLayoutPicker
              value={layout} onChange={setLayout} disabled={busy}
              preview={{ title: title.trim() || paperTitle, subtitle, showNameBox, year, teacher: teacher.trim() || creatorName }}
            />
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox" checked={showNameBox} disabled={busy} aria-describedby={nameHintId}
                  onChange={(e) => setShowNameBox(e.target.checked)}
                />
                이름 칸 넣기
              </label>
              <p id={nameHintId} className="ml-6 text-xs text-gray-400">
                간단: 학교 · 학년 반 · 이름 / 디자인: 학생 빈칸
              </p>
            </div>
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

        {choice !== 'none' && (
          <PaperBackCoverFields
            value={effectiveBack} onChange={setBackChoice} allowDesign={choice === 'simple'}
            file={backFile} onFile={setBackFile}
            savedImageUrl={existingBack ? backImageUrl : undefined} disabled={busy}
          />
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
