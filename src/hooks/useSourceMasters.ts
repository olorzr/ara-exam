'use client';

import { useEffect, useRef, useState } from 'react';
import { getPublishers } from '@/lib/category-master';
import { fetchNaesinSchools } from '@/lib/naesin-scope/fetch';
import type { NaesinSchool } from '@/lib/naesin-scope/types';
import { fetchAreaSets, fetchAreaTree, pickAreaSetForGrade } from '@/lib/problem-bank/area-master';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';
import { fetchScopeHint, type ScopeHint } from '@/lib/problem-bank/scope-resolve';
import type { SourceFormValues } from '@/lib/problem-bank/source-form';
import { fetchUnitTree } from '@/lib/problem-bank/unit-master';

/**
 * 기출 업로드 폼이 쓰는 마스터들을 한 곳에서 읽는다.
 *
 * 학교는 **관리자시스템**(`public.schools`)이 단일 원본이고, 교과서·단원은 이 앱의
 * 카테고리 관리, 영역은 관리자시스템의 영역 분류 마스터다.
 *
 * ⚠️ 어느 하나를 못 읽어도 화면을 막지 않는다 — 그 칸이 비어 보일 뿐 업로드는 된다.
 * ⚠️ 학교급을 빠르게 오가면 먼저 보낸 요청이 늦게 도착해 현재 목록을 덮을 수 있어
 *    취소 가드를 둔다(NaesinScopeLoader 와 같은 방식).
 */
/** 아직 못 읽었을 때 돌려줄 빈 트리 — 참조가 바뀌지 않게 하나만 둔다 */
const EMPTY_TREE: AreaTreeNode[] = [];

export interface SourceMasters {
  /** 그 학교급의 학교 (관리자시스템 등록분) */
  schools: NaesinSchool[];
  /** 그 학교급의 교과서 이름 (= exam.publishers.name) */
  textbooks: string[];
  areaTree: AreaTreeNode[];
  unitTree: AreaTreeNode[];
  /** 내신 관리에 등록된 시험범위 힌트. 조건이 모자라면 null */
  scope: ScopeHint | null;
}

/**
 * @param values - 지금 폼 값
 * @param onTextbookFound - 내신 범위에서 교과서를 찾았을 때 (**비어 있을 때만** 부른다)
 * @returns 학교·교과서·영역·단원 목록과 시험범위 힌트
 */
