import { normalizeCategoryName } from '@/lib/category-name';
import { semesterDigit } from './scope-pick';
import { normalizeWorkTitle } from './work-title';

/**
 * 이 학교에 **이미 적혀 있는 작품명**을 모아 업로드 폼의 작품 칸을 채운다 (순수 함수).
 *
 * 작품 마스터 표는 없고 만들 생각도 없다(`work-tree.ts` 규약 — 작품은 시험지에 실려야
 * 비로소 생긴다). 그래서 후보는 **이미 쌓인 데이터에서 파생**한다:
 *  ① 학교 프린트 시험지의 프린트 이름(`print_bundles.name`) — 선생님이 직접 친 작품명이다
 *     ('2026 광희중학교 중2 2학기 중간 홍길동전' 의 '홍길동전').
 *  ② 같은 학교 기출 지문의 제목·지은이(`passages.title`/`author`).
 *
 * ⚠️ 관리자시스템 내신 관리의 `scope` 자유 텍스트는 **쓰지 않는다.** 화면 도움말은
 *    '외부 지문 「봄봄」(김유정)' 을 예로 들지만 운영 데이터에는 그 표기가 한 줄도 없다
 *    (2026-09-15 확인: 7행 중 0행) — 없는 것을 파싱하면 코드만 늘고 후보는 안 는다.
 */

/** 폼에 넣을 후보 하나 */
export interface WorkCandidate {
  /** 표준 표기 작품명 */
  title: string;
  /** 지은이. 모르면 '' */
  author: string;
  /** 무엇을 보고 골랐는가 — 화면이 그대로 밝힌다 */
  basis: string;
}

/** 프린트 묶음 한 줄 (그 묶음이 딸린 스캔의 제목까지) */
export interface BundleWorkRow {
  name: string;
  scanTitle: string;
  year: string;
  grade: string;
  semester: string;
  examType: string;
}

/** 같은 학교 기출 지문 한 줄 (그 출처의 분류까지) */
export interface PassageWorkRow {
  title: string;
  author: string;
  year: string;
  grade: string;
  semester: string;
  examType: string;
}

/** 폼이 고른 조건 (표시값 그대로) */
export interface WorkWanted {
  year: string;
  grade: string;
  semester: string;
  examType: string;
}

/** 후보를 몇 개까지 — 칸이 한 줄이라 더 넣으면 아무도 안 읽는다 */
export const WORK_CANDIDATE_MAX = 20;

/** 폼 칸의 구분자 — 쉼표·가운뎃점·줄바꿈 (선생님이 셋 다 쓴다) */
const HINT_SEPARATOR = /[,\n·]/;

/**
 * 프린트 이름에서 **작품 부분만** 떼어 낸다.
 *
 * 저장되는 이름은 `composePrintName` = `normalizeCategoryName(스캔제목 + ' ' + 프린트별이름)`
 * 이므로, 정규화한 스캔 제목을 접두에서 벗기면 프린트별 이름이 남는다.
 *
 * ⚠️ `print-scan/` 을 import 하지 않는다 — 그 배럴이 `run.ts` 를 다시 내보내 순환이 된다
 *    (`import-cycles.test.ts` 가 잡는다). 같은 규칙을 `normalizeCategoryName` 으로 재현한다.
 * @param bundleName - 저장된 프린트 이름
 * @param scanTitle - 그 묶음이 딸린 스캔 제목
 * @returns 작품 부분. 스캔 제목뿐이면(프린트 한 장짜리) 빈 문자열
 */
export function printLabelOf(bundleName: string, scanTitle: string): string {
  const name = normalizeCategoryName(bundleName);
  const prefix = normalizeCategoryName(scanTitle);
  if (!prefix || !name.startsWith(prefix)) return name === prefix ? '' : name;
  return name.slice(prefix.length).trim();
}

/**
 * 조건과 얼마나 가까운가 — 작을수록 가깝다. 후보에서 빼려면 null.
 *
 * 교과서 힌트(`scope-pick.ts`)와 달리 **학년이 다르면 아예 뺀다**. 교과서는 학교마다 하나로
 * 정해지지만 작품은 학년마다 통째로 다르다 — 중1 작품을 중3 시험지 후보로 주면 모델이
 * 엉뚱한 작품에 맞춰 읽는다.
 */
function rank(row: { year: string; grade: string; semester: string; examType: string },
  wanted: WorkWanted): number | null {
  if (wanted.grade && row.grade && row.grade !== wanted.grade) return null;
  const sameYear = !wanted.year || !row.year || row.year === wanted.year;
  const sameSemester = !wanted.semester || !row.semester
    || semesterDigit(row.semester) === semesterDigit(wanted.semester);
  const sameExam = !wanted.examType || !row.examType || row.examType === wanted.examType;
  // 학년도 → 학기 → 시험 순으로 무게를 준다(앞 칸이 절대 우선)
  return (sameYear ? 0 : 4) + (sameSemester ? 0 : 2) + (sameExam ? 0 : 1);
}

/** 그 줄이 어느 시험 것인지 한 줄로 — '2026 중2 2학기 중간' */
function describeSlot(row: { year: string; grade: string; semester: string; examType: string }): string {
  const parts = [row.year, row.grade, row.semester, row.examType].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '분류 없음';
}

/** 모으는 동안 쓰는 중간 모양 */
interface Scored extends WorkCandidate {
  rank: number;
}

/** 둘 중 더 가까운(등급이 작은) 쪽 */
const closer = (a: Scored, b: Scored): Scored => (b.rank < a.rank ? b : a);

