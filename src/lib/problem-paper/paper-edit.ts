import { supabase } from '@/lib/supabase';
import type { PaperItemSnapshot, PaperSettings, ProblemPaper } from '@/types/problem-bank';
import type { PaperEditEntry, StoredPaperItem } from './edit-items';
import { normalizePaperSettings } from './settings';

/**
 * 문제지 고치기 — 읽기 · 고칠 수 있는지 묻기 · 저장 (sql/103 의 두 RPC).
 *
 * 쓰기는 여전히 RPC 뿐이다(표에 INSERT·UPDATE 정책이 없다). 거절은 SQLSTATE 대신 **HINT 토큰**으로 가른다 —
 * 같은 42501 이 '작성자 아님' 과 '책에 담김' 두 뜻이다.
 */

/** 항목 읽기 상한 — RPC 상한(200) 위로 넉넉히. 잘려 읽히면 아래 문항 수 대조가 잡는다 */
const PAPER_ITEMS_READ_LIMIT = 300;

/** 상태 RPC 가 한 번에 받는 문제지 수 — ⚠️ sql/103 problem_paper_edit_states 의 상한과 같아야 한다 */
export const PAPER_EDIT_STATES_MAX = 200;

/** 고칠 수 없는 까닭 — ⚠️ sql/103 의 HINT 토큰과 같아야 한다(paper-edit-policy.test 가 대조한다) */
export const PAPER_EDIT_BLOCKS = ['not_owner', 'in_book', 'graded', 'grade_check_failed'] as const;
export type PaperEditBlock = (typeof PAPER_EDIT_BLOCKS)[number];

/** 까닭마다 사람에게 보일 말 */
export const PAPER_EDIT_BLOCK_MESSAGES: Record<PaperEditBlock, string> = {
  not_owner: '이 문제지를 만든 선생님과 원장님만 고칠 수 있어요.',
  in_book: '원장님 책에 담긴 문제지라 원장님만 고칠 수 있어요.',
  graded: '이미 OMR 로 채점한 시험이라 고칠 수 없어요. 고쳐야 하면 새 문제지로 만들어 주세요.',
  grade_check_failed: '학원 성적에서 채점했는지 확인하지 못해 지금은 고칠 수 없어요. 잠시 뒤 다시 해 주세요.',
};

/** 문제지 한 장의 고치기 상태 */
export interface PaperEditState {
  /** null 이면 지금 사람이 고칠 수 있다 */
  reason: PaperEditBlock | null;
  /** 원장님 책에 담겼는가 */
  inBook: boolean;
  /** OMR 문제지를 고쳤는데 학원 성적 정답표에 아직 반영되지 않았는가 */
  pending: boolean;
  /** 평가문제집 문항이 들어 있는가 — 평가문제집이 보이는 책 쪽 고치기 화면으로 연다 */
  workbook: boolean;
}

/**
 * 고치기 화면 주소 — 책에 담겼거나 평가문제집 문항이 든 문제지는 책 쪽(원장 전용, 평가문제집이 보인다), 아니면 문제 은행 쪽.
 * 평가문제집 문항이 든 문제지를 문제 은행 쪽에서 열면 그 문항을 다시 담을 길이 없다(코덱스 9R).
 * @param paperId - 문제지 id
 * @param state - 고치기 상태
 * @returns 주소
 */
export function paperEditHref(paperId: string, state: Pick<PaperEditState, 'inBook' | 'workbook'>): string {
  return state.inBook || state.workbook ? `/books/papers/${paperId}/edit` : `/problems/papers/${paperId}/edit`;
}

/** 다른 곳(다른 탭·다른 선생님)에서 먼저 고쳤다 */
export class PaperEditConflictError extends Error {
  constructor() {
    super('다른 곳에서 이 문제지가 바뀌었어요. 저장된 것을 다시 불러온 뒤 고쳐 주세요.');
    this.name = 'PaperEditConflictError';
  }
}

