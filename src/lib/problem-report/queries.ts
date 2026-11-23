import { supabase } from '@/lib/supabase';
import type { PaperItemSnapshot } from '@/types/problem-bank';
import { parseReportState, type ReportState } from './display';
import type { ProblemReport, ReportCategory, ReportStatus } from './types';

/**
 * 문제 은행 오류 신고 조회·쓰기(브라우저, 사용자 세션).
 * 쓰기는 RPC 둘뿐이다 — 표에는 브라우저 INSERT·UPDATE 권한이 없다(sql/113).
 */

/** 한 번에 보여 줄 신고 수 */
export const REPORT_LIST_LIMIT = 200;

/** 신고 요청 — 문제지 항목이나 문항 중 하나 */
export interface ReportInput {
  category: ReportCategory;
  note: string;
  paperItemId?: string;
  /** 문제지 항목이면 화면이 보고 있는 문제지 판(`updated_at`) — 다르면 RPC 가 거절한다(번호가 어긋난다) */
  paperRevision?: string;
  problemId?: string;
  /** 태그·출처 신고면 창이 보여 준 지금 상태의 지문(`ReportState.token`) — 굳힐 값과 다르면 RPC 가 거절한다(sql/114) */
  stateToken?: string;
}

/**
 * 신고한다.
 * @param input - 종류·내용·대상
 * @returns 새 신고 id
 * @throws 저장 실패 시(RPC 오류 문구를 그대로)
 */
export async function submitProblemReport(input: ReportInput): Promise<string> {
  const { data, error } = await supabase.rpc('report_problem', {
    p_category: input.category,
    p_note: input.note,
    p_problem_id: input.problemId ?? null,
    p_paper_item_id: input.paperItemId ?? null,
    p_paper_revision: input.paperRevision ?? null,
    p_state_token: input.stateToken ?? null,
  });
  if (error) throw new Error(error.message);
  if (typeof data !== 'string') throw new Error('신고를 저장하지 못했어요.');
  return data;
}

/**
 * 문항의 지금 상태(태그 넷 + 출처 + 지문) — 태그·출처 신고 창이 보여 주고 지문을 실어 보낸다(sql/114).
 * @param problemId - 문항 id
 * @returns 지금 상태
 * @throws 읽기 실패·모양이 다를 때
 */
export async function fetchReportState(problemId: string): Promise<ReportState> {
  const { data, error } = await supabase.rpc('problem_report_state', { p_problem_id: problemId });
  if (error) throw new Error(error.message);
  const state = parseReportState(data);
  if (!state) throw new Error('문항의 지금 태그를 읽지 못했어요.');
  return state;
}

/**
 * 신고 목록 — 접수 중(open) 또는 처리됨(고침·반려), 최근 것부터.
 * @param tab - 'open' · 'closed'
 * @returns 신고들
 * @throws 조회 실패 시
 */
export async function fetchProblemReports(tab: 'open' | 'closed'): Promise<ProblemReport[]> {
  const request = supabase.from('problem_reports').select('*');
  const filtered = tab === 'open' ? request.eq('status', 'open') : request.in('status', ['fixed', 'rejected']);
  const { data, error } = await filtered
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(REPORT_LIST_LIMIT);
  if (error) throw error;
  return (data ?? []) as unknown as ProblemReport[];
}

/**
 * 처리한다(원장만 — DB 가 막는다).
 * @param id - 신고 id
 * @param status - 고침·반려, 되돌리면 접수 중
 * @param note - 처리 메모
 * @throws 처리 실패 시
 */
export async function resolveProblemReport(id: string, status: ReportStatus, note = ''): Promise<void> {
  const { error } = await supabase.rpc('resolve_problem_report', { p_id: id, p_status: status, p_note: note });
  if (error) throw new Error(error.message);
}

/**
 * 같은 문항에 접수 중인 신고 수 — 신고 창이 '이미 N건 신고돼 있어요' 를 알린다.
 * @param problemId - 문항 id
 * @returns 건수(못 읽으면 0 — 곁가지라 막지 않는다)
 */
export async function countOpenReports(problemId: string): Promise<number> {
  const { count, error } = await supabase.from('problem_reports')
    .select('id', { count: 'exact', head: true }).eq('problem_id', problemId).eq('status', 'open');
  return error ? 0 : count ?? 0;
}

