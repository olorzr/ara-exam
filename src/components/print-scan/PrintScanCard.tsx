'use client';

import { Trash2 } from 'lucide-react';
import { PaperList } from '@/components/magazine';
import { formatDateKR } from '@/lib/format';
import { isTypedBundle } from '@/lib/print-scan/typed';
import type { PrintBundleRow, PrintScanRow } from '@/types/print-scan';
import PrintBundleRowItem from './PrintBundleRow';

interface PrintScanCardProps {
  scan: PrintScanRow;
  /** 읽기·삭제가 도는 중이면 이 카드의 버튼을 전부 잠근다 (한 번에 하나만 돈다) */
  busy: boolean;
  aiEnabled: boolean;
  onRead: (bundle: PrintBundleRow) => void;
  onCreateSheet: (bundle: PrintBundleRow) => void;
  onRegisterWords: (bundle: PrintBundleRow) => void;
  onDeleteBundle: (bundle: PrintBundleRow) => void;
  onDeleteScan: (scan: PrintScanRow) => void;
  /** 다른 선생님 탭에서 — 누가 올렸는지 */
  creatorName?: string;
}

/**
 * 카드 아래 줄 — 올린 날·쪽 수·프린트 수.
 * 직접 입력한 프린트는 원본이 없어 '0쪽' 대신 '직접 입력' 이라고 쓴다.
 */
function scanSummary(scan: PrintScanRow, creatorName?: string): string {
  const typedOnly = scan.bundles.length > 0 && scan.bundles.every((b) => isTypedBundle(b));
  return [
    creatorName && `${creatorName} 선생님`,
    formatDateKR(scan.created_at),
    typedOnly ? '직접 입력' : `${scan.page_count}쪽`,
    `프린트 ${scan.bundles.length}장`,
  ].filter(Boolean).join(' · ');
}

/**
 * 스캔 한 건 + 그 안의 프린트들.
 *
 * 모양(2026-11-14, 원장님 "학교 프린트 시험지라던가 이런게 디자인이 안 예뻐"): 잉크 줄 머리(`( SCAN )` · 바탕체 제목) 아래
 * 흰 종이 목록 한 장 — 예전엔 흰 카드 안에 회색 테두리 상자를 또 쌓았다(상자 안의 상자).
 */
export default function PrintScanCard({
  scan, busy, aiEnabled, onRead, onCreateSheet, onRegisterWords, onDeleteBundle, onDeleteScan,
  creatorName,
}: PrintScanCardProps) {
  return (
    <section className="space-y-2" aria-label={scan.title || '제목 없는 스캔'}>
      <div className="flex items-start gap-2 border-t-2 border-ink pt-2">
        <div className="min-w-0 flex-1">
          <p aria-hidden="true" className="font-label text-[10px] font-medium tracking-[0.18em] text-gray-500">( SCAN )</p>
          <h2 className="mt-0.5 font-display text-[19px] leading-snug font-bold break-keep [overflow-wrap:anywhere] text-ink">
            {scan.title || '제목 없는 스캔'}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">{scanSummary(scan, creatorName)}</p>
        </div>
        <button
          type="button"
          onClick={() => onDeleteScan(scan)}
          disabled={busy}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
          aria-label={`${scan.title || '제목 없는 스캔'} 통째로 지우기`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <PaperList>
        {scan.bundles.map((bundle, index) => (
          <li key={bundle.id}>
            <PrintBundleRowItem
              bundle={bundle}
              no={index + 1}
              busy={busy}
              aiEnabled={aiEnabled}
              onRead={onRead}
              onCreateSheet={onCreateSheet}
              onRegisterWords={onRegisterWords}
              onDelete={onDeleteBundle}
            />
          </li>
        ))}
      </PaperList>
    </section>
  );
}