/**
 * 중복을 없앤다 — 더 가까운(작은) 등급이 이긴다.
 *
 * 키는 **제목 + 지은이**다. 제목만으로 묶으면 같은 이름의 다른 작품(동명이작)이 하나로
 * 접혀 지은이 구분이 사라지는데, 그 구분이 바로 모델에게 어느 작품인지 알려 주는 단서다
 * (코덱스 리뷰 1R).
 *
 * 그다음 **지은이가 빈 줄을 같은 제목의 지은이 있는 줄에 합친다** — 프린트 이름에는 지은이가
 * 없어서(작품명만 적는다) 그대로 두면 '동백꽃' 과 '동백꽃 (김유정)' 이 나란히 실려 모델이
 * 둘을 다른 작품으로 본다.
 *
 * ⚠️ 합칠 때 **가까운 쪽의 등급과 근거를 가져온다**(코덱스 리뷰 2R). 그냥 지우면 올해 이 시험
 *    프린트의 '동백꽃'(등급 0)이 사라지고 작년 기출의 '동백꽃 (김유정)'(등급 4)만 남아,
 *    **가장 가까운 작품이 뒤로 밀리고** 근거도 작년 것으로 바뀐다. 상한(20)에 걸려 아예
 *    빠질 수도 있다.
 * ⚠️ 같은 제목에 **지은이가 둘 이상**이면(진짜 동명이작) 합치지 않는다 — 지은이 없는 줄이
 *    그중 누구 것인지 알 수 없어서, 아무 쪽에나 붙이면 근거가 거짓이 된다.
 */
function dedupe(rows: Scored[]): Scored[] {
  const best = new Map<string, Scored>();
  for (const row of rows) {
    const key = `${row.title}\u0000${row.author}`;
    const prev = best.get(key);
    if (!prev || row.rank < prev.rank) best.set(key, row);
  }

  const byTitle = new Map<string, Scored[]>();
  for (const row of best.values()) {
    byTitle.set(row.title, [...(byTitle.get(row.title) ?? []), row]);
  }

  const out: Scored[] = [];
  for (const group of byTitle.values()) {
    const named = group.filter((r) => r.author);
    const anon = group.find((r) => !r.author);
    if (named.length === 1 && anon) {
      const near = closer(named[0], anon);
      out.push({ ...named[0], rank: near.rank, basis: near.basis });
      continue;
    }
    out.push(...group);
  }
  return out;
}

/**
 * 이미 있는 데이터에서 작품 후보를 줄 세운다.
 * @param input - 프린트 묶음·기출 지문·폼 조건
 * @returns 가까운 순 → 한글 사전순 후보 (상한 `WORK_CANDIDATE_MAX`)
 */
export function rankWorkCandidates(input: {
  bundles: readonly BundleWorkRow[];
  passages: readonly PassageWorkRow[];
  wanted: WorkWanted;
}): WorkCandidate[] {
  const { bundles, passages, wanted } = input;
  const scored: Scored[] = [];

  for (const row of bundles) {
    const score = rank(row, wanted);
    if (score === null) continue;
    const title = normalizeWorkTitle(printLabelOf(row.name, row.scanTitle));
    if (!title) continue;
    scored.push({ title, author: '', rank: score, basis: `학교 프린트 ${describeSlot(row)}` });
  }

  for (const row of passages) {
    const score = rank(row, wanted);
    if (score === null) continue;
    const title = normalizeWorkTitle(row.title);
    if (!title) continue;
    scored.push({
      title,
      author: normalizeWorkTitle(row.author),
      rank: score,
      basis: `이 학교 기출 ${describeSlot(row)}`,
    });
  }

  return dedupe(scored)
    .sort((a, b) => (a.rank - b.rank) || a.title.localeCompare(b.title, 'ko'))
    .slice(0, WORK_CANDIDATE_MAX)
    .map(({ title, author, basis }) => ({ title, author, basis }));
}

/**
 * 후보 하나를 칸에 적을 모양으로 — '동백꽃 (김유정)'.
 * @param candidate - 후보
 * @returns 표시 문자열
 */
export function workCandidateLabel(candidate: WorkCandidate): string {
  return candidate.author ? `${candidate.title} (${candidate.author})` : candidate.title;
}

/**
 * 후보 목록을 폼 칸 값으로.
 * @param candidates - 후보 목록
 * @returns 쉼표로 이은 문자열 (비면 '')
 */
export function candidateInputValue(candidates: readonly WorkCandidate[]): string {
  return candidates.map(workCandidateLabel).join(', ');
}

/**
 * 근거를 한 줄로 — 같은 근거가 여럿이면 접는다.
 * @param candidates - 후보 목록
 * @returns 근거 문자열 (비면 '')
 */
export function describeWorkBasis(candidates: readonly WorkCandidate[]): string {
  return [...new Set(candidates.map((c) => c.basis))].join(' · ');
}

/**
 * 폼 칸의 글을 프롬프트에 실을 목록으로.
 *
 * 칸 값은 사람이 고치는 자유 텍스트라 구분자가 제각각이다. 괄호 안 지은이는 **그대로 둔다** —
 * 모델이 동명이작을 가릴 단서다.
 * @param text - 작품 칸 값
 * @returns 후보 목록 (공백 정리·중복 제거)
 */
export function toWorkHints(text: string): string[] {
  const seen = new Set<string>();
  for (const part of (text ?? '').split(HINT_SEPARATOR)) {
    const value = normalizeCategoryName(part);
    if (value) seen.add(value);
  }
  return [...seen].slice(0, WORK_CANDIDATE_MAX);
}
