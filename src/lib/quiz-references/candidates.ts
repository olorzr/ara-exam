import { supabase } from '@/lib/supabase';
import { escapeIlike } from '@/lib/problem-bank/queries';
import { splitWorkTitles } from '@/lib/problem-bank/work-title';
import { searchPassagesByTitle, type PassagePickRow } from '@/lib/problem-bank/passage-search';
import { searchReferenceTexts } from '@/lib/reference-texts/queries';
import type { ReferenceTextListItem } from '@/types/reference-text';
import { QUIZ_REFERENCE_CANDIDATE_LIMIT } from './constants';
import {
  passageLabel, passageSubtitle, sheetKind, sheetLabel, sheetSubtitle, textLabel, textSubtitle,
  type SheetLabelRow,
} from './labels';
import type { CandidateHit, MatchSignal, QuizMatchSignals } from './types';

/**
 * 신호로 참고자료 후보를 찾는다.
 *
 * ⚠️ **`.or()` 를 쓰지 않는다** — 이스케이프가 인용을 통과하며 풀린다(`queries.ts` 와 같은
 *    이유). 신호마다 쿼리를 하나씩 만들어 병렬로 돌리고, 같은 자료가 여러 번 와도
 *    `rankReferenceCandidates` 가 `key` 로 합친다.
 *
 * ⚠️ **본문을 읽지 않는다.** 여기서 읽으면 후보 스무 줄이 전부 수만 자씩 실려 온다 —
 *    본문은 실제로 붙인 것만 `bodies.ts` 가 따로 읽는다.
 *
 * ⚠️ 한 신호가 실패해도 **멈추지 않는다**(`allSettled`). 참고자료는 문제 만들기를 돕는
 *    곁가지라, 조회 하나가 실패했다고 본 기능을 막으면 안 된다 — 몇 개가 실패했는지만 알린다.
 */

/** 개념지 목록 컬럼. ⚠️ 한 줄로 둘 것 — `+` 로 이으면 PostgREST 행 타입 추론이 풀린다 */
const SHEET_COLUMNS = 'id,title,year,grade,publisher,unit,subunit,school_name,print_bundle_id,updated_at';

/** 개념지 한 행 — 조회 결과의 모양 */
type SheetRow = SheetLabelRow & { id: string; updated_at: string };

/** 찾은 것들과 실패한 조회 수 */
export interface CandidateResult {
  hits: CandidateHit[];
  /** 실패한 조회 수 — 0 이 아니면 "일부를 못 찾았다" 고 알린다 */
  failures: number;
}

