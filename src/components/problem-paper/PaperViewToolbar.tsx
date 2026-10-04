'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaperCover } from '@/lib/problem-paper/cover';
import type { PaperPrintLayout } from '@/lib/problem-paper/print-layout-pref';
import type { ProblemPaper } from '@/types/problem-bank';
import PaperGradeSyncButton from './PaperGradeSyncButton';
import PaperPrintLayoutToggle from './PaperPrintLayoutToggle';

/** 보기 모드 — 문제지 / 교사용 / 답지 */
export type PaperViewMode = 'paper' | 'teacher' | 'key';

const VIEW_LABELS: { mode: PaperViewMode; label: string }[] = [
  { mode: 'paper', label: '문제지' },
  { mode: 'teacher', label: '교사용' },
  { mode: 'key', label: '답지' },
];

interface PaperViewToolbarProps {
  paper: ProblemPaper;
  itemCount: number;
  mode: PaperViewMode;
  onModeChange: (mode: PaperViewMode) => void;
  printLayout: PaperPrintLayout;
  onPrintLayoutChange: (layout: PaperPrintLayout) => void;
  cover: PaperCover | null;
  onCoverClick: () => void;
  /** 인쇄 단추 글자 — 준비 중이면 그 까닭 */
  printLabel: string;
  printDisabled: boolean;
  onPrint: () => void;
}

function coverLabel(cover: PaperCover | null): string {
  if (!cover) return '표지';
  return cover.kind === 'image' ? '표지 · 그림' : '표지 · 간단';
}

/**
 * 저장된 문제지 화면 위쪽 줄 — 목록으로 · 제목 · 보기 모드 · 표지 · 인쇄 방식 · 인쇄.
 * 인쇄물에는 나가지 않는다(`data-no-print`).
 */
export default function PaperViewToolbar({
  paper, itemCount, mode, onModeChange, printLayout, onPrintLayoutChange,
  cover, onCoverClick, printLabel, printDisabled, onPrint,
}: PaperViewToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-no-print>
      <Link
        href="/problems/papers"
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> 목록
      </Link>
      <span className="ml-2 font-semibold text-gray-900">{paper.title}</span>
      <span className="text-sm text-gray-500">{itemCount}문항</span>
      {paper.settings.omr && (
        <span
          className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
          title="학원 성적 시스템에 시험으로 등록되고 90A 답안지로 채점해요"
        >
          OMR 채점
        </span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-1">
        {paper.settings.omr && <PaperGradeSyncButton paperId={paper.id} />}
        {VIEW_LABELS.map((v) => (
          <Button
            key={v.mode} type="button" size="sm"
            variant={mode === v.mode ? 'default' : 'outline'}
            onClick={() => onModeChange(v.mode)}
          >
            {v.label}
          </Button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden="true" />
        <Button
          type="button" size="sm" variant={cover ? 'secondary' : 'outline'}
          onClick={onCoverClick}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span className="ml-1">{coverLabel(cover)}</span>
        </Button>
        <PaperPrintLayoutToggle value={printLayout} onChange={onPrintLayoutChange} />
        <Button type="button" size="sm" onClick={onPrint} disabled={printDisabled}>
          <Printer className="h-3.5 w-3.5" />
          <span className="ml-1">{printLabel}</span>
        </Button>
      </div>
    </div>
  );
}