export function useSourceMasters(
  values: SourceFormValues,
  onTextbookFound: (textbook: string) => void,
): SourceMasters {
  const [schools, setSchools] = useState<NaesinSchool[]>([]);
  const [textbooks, setTextbooks] = useState<string[]>([]);
  /**
   * 마지막으로 읽은 트리와 **그때의 조회 키**.
   *
   * ⚠️ 그냥 배열로 들고 있으면 교과서·학년을 바꾼 직후 옛 트리가 남는다. 그 상태로
   *    '읽기 시작'을 누르면 **바뀐 출처 정보에 옛 분류표**를 붙여 OCR 이 돈다
   *    (코덱스 리뷰). 키가 어긋나면 빈 트리로 파생시켜, 아직 못 읽었을 땐
   *    분류를 아예 안 하게 한다(틀린 분류보다 낫다).
   */
  const [loadedArea, setLoadedArea] = useState<{ key: string; tree: AreaTreeNode[] } | null>(null);
  const [loadedUnit, setLoadedUnit] = useState<{ key: string; tree: AreaTreeNode[] } | null>(null);
  /**
   * 마지막으로 읽은 시험범위와 **그때의 조회 키**.
   *
   * 키를 함께 들고 있는 이유: 학교를 바꾼 직후에도 옛 힌트가 화면에 남아 있으면
   * 선생님이 다른 학교의 교과서를 자기 것으로 읽는다. 조건이 바뀌면 값을 지우는 대신
   * **파생**해서 null 로 만든다(효과 안에서 setState 를 부르지 않는 방식).
   */
  const [loadedScope, setLoadedScope] = useState<{ key: string; hint: ScopeHint | null } | null>(null);

  const { level, grade, semester, textbook, source_type: sourceType, school_id: schoolId, year, exam_type: examType } = values;

  // 콜백이 렌더마다 새로 와도 효과가 다시 돌지 않게 참조로 들고 있는다.
  // 교과서 값도 참조로 둔다 — 자동 채움 판정에만 쓰지, 값이 바뀔 때마다 범위를
  // 다시 조회할 이유는 없다.
  //
  // ⚠️ 참조 갱신은 렌더 중이 아니라 효과에서 한다(react-hooks/refs). 아래 효과들보다
  //    **먼저** 선언해야 같은 렌더에서 최신 값을 보고 돈다(효과는 선언 순서대로 실행된다).
  const foundRef = useRef(onTextbookFound);
  const textbookRef = useRef(textbook);
  useEffect(() => {
    foundRef.current = onTextbookFound;
    textbookRef.current = textbook;
  });

  // 학교급 → 학교·교과서
  useEffect(() => {
    let alive = true;
    fetchNaesinSchools(level)
      .then((rows) => { if (alive) setSchools(rows); })
      .catch(() => { if (alive) setSchools([]); });
    getPublishers(level)
      .then((rows) => { if (alive) setTextbooks(rows.map((p) => p.name)); })
      .catch(() => { if (alive) setTextbooks([]); });
    return () => { alive = false; };
  }, [level]);

  // 학년 → 영역 세트. 못 읽어도(정책 미적용 환경) 화면을 막지 않는다
  const areaKey = `${grade}|${level}`;
  useEffect(() => {
    let alive = true;
    fetchAreaSets()
      .then(async (sets) => {
        const setId = pickAreaSetForGrade(sets, grade || level);
        const tree = setId ? await fetchAreaTree(setId) : [];
        if (alive) setLoadedArea({ key: areaKey, tree });
      })
      .catch(() => { if (alive) setLoadedArea({ key: areaKey, tree: [] }); });
    return () => { alive = false; };
  }, [areaKey, grade, level]);

  // 교과서 → 단원 트리
  const unitKey = `${grade}|${semester}|${textbook}`;
  useEffect(() => {
    let alive = true;
    fetchUnitTree({ grade, semester, textbook })
      .then((tree) => { if (alive) setLoadedUnit({ key: unitKey, tree }); })
      .catch(() => { if (alive) setLoadedUnit({ key: unitKey, tree: [] }); });
    return () => { alive = false; };
  }, [unitKey, grade, semester, textbook]);

  // 내신 기출이면 관리자시스템에 등록된 시험범위에서 교과서를 찾아 준다
  const scopeKey = [sourceType, schoolId, grade, year, semester, examType].join('|');
  useEffect(() => {
    if (sourceType !== '내신기출' || textbooks.length === 0) return undefined;
    let alive = true;
    fetchScopeHint({ schoolId, grade, year, semester, examType, textbookNames: textbooks })
      .then((hint) => {
        if (!alive) return;
        setLoadedScope({ key: scopeKey, hint });
        // 직접 고른 교과서는 덮지 않는다 — 비어 있을 때만 채운다
        if (hint?.matchedTextbook && !textbookRef.current) foundRef.current(hint.matchedTextbook);
      })
      .catch(() => { if (alive) setLoadedScope({ key: scopeKey, hint: null }); });
    return () => { alive = false; };
  }, [scopeKey, sourceType, schoolId, grade, year, semester, examType, textbooks]);

  const scope = loadedScope?.key === scopeKey ? loadedScope.hint : null;
  const areaTree = loadedArea?.key === areaKey ? loadedArea.tree : EMPTY_TREE;
  const unitTree = loadedUnit?.key === unitKey ? loadedUnit.tree : EMPTY_TREE;

  return { schools, textbooks, areaTree, unitTree, scope };
}
