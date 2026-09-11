'use client';

import { useEffect, useState } from 'react';
import { getPublishers } from '@/lib/category-master';
import { fetchNaesinSchools } from '@/lib/naesin-scope/fetch';
import type { NaesinSchool } from '@/lib/naesin-scope/types';
import { fetchAreaSets, fetchAreaTree, pickAreaSetForGrade } from '@/lib/problem-bank/area-master';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';
import type { ScopeHint } from '@/lib/problem-bank/scope-resolve';
import { visibleFields, type SourceFormValues } from '@/lib/problem-bank/source-form';
import { fetchUnitTree } from '@/lib/problem-bank/unit-master';
import { useScopeHint } from './useScopeHint';

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
/** 아직 못 읽었을 때 돌려줄 빈 값 — 참조가 바뀌지 않게 하나만 둔다 */
const EMPTY_TREE: AreaTreeNode[] = [];
const EMPTY_NAMES: string[] = [];

export interface SourceMasters {
  /** 그 학교급의 학교 (관리자시스템 등록분) */
  schools: NaesinSchool[];
  /** 그 학교급의 교과서 이름 (= exam.publishers.name) */
  textbooks: string[];
  areaTree: AreaTreeNode[];
  unitTree: AreaTreeNode[];
  /** 내신 관리에 등록된 시험범위 힌트. 학교를 안 골랐으면 null */
  scope: ScopeHint | null;
}

/**
 * @param values - 지금 폼 값
 * @param onTextbookHint - 내신 관리에서 찾은 교과서 이름(없으면 null).
 *   **채울지는 호출부가 정한다** — 직접 고른 교과서를 덮으면 안 된다
 * @returns 학교·교과서·영역·단원 목록과 시험범위 힌트
 */
export function useSourceMasters(
  values: SourceFormValues,
  onTextbookHint: (matched: string | null) => void,
): SourceMasters {
  const [schools, setSchools] = useState<NaesinSchool[]>([]);
  /**
   * 마지막으로 읽은 목록·트리와 **그때의 조회 키**.
   *
   * ⚠️ 그냥 배열로 들고 있으면 교과서·학년을 바꾼 직후 옛 값이 남는다. 그 상태로
   *    '읽기 시작'을 누르면 **바뀐 출처 정보에 옛 분류표**를 붙여 OCR 이 돈다
   *    (코덱스 리뷰). 키가 어긋나면 빈 값으로 파생시켜, 아직 못 읽었을 땐
   *    분류를 아예 안 하게 한다(틀린 분류보다 낫다).
   * ⚠️ 교과서 이름도 같은 이유로 키를 단다 — 학교급을 바꾼 직후 옛 급의 이름으로
   *    내신 관리 교과서를 맞추면 '카테고리에 같은 이름이 없어요' 가 헛되이 뜬다.
   */
  const [loadedTextbooks, setLoadedTextbooks] = useState<{ key: string; names: string[] } | null>(null);
  const [loadedArea, setLoadedArea] = useState<{ key: string; tree: AreaTreeNode[] } | null>(null);
  const [loadedUnit, setLoadedUnit] = useState<{ key: string; tree: AreaTreeNode[] } | null>(null);

  const { level, grade, semester, textbook, source_type: sourceType, school_id: schoolId, year, exam_type: examType } = values;

  // 학교급 → 학교·교과서
  useEffect(() => {
    let alive = true;
    fetchNaesinSchools(level)
      .then((rows) => { if (alive) setSchools(rows); })
      .catch(() => { if (alive) setSchools([]); });
    getPublishers(level)
      .then((rows) => { if (alive) setLoadedTextbooks({ key: level, names: rows.map((p) => p.name) }); })
      .catch(() => { if (alive) setLoadedTextbooks({ key: level, names: [] }); });
    return () => { alive = false; };
  }, [level]);

  const textbooks = loadedTextbooks?.key === level ? loadedTextbooks.names : EMPTY_NAMES;

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

  // 학교를 묻는 유형일 때만 내신 관리를 본다 — 문제집·모의고사는 학교 칸이 안 보이는데도
  // 이전에 고른 school_id 가 남아 있을 수 있어, 안 가리면 안 보이는 학교로 교과서를 채운다
  const scope = useScopeHint({
    schoolId,
    grade,
    year,
    semester,
    examType,
    textbookNames: textbooks,
    enabled: visibleFields(sourceType).includes('school_name'),
  }, onTextbookHint);

  const areaTree = loadedArea?.key === areaKey ? loadedArea.tree : EMPTY_TREE;
  const unitTree = loadedUnit?.key === unitKey ? loadedUnit.tree : EMPTY_TREE;

  return { schools, textbooks, areaTree, unitTree, scope };
}