/** 문제지 항목 하나 — 신고 창이 번호를 고르게 한다 */
export interface PaperItemRef {
  id: string;
  problem_id: string | null;
  snapshot: PaperItemSnapshot;
}

/** 문제지 항목 읽기 결과 — `stale` 이면 화면이 보고 있는 판과 지금 판이 다르다 */
export interface PaperItemRead {
  items: PaperItemRef[];
  stale: boolean;
}

/**
 * 문제지 항목들 — 자리 차례대로(인쇄 번호 = 배열 차례 + 1). 항목을 읽은 **뒤** 문제지 판을 다시 읽어 화면의 판과 견준다
 * (읽는 사이 고쳐졌으면 그 항목 차례는 화면과 다르다 — 보내기 라우트의 '항목 뒤 판 재확인' 과 같은 차례).
 * @param paperId - 문제지 id
 * @param revision - 화면이 보고 있는 문제지 판(`updated_at`, PostgREST 글자 그대로)
 * @returns 항목들과 판이 달라졌는가
 * @throws 조회 실패 시
 */
export async function fetchPaperItemRefs(paperId: string, revision: string): Promise<PaperItemRead> {
  const { data, error } = await supabase.from('problem_paper_items')
    .select('id, problem_id, snapshot').eq('paper_id', paperId).order('order_index', { ascending: true });
  if (error) throw error;
  const { data: paper, error: paperError } = await supabase.from('problem_papers')
    .select('updated_at').eq('id', paperId).maybeSingle();
  if (paperError) throw paperError;
  const now = (paper as { updated_at?: string } | null)?.updated_at;
  return { items: (data ?? []) as unknown as PaperItemRef[], stale: now !== revision };
}

/**
 * 문항들의 출처 id — 신고 목록의 '시험지에서 보기' 링크가 쓴다.
 * @param problemIds - 문항 id 들
 * @returns 문항 id → 출처 id (못 읽으면 빈 지도)
 */
export async function fetchProblemSourceIds(problemIds: readonly string[]): Promise<Map<string, string>> {
  const ids = [...new Set(problemIds)];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase.from('problems').select('id, source_id').in('id', ids);
  if (error) return map;
  for (const row of (data ?? []) as { id: string; source_id: string }[]) map.set(row.id, row.source_id);
  return map;
}

/** 문항이 원본 시험지의 어디에 있나 — 신고 창이 그 쪽 이미지를 보여 준다 */
export interface ProblemOrigin {
  sourceId: string;
  /** 문항이 실린 쪽(1부터) */
  pageNo: number;
  /** 원본의 쪽 수 — 앞뒤 쪽 넘기기의 끝 */
  pageCount: number;
  sourceType: string;
}

/**
 * 문항의 원본 쪽 — 문항 + 출처 한 번 조회(2026-11-22 원장 요청 "오류 신고할 때 그 시험지(원본 사진)를 보여 주면").
 * 쪽 이미지는 적재 때 만든 `sources/{id}/pages/{n}.jpg` 다(읽기 전용 시험 보기의 원본 탭과 같다).
 * @param problemId - 문항 id
 * @returns 원본 쪽. 문항이 없거나(지워졌다) 쪽 정보가 비었으면 null
 * @throws 조회 실패 시(창은 '원본을 불러오지 못했어요' 로 알리고 신고는 막지 않는다)
 */
export async function fetchProblemOrigin(problemId: string): Promise<ProblemOrigin | null> {
  const { data, error } = await supabase.from('problems')
    .select('page_no, source:problem_sources!inner(id, page_count, source_type)')
    .eq('id', problemId).maybeSingle();
  if (error) throw error;
  const row = data as { page_no?: unknown; source?: { id?: unknown; page_count?: unknown; source_type?: unknown } | null } | null;
  const source = row?.source;
  const pageNo = row?.page_no;
  const pageCount = source?.page_count;
  if (typeof source?.id !== 'string' || typeof pageNo !== 'number' || typeof pageCount !== 'number') return null;
  if (!Number.isInteger(pageNo) || !Number.isInteger(pageCount) || pageNo < 1 || pageNo > pageCount) return null;
  return { sourceId: source.id, pageNo, pageCount, sourceType: typeof source.source_type === 'string' ? source.source_type : '' };
}
