'use client';

import { useId, useState } from 'react';

interface PaperSourceSummaryProps {
  /** 문제지에 담긴 문항의 출처 시험들 */
  labels: readonly string[];
}

/**
 * 문제지 목록 한 줄의 출처 — 첫 출처만 보이고 나머지는 '외 N곳' 단추로 펼친다.
 *
 * 원장님(2026-11-22): "문제은행 조합된 시험지 좀 깔끔하게" — 출처를 전부 쉼표로 이어 찍어 한 줄이 최대 46곳·1,064자의
 * 글 벽이 됐다. 펼치기는 늘 보이는 단추이고(마우스 올림 전용 금지, 0.9.89) 제목 링크 밖에 있다(링크 안 단추 금지).
 */
export default function PaperSourceSummary({ labels }: PaperSourceSummaryProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (labels.length === 0) return null;
  if (labels.length === 1) {
    return <p className="mt-0.5 text-xs break-keep [overflow-wrap:anywhere] text-gray-500">{labels[0]}</p>;
  }
  return (
    <div className="mt-0.5 text-xs text-gray-500">
      <p className="break-keep [overflow-wrap:anywhere]">
        {labels[0]}{' '}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={listId}
          className="font-semibold whitespace-nowrap text-ink underline underline-offset-2"
        >
          외 {labels.length - 1}곳 {open ? '접기' : '펼치기'}
        </button>
      </p>
      {open && (
        <ul id={listId} className="mt-1 space-y-0.5 border-l border-gray-200 pl-2">
          {labels.slice(1).map((label) => (
            <li key={label} className="break-keep [overflow-wrap:anywhere]">{label}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
