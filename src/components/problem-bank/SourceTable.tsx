'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import type { SourceListRow } from '@/lib/problem-bank/source-list';

interface SourceTableProps {
  rows: SourceListRow[];
  /**
   * 조건을 바꿔 다시 읽는 중 — 옛 줄을 흐리게 두고 **지우기를 잠근다**(코덱스 2R).
   * 흐린 줄은 새 조건에 안 맞을 수 있다 — 누르면 보려던 것이 아닌 시험지가 지워진다.
   */
  refreshing: boolean;
  /** 지우는 중인 출처가 있으면 지우기 단추를 전부 잠근다 */
  deleting: boolean;
  onDelete: (row: SourceListRow) => void;
}

/** 칸이 비었을 때 찍는 자리표시 */
const EMPTY_CELL = '—';

/**
 * 학교 칸 — 학교가 없는 유형(모의고사·문제집)은 주관·출판사를 대신 보인다.
 * @param row - 목록 줄
 * @returns 보일 글
 */
function schoolCell(row: SourceListRow): string {
  return row.school_name || row.publisher || EMPTY_CELL;
}

/** 학기와 시험(중간·기말, 모의고사면 회차)을 한 칸에 */
function examCell(row: SourceListRow): string {
  return [row.semester, row.exam_type].filter(Boolean).join(' ') || EMPTY_CELL;
}

/** 올린 날 — 목록에서는 날짜만 */
function uploadedCell(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
}

/**
 * '올라간 기출' 목록 표.
 *
 * 줄 전체를 링크로 감싸지 않는다 — 표 줄은 링크가 될 수 없고, 그 안에 지우기 단추가 있다.
 * 제목 칸만 시험지 화면으로 가는 링크다(문제지 목록과 같은 규약).
 * 좁은 화면에서는 표가 가로로 넘친다 — 칸을 접어 숨기면 무엇으로 찾았는지가 사라진다.
 */
export default function SourceTable({ rows, refreshing, deleting, onDelete }: SourceTableProps) {
  return (
    <div
      className={`overflow-x-auto rounded-lg border border-gray-200 transition-opacity ${refreshing ? 'opacity-60' : ''}`}
      aria-busy={refreshing}
    >
      <table className="w-full min-w-[760px] text-sm">
        <caption className="sr-only">올라간 기출 시험지 목록</caption>
        <thead className="bg-gray-50 text-left text-xs text-gray-500">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">제목</th>
            <th scope="col" className="px-3 py-2 font-medium">유형</th>
            <th scope="col" className="px-3 py-2 font-medium">학년도</th>
            <th scope="col" className="px-3 py-2 font-medium">학교</th>
            <th scope="col" className="px-3 py-2 font-medium">학년</th>
            <th scope="col" className="px-3 py-2 font-medium">시험</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">문항</th>
            <th scope="col" className="px-3 py-2 font-medium">올린 날</th>
            <th scope="col" className="w-10 px-2 py-2"><span className="sr-only">지우기</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => {
            const warnings = row.ocr_meta?.warnings?.length ?? 0;
            return (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="max-w-80 px-3 py-2">
                  <Link
                    href={`/problems/sources/${row.id}`}
                    className="font-medium text-gray-900 underline-offset-2 hover:text-primary hover:underline"
                  >
                    {row.title || '제목 없는 시험지'}
                  </Link>
                  {warnings > 0 && (
                    <span
                      className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900"
                      title="적재할 때 남긴 확인거리 — 시험지 화면 위쪽에 모여 있어요"
                    >
                      확인 필요 {warnings}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{row.source_type}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{row.year || EMPTY_CELL}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{schoolCell(row)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{row.grade || EMPTY_CELL}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{examCell(row)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {row.problem_count > 0 ? (
                    <span className="tabular-nums text-gray-700">{row.problem_count}</span>
                  ) : (
                    // 문항이 없는 시험지는 적재가 덜 끝난 것이다 — 숫자 0 만 두면 눈에 안 띈다
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                      문항 없음
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">{uploadedCell(row.created_at)}</td>
                <td className="px-2 py-1 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(row)}
                    disabled={deleting || refreshing}
                    className="rounded p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                    aria-label={`${row.title} 지우기`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