/** 고칠 수 없는 문제지다 — 까닭은 `reason` */
export class PaperEditBlockedError extends Error {
  readonly reason: PaperEditBlock;

  constructor(reason: PaperEditBlock) {
    super(PAPER_EDIT_BLOCK_MESSAGES[reason]);
    this.name = 'PaperEditBlockedError';
    this.reason = reason;
  }
}

/** 문제지가 없다(지워졌다) */
export class PaperMissingError extends Error {
  constructor() {
    super('문제지를 찾지 못했어요. 지워졌을 수 있어요.');
    this.name = 'PaperMissingError';
  }
}

/** 고치기 화면이 읽은 문제지 */
export interface PaperEditData {
  /** ⚠️ `updated_at` 은 PostgREST 가 준 글자 그대로다 — 낙관적 잠금 값이라 Date 를 거치면 마이크로초가 잘린다 */
  paper: ProblemPaper;
  items: StoredPaperItem[];
}

interface ItemRow {
  id: string;
  order_index: number;
  problem_id: string | null;
  snapshot: PaperItemSnapshot;
}

/**
 * 고칠 문제지를 읽는다.
 *
 * ⚠️ **문제지 행을 먼저, 항목을 그 뒤에** 읽는다(동시에 읽지 않는다). 그 사이 남이 고쳤으면 내 손의 버전이 낡아
 *    저장이 충돌로 잡힌다. 반대 차례면 새 버전 + 옛 항목이 되어, 남이 더한 문항이 버전 검사를 통과한 채 지워진다.
 * @param paperId - 문제지 id
 * @returns 문제지와 항목. 문제지가 없으면 null
 * @throws 조회 실패·문항 수가 안 맞을 때
 */
export async function fetchPaperForEdit(paperId: string): Promise<PaperEditData | null> {
  const paperRes = await supabase.from('problem_papers').select('*').eq('id', paperId).maybeSingle();
  if (paperRes.error) throw paperRes.error;
  if (!paperRes.data) return null;

  const itemRes = await supabase.from('problem_paper_items')
    .select('id, order_index, problem_id, snapshot')
    .eq('paper_id', paperId).order('order_index').limit(PAPER_ITEMS_READ_LIMIT);
  if (itemRes.error) throw itemRes.error;

  const row = paperRes.data as ProblemPaper;
  const items = ((itemRes.data ?? []) as ItemRow[]).map((r) => ({
    id: r.id, orderIndex: r.order_index, problemId: r.problem_id, snapshot: r.snapshot,
  }));
  // 행과 항목 사이에 누가 고쳤으면 수가 어긋날 수 있다 — 그 상태로 고치면 충돌로 끝나니 다시 읽게 한다
  if (items.length !== row.total_questions) {
    throw new Error('문제지를 읽는 사이에 내용이 바뀌었어요. 다시 불러와 주세요.');
  }
  return { paper: { ...row, settings: normalizePaperSettings(row.settings) }, items };
}

function isBlock(value: unknown): value is PaperEditBlock {
  return typeof value === 'string' && (PAPER_EDIT_BLOCKS as readonly string[]).includes(value);
}

/**
 * 상태 RPC 의 응답을 읽는다 — 모양이 어긋난 문제지는 **고칠 수 없음**으로 친다(화면이 단추를 내주지 않게).
 * @param raw - `{ "<id>": { reason, in_book, pending } }`
 * @returns 문제지 id → 상태
 */
export function parsePaperEditStates(raw: unknown): Map<string, PaperEditState> {
  const out = new Map<string, PaperEditState>();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    const reason = v.reason === null ? null : isBlock(v.reason) ? v.reason : 'grade_check_failed';
    out.set(id, { reason, inBook: v.in_book === true, pending: v.pending === true, workbook: v.workbook === true });
  }
  return out;
}

/**
 * 문제지들을 지금 사람이 고칠 수 있는지 묻는다.
 * @param paperIds - 문제지 id 들
 * @returns 문제지 id → 상태(없는 문제지는 빠진다)
 * @throws 조회 실패 시
 */
