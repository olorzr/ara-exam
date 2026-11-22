import { htmlToText } from '@/lib/reference-texts/body-format';
import type { PaperItemSnapshot } from '@/types/problem-bank';

/**
 * 문제 은행 오류 신고 — 종류·상태·표시 문구(순수, 서버 라우트도 쓴다).
 *
 * 원장님(2026-11-22): "문제은행에서 오류가 있는 문제들을 선생님들이 체킹할 수 있는 기능 … 대부분 문제지로 만든 다음
 * 풀리다가 찾거든? 신고하면 나한테 연락오게끔". 저장은 sql/113 의 RPC 둘(신고·처리), 연락은 api/notify-problem-report.
 * ⚠️ 종류·상태 값은 sql/113 CHECK 와 1:1 이다 — 하나를 바꾸면 둘 다.
 */

/** 신고 종류 */
export type ReportCategory = 'answer' | 'text' | 'passage' | 'figure' | 'other';

/** 신고 종류 차례와 이름표 — 고르기 칸·목록 꼬리표·원장 웍스 카드가 같은 글자를 쓴다 */
export const REPORT_CATEGORIES: readonly { value: ReportCategory; label: string }[] = [
  { value: 'answer', label: '정답 오류' },
  { value: 'text', label: '오타·글자 깨짐' },
  { value: 'passage', label: '지문·보기 문제' },
  { value: 'figure', label: '그림·표 문제' },
  { value: 'other', label: '기타' },
];

/** 종류 → 이름표 */
export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = Object.fromEntries(
  REPORT_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<ReportCategory, string>;

/**
 * 종류 값인가.
 * @param value - 받은 값
 * @returns 신고 종류면 true
 */
export function isReportCategory(value: unknown): value is ReportCategory {
  return REPORT_CATEGORIES.some((c) => c.value === value);
}

/** 처리 상태 */
export type ReportStatus = 'open' | 'fixed' | 'rejected';

/** 상태 이름표 */
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: '접수 중',
  fixed: '고침',
  rejected: '반려',
};

/** 내용 글자 수 상한 — sql/113 CHECK 와 같다 */
export const REPORT_NOTE_MAX = 1000;

/** 신고 한 건 — `exam.problem_reports` 의 행 */
export interface ProblemReport {
  id: string;
  problem_id: string | null;
  paper_id: string | null;
  paper_item_id: string | null;
  /** 신고 때의 문항 모습(문제지 항목 스냅샷과 같은 모양) */
  snapshot: PaperItemSnapshot;
  paper_title: string | null;
  printed_no: number | null;
  source_label: string | null;
  category: ReportCategory;
  note: string;
  status: ReportStatus;
  resolution_note: string;
  resolved_at: string | null;
  resolved_by: string | null;
  /** 원장에게 웍스로 닿은 때 — 비어 있으면 '알림 안 감' */
  notified_at: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

/** 미리보기 글자 수 */
const EXCERPT_MAX = 90;

/**
 * 발문 앞부분 — 목록·고르기 칸에서 어느 문항인지 알아보게.
 * @param snapshot - 문항 스냅샷
 * @returns 한 줄 평문(길면 말줄임)
 */
export function reportExcerpt(snapshot: Pick<PaperItemSnapshot, 'stem_html'> | null | undefined): string {
  const text = htmlToText(snapshot?.stem_html ?? '').replace(/\s+/g, ' ').trim();
  return text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX)}…` : text;
}

/**
 * 출처 줄에 원래 번호를 붙인다 — '2025 고1 휘경여자고등학교 2학기 기말 · 원래 12번'.
 * 문제지에서 신고한 건은 자리가 인쇄 번호('춘향전 20번')라 원본 시험지의 번호를 따로 알려야 원본에서 바로 짚는다(2026-11-22).
 * 신고 목록과 원장 웍스 카드의 '출처' 줄이 같이 쓴다.
 * @param label - 출처 줄(신고 때 굳힌 `source_label`)
 * @param number - 원본 시험지에서의 번호
 * @returns 붙인 글. 번호가 없으면 출처 줄 그대로, 출처 줄이 비면 '원래 N번'
 */
export function withOriginalNumber(label: string | null | undefined, number: unknown): string {
  const base = (label ?? '').trim();
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) return base;
  return base ? `${base} · 원래 ${number}번` : `원래 ${number}번`;
}

/**
 * 신고한 자리 — 문제지에서 했으면 '문제지 제목 17번', 문제 은행에서 했으면 '문제 은행 · 원래 17번'.
 * @param report - 신고
 * @returns 사람이 읽는 자리
 */
export function reportPlaceLabel(report: Pick<ProblemReport, 'paper_title' | 'printed_no' | 'snapshot'>): string {
  if (report.paper_title) return report.printed_no ? `${report.paper_title} ${report.printed_no}번` : report.paper_title;
  const no = report.snapshot?.number;
  return no ? `문제 은행 · 원래 ${no}번` : '문제 은행';
}
