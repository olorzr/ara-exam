'use client';

import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { ItemNo } from '@/components/magazine';
import { Badge } from '@/components/ui/badge';
import { paperEditHref, type PaperEditState } from '@/lib/problem-paper/paper-edit';
import { normalizePaperSettings } from '@/lib/problem-paper/settings';
import type { ProblemPaper } from '@/types/problem-bank';
import PaperSourceSummary from './PaperSourceSummary';

interface PaperListRowProps {
  paper: ProblemPaper;
  /** 목록 차례(1부터) */
  n: number;
  /** 만든 선생님 이름 — 다른 선생님 탭에서만 준다 */
  creator?: string;
  /** 고치기 상태 — `reason` 이 null 일 때만 연필을 그린다 */
  editState?: PaperEditState;
  /** 지울 수 있으면 지우기 — 없으면 휴지통을 그리지 않는다 */
  onRemove?: () => void;
}

/**
 * 만든 문제지 목록 한 줄 — 제목(+OMR) / 만든 선생님 · 문항 수 · 만든 날 / 출처(접어 둔다).
 *
 * 링크는 **제목만** 감싼다 — 출처 펼치기 단추가 링크 안에 들어가지 않게(0.9.89). 줄 안에 테두리 상자를 두지 않고,
 * 연필·휴지통은 늘 보이며 좁은 화면에서는 아래 줄로 내려간다.
 */
export default function PaperListRow({ paper, n, creator, editState, onRemove }: PaperListRowProps) {
  // 옛 문제지는 키가 없다 — 정규화해서 읽는다(문자열 'true' 로 켜지지 않게)
  const omr = normalizePaperSettings(paper.settings).omr;
  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-2">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <ItemNo n={n} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug font-semibold break-keep [overflow-wrap:anywhere] text-ink">
            <Link href={`/problems/papers/${paper.id}`} className="hover:text-primary">{paper.title}</Link>
            {omr && <Badge className="ml-2 align-middle">OMR</Badge>}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {creator && `${creator} 선생님 · `}
            {paper.total_questions}문항 · {new Date(paper.created_at).toLocaleDateString('ko-KR')}
          </p>
          <PaperSourceSummary labels={paper.source_labels} />
        </div>
      </div>
      {(editState?.reason === null || onRemove) && (
        <div className="flex shrink-0 gap-1 pl-9 sm:pl-0">
          {editState?.reason === null && (
            <Link
              href={paperEditHref(paper.id, editState)}
              className="rounded-full p-2 text-gray-400 hover:bg-accent-soft hover:text-ink"
              aria-label={`${paper.title} 고치기`}
            >
              <Pencil className="h-4 w-4" />
            </Link>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
              aria-label={`${paper.title} 지우기`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