export async function fetchPaperEditStates(paperIds: readonly string[]): Promise<Map<string, PaperEditState>> {
  const out = new Map<string, PaperEditState>();
  for (let i = 0; i < paperIds.length; i += PAPER_EDIT_STATES_MAX) {
    const chunk = paperIds.slice(i, i + PAPER_EDIT_STATES_MAX);
    // POST 로 부른다(supabase .rpc() 기본값) — 함수가 VOLATILE 이다
    const { data, error } = await supabase.rpc('problem_paper_edit_states', { p_paper_ids: chunk });
    if (error) throw error;
    for (const [id, state] of parsePaperEditStates(data)) out.set(id, state);
  }
  return out;
}

/** PostgREST 오류에서 사람이 볼 오류로 */
export function paperEditError(error: { message?: string; hint?: string | null; code?: string }): Error {
  if (error.hint === 'conflict') return new PaperEditConflictError();
  if (error.hint === 'missing') return new PaperMissingError();
  if (isBlock(error.hint)) return new PaperEditBlockedError(error.hint);
  return new Error(error.message || '저장하지 못했어요.');
}

/** 고치기 요청 */
export interface PaperUpdateInput {
  paperId: string;
  /** 읽어 둔 문제지 `updated_at` — 글자 그대로 */
  expectUpdatedAt: string;
  title: string;
  entries: PaperEditEntry[];
  settings: Pick<PaperSettings, 'columns' | 'showSource'>;
}

/** 고치기 결과 */
export interface PaperUpdateResult {
  updatedAt: string;
  totalQuestions: number;
  /** 같은 지문 묶음의 기존 지문 판을 물려받았는데 지금 원본 지문과 다른 자리(1부터) */
  passageChanged: number[];
}

function parseUpdateResult(raw: unknown): PaperUpdateResult {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const changed = Array.isArray(v.passage_changed) ? v.passage_changed.filter((n): n is number => typeof n === 'number') : [];
  return {
    updatedAt: typeof v.updated_at === 'string' ? v.updated_at : '',
    totalQuestions: typeof v.total_questions === 'number' ? v.total_questions : 0,
    passageChanged: changed,
  };
}

/**
 * 문제지를 고친다.
 * @param input - 고칠 내용
 * @returns 새 버전·문항 수·지문 판이 다른 자리
 * @throws 충돌(`PaperEditConflictError`) · 막힘(`PaperEditBlockedError`) · 없음(`PaperMissingError`) · 그 밖의 검사 실패
 */
export async function updatePaper(input: PaperUpdateInput): Promise<PaperUpdateResult> {
  const { data, error } = await supabase.rpc('update_problem_paper', {
    p_paper_id: input.paperId,
    p_expect_updated_at: input.expectUpdatedAt,
    p_title: input.title.trim(),
    p_entries: input.entries,
    p_settings: { columns: input.settings.columns, showSource: input.settings.showSource },
  });
  if (error) throw paperEditError(error);
  return parseUpdateResult(data);
}

/**
 * 문항들의 **지금** 지문 id — '최신 지문으로' 가 캔버스를 지금 원본 기준으로 다시 묶을 때(서버가 새 문항을 묶는 기준).
 * @param problemIds - 문항 id 들(한 지문 묶음이라 많지 않다)
 * @returns 문항 id → 지문 id(지문 없으면 null). 없는 문항(원본이 지워짐)은 빠진다
 * @throws 조회 실패 시
 */
export async function fetchLivePassageIds(problemIds: readonly string[]): Promise<Map<string, string | null>> {
  if (problemIds.length === 0) return new Map();
  const { data, error } = await supabase.from('problems').select('id, passage_id').in('id', [...problemIds]);
  if (error) throw error;
  return new Map(((data ?? []) as { id: string; passage_id: string | null }[]).map((r) => [r.id, r.passage_id]));
}
