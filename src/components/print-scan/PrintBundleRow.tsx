'use client';

import Link from 'next/link';
import { BookA, FileText, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bundleWarnings, isStalledReading } from '@/lib/print-scan/reading-state';
import { registeredWordCount, wordsChip } from '@/lib/print-words';
import type { PrintBundleRow as BundleRow } from '@/types/print-scan';
import PrintBundleStatusBadge from './PrintBundleStatusBadge';

interface PrintBundleRowProps {
  bundle: BundleRow;
  busy: boolean;
  aiEnabled: boolean;
  onRead: (bundle: BundleRow) => void;
  onCreateSheet: (bundle: BundleRow) => void;
  onRegisterWords: (bundle: BundleRow) => void;
  onDelete: (bundle: BundleRow) => void;
}

/** 단어 칩 색 — '확인 필요'(호박색)와 겹치지 않게 고른다 */
const WORDS_CHIP_CLASS: Record<'ok' | 'muted' | 'error', string> = {
  ok: 'bg-emerald-100 text-emerald-800',
  muted: 'bg-gray-100 text-gray-600',
  error: 'bg-red-100 text-red-700',
};

/**
 * 목록의 프린트 한 줄.
 *
 * ⚠️ 줄 전체를 `<Link>` 로 감싸지 않는다 — 그 안에 버튼을 넣으면 잘못된 HTML 이고
 *    키보드로도 못 쓴다(문제지 목록과 같은 모양: flex 래퍼 + 링크 + 형제 버튼).
 * ⚠️ **'읽는중' 이라고 버튼을 무조건 잠그지 않는다.** 탭이 닫히면 그 상태로 남는데
 *    잠가 두면 지우고 다시 올리는 것 말고는 되살릴 길이 없다 — 오래 멈춘 것은
 *    확인창을 한 번 거쳐 다시 읽는다([reading-state.ts](@/lib/print-scan/reading-state)).
 */
export default function PrintBundleRow({
  bundle, busy, aiEnabled, onRead, onCreateSheet, onRegisterWords, onDelete,
}: PrintBundleRowProps) {
  const meta = [
    bundle.school_name, bundle.year && `${bundle.year}학년도`,
    bundle.grade, bundle.semester, bundle.exam_type,
  ].filter(Boolean).join(' ');
  const reading = bundle.status === '읽는중';
  // 탭이 닫혀 '읽는중' 으로 잠긴 줄 — 확인창을 거쳐 다시 읽을 수 있다
  const stalled = isStalledReading(bundle);
  const warnings = bundleWarnings(bundle);
  // ⚠️ 단어 칩은 '확인 필요' 와 **따로** 둔다 — 그쪽은 "시험지 본문을 확인하라" 는 뜻이라
  //    단어 얘기를 섞으면 개수가 부풀고 무엇을 보라는 것인지 흐려진다
  const words = wordsChip(bundle.words_meta);
  const categoryId = bundle.words_meta?.categoryId;
  const wordsHref = registeredWordCount(bundle.words_meta) > 0 && categoryId
    ? `/words?categoryId=${encodeURIComponent(categoryId)}`
    : null;
  // 읽어 둔 원문이 있는가 — 시험지도 단어도 여기서부터 ChatGPT 없이(또는 한 번만) 만들 수 있다
  const hasOcrText = bundle.status === '읽기완료' && !!bundle.ocr_html;

  /** 멈춘 것으로 보이는 줄은 한 번 묻고 읽는다 — 다른 탭이 진짜로 읽는 중일 수 있다 */
  const read = () => {
    if (stalled && !window.confirm(
      `"${bundle.name}" 은(는) 읽는 중으로 멈춘 지 오래됐어요.\n`
      + '다른 탭에서 읽고 있지 않다면 다시 읽을까요?',
    )) return;
    onRead(bundle);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-gray-900">{bundle.name}</span>
          <PrintBundleStatusBadge status={bundle.status} />
          {/* 읽히긴 했는데 빠진 데가 있는 것 — '읽기완료' 만 보고 그대로 인쇄하면 안 된다 */}
          {warnings.length > 0 && (
            <span
              className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900"
              title={warnings.join('\n')}
            >
              확인 필요 {warnings.length}
            </span>
          )}
          {words && (
            wordsHref ? (
              // 등록된 카테고리로 곧장 건너뛴다 — 어디 들어갔는지 찾아다니지 않게
              <Link
                href={wordsHref}
                title={`${words.title}\n눌러서 단어 관리에서 확인`}
                className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium underline-offset-2 hover:underline ${WORDS_CHIP_CLASS[words.tone]}`}
              >
                {words.label}
              </Link>
            ) : (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${WORDS_CHIP_CLASS[words.tone]}`}
                title={words.title}
              >
                {words.label}
              </span>
            )
          )}
        </div>
        <p className="truncate text-xs text-gray-500">
          {meta || '학교 미지정'} · {bundle.pages.length}쪽
          {bundle.sheetId && ` · 빈칸 ${bundle.markCount}개`}
          {bundle.include_handwriting && ' · 손글씨 포함'}
        </p>
      </div>

      {/*
        읽어 둔 원문이 있으면 언제든 단어만 따로 등록할 수 있다 — 업로드 때 체크를 안 켠
        프린트와 이 기능이 생기기 전에 올린 프린트를 되살리는 유일한 길이다.
      */}
      {hasOcrText && (
        <Button
          type="button" size="sm" variant="outline"
          onClick={() => onRegisterWords(bundle)}
          disabled={busy || !aiEnabled}
          title={aiEnabled ? undefined : 'ChatGPT 연결이 필요해요'}
        >
          <BookA className="mr-1 h-3.5 w-3.5" />
          {bundle.words_meta?.status === 'done' ? '단어 다시 등록' : '단어 등록'}
        </Button>
      )}

      {bundle.sheetId ? (
        <Link href={`/print-sheets/${bundle.id}`}>
          <Button type="button" size="sm" className="bg-primary text-white hover:bg-primary-hover">
            <FileText className="mr-1 h-3.5 w-3.5" />
            시험지 열기
          </Button>
        </Link>
      ) : hasOcrText ? (
        // 읽어 둔 원문이 있으니 ChatGPT 를 다시 쓰지 않는다
        <Button
          type="button" size="sm" variant="outline"
          onClick={() => onCreateSheet(bundle)}
          disabled={busy}
        >
          <Wand2 className="mr-1 h-3.5 w-3.5" />
          시험지 만들기
        </Button>
      ) : (
        <Button
          type="button" size="sm" variant="outline"
          onClick={read}
          disabled={busy || (reading && !stalled) || !aiEnabled}
          title={reading
            ? (stalled ? '읽는 중으로 멈춘 지 오래됐어요 — 다시 읽을 수 있어요' : '다른 탭에서 읽고 있을 수 있어요')
            : undefined}
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          {bundle.status === '실패' || stalled ? '다시 읽기' : '읽기'}
        </Button>
      )}

      <button
        type="button"
        onClick={() => onDelete(bundle)}
        disabled={busy}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
        aria-label={`${bundle.name} 지우기`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