/** 개념지 조회의 기본 꼴 */
function sheetQuery() {
  return supabase
    .from('concept_sheets')
    .select(SHEET_COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(QUIZ_REFERENCE_CANDIDATE_LIMIT);
}

/**
 * 개념지 행들을 후보 알갱이로.
 * @param rows - 조회 결과
 * @param signal - 무엇을 보고 찾았는가
 * @param detail - 사람에게 보일 까닭
 * @returns 후보 알갱이들
 */
function sheetHits(rows: SheetRow[], signal: MatchSignal, detail: string): CandidateHit[] {
  return rows.map((row) => ({
    candidate: {
      key: `${sheetKind(row)}:${row.id}`,
      kind: sheetKind(row),
      id: row.id,
      label: sheetLabel(row),
      subtitle: sheetSubtitle(row),
      updatedAt: row.updated_at,
    },
    hit: { signal, detail },
  }));
}

/**
 * 기출 지문 줄들을 후보 알갱이로.
 * @param rows - 지문 줄들
 * @param detail - 사람에게 보일 까닭
 * @returns 후보 알갱이들
 */
export function passageHits(rows: PassagePickRow[], detail: string): CandidateHit[] {
  return rows.map((row) => ({
    candidate: {
      key: `passage:${row.id}`,
      kind: 'passage' as const,
      id: row.id,
      label: passageLabel(row),
      subtitle: passageSubtitle(row),
      // 지문 목록에는 updated_at 이 없다 — 점수가 같으면 제목 순으로 밀린다(순서만의 문제다)
      updatedAt: '',
    },
    hit: { signal: 'title' as const, detail },
  }));
}

/**
 * 작품 전문 줄들을 후보 알갱이로.
 * @param rows - 전문 목록 줄들
 * @param signal - 무엇을 보고 찾았는가
 * @param detail - 사람에게 보일 까닭
 * @returns 후보 알갱이들
 */
export function textHits(
  rows: ReferenceTextListItem[], signal: MatchSignal, detail: string,
): CandidateHit[] {
  return rows.map((row) => ({
    candidate: {
      key: `text:${row.id}`,
      kind: 'text' as const,
      id: row.id,
      label: textLabel(row),
      subtitle: textSubtitle(row),
      updatedAt: row.updated_at,
    },
    hit: { signal, detail },
  }));
}

/**
 * 신호에 맞는 자료 후보를 모은다.
 * @param signals - 찾기 신호
 * @returns 후보 알갱이들과 실패한 조회 수
 */
export async function fetchReferenceCandidates(
  signals: QuizMatchSignals,
): Promise<CandidateResult> {
  const jobs: (() => Promise<CandidateHit[]>)[] = [];

  // ⚠️ **작품마다 따로 찾는다**(sql/33). `(가)(나)` 지문을 불러오면 작품명 칸이
  //    '먼 후일 · 독은 아름답다' 처럼 이어 붙은 값인데, 그대로 `ilike` 하면 그런 이름의
  //    자료는 없어 **하나도 안 걸린다** — 두 작품의 개념지가 다 있는데도 그렇다.
  //    같은 자료가 두 작품으로 걸려 와도 `rankReferenceCandidates` 가 신호를 한 번만 센다
  for (const title of splitWorkTitles(signals.title)) {
    const pattern = `%${escapeIlike(title)}%`;

    jobs.push(async () => {
      const { data, error } = await sheetQuery().ilike('title', pattern);
      if (error) throw error;
      return sheetHits((data ?? []) as SheetRow[], 'title', `제목에 '${title}'`);
    });

    // 본문에 작품명이 나오는 개념지 — 제목이 '1단원 정리' 인 개념지가 이 길로 걸린다.
    // 본문은 **서버에서만** 훑는다(컬럼에 담아 오지 않는다)
    jobs.push(async () => {
      const { data, error } = await sheetQuery().ilike('editor_html', pattern);
      if (error) throw error;
      return sheetHits((data ?? []) as SheetRow[], 'body', `본문에 '${title}'`);
    });

    jobs.push(async () => {
      const rows = await searchReferenceTexts(title, 'title', QUIZ_REFERENCE_CANDIDATE_LIMIT);
      return textHits(rows, 'title', `제목에 '${title}'`);
    });

    jobs.push(async () => {
      const rows = await searchPassagesByTitle(
        title, signals.excludePassageId, QUIZ_REFERENCE_CANDIDATE_LIMIT,
      );
      return passageHits(rows, `제목에 '${title}'`);
    });
  }

  for (const author of splitWorkTitles(signals.author)) {
    jobs.push(async () => {
      const rows = await searchReferenceTexts(author, 'author', QUIZ_REFERENCE_CANDIDATE_LIMIT);
      return textHits(rows, 'author', `지은이 '${author}'`);
    });
  }

  // 같은 교과서의 같은 단원 — 아카이브에서 고른 지문에만 있는 강한 신호다.
  // ⚠️ 카테고리 값은 양쪽 다 `normalizeCategoryName` 을 거쳤다는 전제다(sql/16).
  //    옛 표기로 저장된 개념지는 이 길로 안 걸리고 '직접 추가' 로 붙인다
  const [majorUnit, subUnit] = signals.unitPath;
  if (signals.textbook && majorUnit) {
    jobs.push(async () => {
      let request = sheetQuery()
        .eq('publisher', signals.textbook)
        .eq('unit', majorUnit);
      // ⚠️ **학년을 알면 반드시 좁힌다**(코덱스 리뷰 6R). 대단원 이름은 학년별로 따로 관리되는
      //    값이라(`major_chapters` 의 UNIQUE(name, publisher_id, grade, semester)) 학년이 다른
      //    같은 이름 단원이 실제로 있다. 안 좁히면 **다른 학년 개념지**가 붙고, 단원 신호만으로도
      //    문턱을 넘으므로 그 자료가 그대로 문항의 근거가 된다
      if (signals.grade) request = request.eq('grade', signals.grade);
      const { data, error } = await request;
      if (error) throw error;
      const rows = (data ?? []) as SheetRow[];
      return rows.map((row) => {
        // 소단원까지 같으면 그 사실을 까닭에 적는다(점수는 같다 — 신호 하나다)
        const same = subUnit && row.subunit === subUnit;
        const where = [signals.grade, signals.textbook, majorUnit, same ? subUnit : '']
          .filter(Boolean).join(' · ');
        return sheetHits([row], 'unit', `같은 단원 (${where})`)[0];
      });
    });
  }

  if (signals.schoolName) {
    jobs.push(async () => {
      let request = sheetQuery().eq('school_name', signals.schoolName);
      if (signals.grade) request = request.eq('grade', signals.grade);
      if (signals.year) request = request.eq('year', signals.year);
      const { data, error } = await request;
      if (error) throw error;
      const where = [signals.schoolName, signals.grade, signals.year].filter(Boolean).join(' · ');
      return sheetHits((data ?? []) as SheetRow[], 'school', `같은 학교 (${where})`);
    });
  }

  // 하나가 던져도 나머지는 살린다 — 실패한 수만 세어 알린다
  const settled = await Promise.allSettled(jobs.map((job) => job()));
  const hits: CandidateHit[] = [];
  let failures = 0;
  for (const result of settled) {
    if (result.status === 'fulfilled') hits.push(...result.value);
    else failures += 1;
  }
  // ⚠️ **자기 자신은 뺀다.** 학교 프린트의 문답에 자료를 붙일 때, 그 프린트로 만든 시험지가
  //    '같은 학교'·'제목에 …' 으로 걸려 스스로 붙는다 — 본문은 이미 프롬프트에 통째로
  //    실려 있어 두 번 싣는 셈이고, 답이 비어 있는 그 글이 근거 자료로 둔갑한다.
  //    조회마다 빼지 않고 여기서 한 번에 거르는 까닭: 개념지를 긁는 조회가 넷이라
  //    한 곳만 빠뜨려도 조용히 되살아난다
  const excluded = signals.excludeSheetId;
  return {
    hits: excluded ? hits.filter((hit) => hit.candidate.id !== excluded) : hits,
    failures,
  };
}
