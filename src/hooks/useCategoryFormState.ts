'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { CategoryLevel, Publisher, MajorChapter, SubChapter, SchoolMaterial, SelectableSchool } from '@/types';
import { EXTERNAL_LEVEL } from '@/lib/constants';
import { EXTERNAL_GRADE_OPTIONS, buildYearOptions, toStoredValue } from '@/lib/external-category';
import { NO_SEMESTER_OPTION, toStoredSemester } from '@/lib/semester';
import { NO_GRADE_OPTION, gradeOptionsFor, toStoredGrade } from '@/lib/textbook-grade';
import {
  getPublishers, getMajorChapters, getSubChapters,
  getSelectableSchools, getSchoolMaterials,
} from '@/lib/category-master';

export interface CategoryFormProps {
  level: CategoryLevel;
  /** 학년도(외부지문 전용). Select 표시값이며 '미지정' 은 저장 시 '' 로 변환된다 */
  year: string;
  grade: string;
  publisher: string;
  semester: string;
  chapter: string;
  subChapter: string;
  schoolName: string;
  onLevelChange: (value: CategoryLevel) => void;
  onYearChange: (value: string) => void;
  onGradeChange: (value: string) => void;
  onPublisherChange: (value: string) => void;
  onSemesterChange: (value: string) => void;
  onChapterChange: (value: string) => void;
  onSubChapterChange: (value: string) => void;
  onSchoolNameChange: (value: string) => void;
}

/**
 * CategoryForm 의 마스터 데이터 로딩과 선택 상태(내부 ID), 임시저장 복원(이름→ID
 * 역추적), 선택 핸들러를 캡슐화한 훅. 표시 값(name)은 부모가 props 로 관리하고,
 * 내부 ID 와 목록은 이 훅이 관리한다.
 */
export function useCategoryFormState(props: CategoryFormProps) {
  const {
    level, year, grade, publisher, semester, chapter, subChapter, schoolName,
    onLevelChange, onYearChange, onGradeChange, onPublisherChange, onSemesterChange,
    onChapterChange, onSubChapterChange, onSchoolNameChange,
  } = props;

  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [chapters, setChapters] = useState<MajorChapter[]>([]);
  const [subChaptersList, setSubChaptersList] = useState<SubChapter[]>([]);
  const [schools, setSchools] = useState<SelectableSchool[]>([]);
  const [materials, setMaterials] = useState<SchoolMaterial[]>([]);

  const [publisherId, setPublisherId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [subChapterId, setSubChapterId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [materialId, setMaterialId] = useState('');
  /**
   * '선택과목'·'학기 구분 없음' 자동 고르기의 세대. 사람이 학기·학년·구분·출판사를 다시 만지면 올라가서,
   * 늦게 돌아온 조회가 사람이 고른 값을 덮지 않는다.
   */
  const autoSemesterSeq = useRef(0);
  /**
   * 지금 폼에 걸린 구분·학년·출판사·학기. 자동 고르기 응답이 돌아왔을 때 **그 사이 값이 바뀌었는지**를 본다 —
   * 임시저장 불러오기는 이 훅의 핸들러를 거치지 않고 부모가 값을 통째로 바꿔서 세대만으로는 못 잡는다(코덱스 1R).
   */
  const currentRef = useRef({ level, grade, publisher, semester });
  useEffect(() => {
    currentRef.current = { level, grade, publisher, semester };
  }, [level, grade, publisher, semester]);

  // 외부지문은 학교가 중학교일 수도 고등학교일 수도 있어 중등·고등 학년을 모두 제공한다.
  // 고등 교과서는 학년 '선택과목'(고2·고3 어디서든 배우는 교과서, 저장값 '')을 더 내준다
  const gradeOptions: readonly string[] =
    level === EXTERNAL_LEVEL ? EXTERNAL_GRADE_OPTIONS : gradeOptionsFor(level);

  const yearOptions = useMemo(() => buildYearOptions(materials.map((m) => m.year)), [materials]);

  // 프린트 목록은 학교 단위로 받아 년도/학년으로 클라이언트에서 거른다(학교당 수십 건 규모)
  const visibleMaterials = useMemo(
    () => (year && grade
      ? materials.filter((m) => m.year === toStoredValue(year) && m.grade === toStoredValue(grade))
      : []),
    [materials, year, grade],
  );

  // 출판사/학교 목록 로드
  useEffect(() => {
    (async () => {
      if (level === EXTERNAL_LEVEL) {
        setSchools(await getSelectableSchools());
      } else {
        setPublishers(await getPublishers(level));
      }
    })();
  }, [level]);

  // 출판사 이름 → ID 역추적 (임시저장 복원용)
  useEffect(() => {
    (async () => {
      if (!publisher || publishers.length === 0) return;
      const found = publishers.find((p) => p.name === publisher);
      if (found && found.id !== publisherId) setPublisherId(found.id);
    })();
  }, [publisher, publishers, publisherId]);

  // 대단원 로드
  useEffect(() => {
    (async () => {
      if (!publisherId || !grade || !semester) { setChapters([]); return; }
      // 화면 값('선택과목'·'학기 구분 없음')을 저장값('')으로 — 그대로 넘기면 그 글자로 .eq 를 걸어 빈 목록이 된다
      setChapters(await getMajorChapters(publisherId, toStoredGrade(grade), toStoredSemester(semester)));
    })();
  }, [publisherId, grade, semester]);

  // 대단원 이름 → ID 역추적
  useEffect(() => {
    (async () => {
      if (!chapter || chapters.length === 0) return;
      const found = chapters.find((c) => c.name === chapter);
      if (found && found.id !== chapterId) setChapterId(found.id);
    })();
  }, [chapter, chapters, chapterId]);

  // 소단원 로드
  useEffect(() => {
    (async () => {
      if (!chapterId) { setSubChaptersList([]); return; }
      setSubChaptersList(await getSubChapters(chapterId));
    })();
  }, [chapterId]);

  // 소단원 이름 → ID 역추적
  useEffect(() => {
    (async () => {
      if (!subChapter || subChaptersList.length === 0) return;
      const found = subChaptersList.find((s) => s.name === subChapter);
      if (found && found.id !== subChapterId) setSubChapterId(found.id);
    })();
  }, [subChapter, subChaptersList, subChapterId]);

  // 학교 이름 → ID 역추적 (임시저장 복원용)
  // ⚠️ **이미 그 이름의 학교를 고른 상태면 손대지 않는다.** 학교 원본인 관리자시스템
  //    `public.schools` 에는 이름 UNIQUE 가 없어, 같은 이름이 둘이면 방금 고른 쪽을
  //    이름이 같은 **첫 번째** 학교로 되돌려 놓는다(코덱스 리뷰).
  useEffect(() => {
    (async () => {
      if (!schoolName || schools.length === 0) return;
      if (schools.find((s) => s.id === schoolId)?.name === schoolName) return;
      const found = schools.find((s) => s.name === schoolName);
      if (found && found.id !== schoolId) setSchoolId(found.id);
    })();
  }, [schoolName, schools, schoolId]);

  // 프린트/작품명 로드
  useEffect(() => {
    (async () => {
      if (!schoolId) { setMaterials([]); return; }
      setMaterials(await getSchoolMaterials(schoolId));
    })();
  }, [schoolId]);

  // 프린트/작품명 이름 → ID 역추적
  useEffect(() => {
    (async () => {
      if (!chapter || visibleMaterials.length === 0) return;
      const found = visibleMaterials.find((m) => m.name === chapter);
      if (found && found.id !== materialId) setMaterialId(found.id);
    })();
  }, [chapter, visibleMaterials, materialId]);

  const handleLevelChange = (v: CategoryLevel) => {
    autoSemesterSeq.current += 1;
    onLevelChange(v);
    onYearChange(''); onGradeChange(''); onPublisherChange(''); onSemesterChange('');
    onChapterChange(''); onSubChapterChange(''); onSchoolNameChange('');
    setPublisherId(''); setChapterId(''); setSubChapterId('');
    setSchoolId(''); setMaterialId('');
  };

  const handleYearChange = (v: string) => {
    onYearChange(v);
    onChapterChange(''); setMaterialId('');
  };

  const handleGradeChange = (v: string) => {
    autoSemesterSeq.current += 1;
    onGradeChange(v);
    if (level === EXTERNAL_LEVEL) {
      // 외부지문은 학년이 바뀌면 프린트 선택만 초기화된다(출판사/학기를 쓰지 않음)
      onChapterChange(''); setMaterialId('');
      return;
    }
    onPublisherChange(''); onSemesterChange('');
    onChapterChange(''); onSubChapterChange('');
    setPublisherId(''); setChapterId(''); setSubChapterId('');
  };

  const handlePublisherSelect = (pubId: string) => {
    const seq = ++autoSemesterSeq.current;
    setPublisherId(pubId);
    const pub = publishers.find((p) => p.id === pubId);
    onPublisherChange(pub?.name ?? '');
    onSemesterChange(''); onChapterChange(''); onSubChapterChange('');
    setChapterId(''); setSubChapterId('');
    if (level !== '고등' || !grade) return;
    // 고등 선택과목(대단원이 전부 학년·학기 구분 없음)은 학년 '선택과목'·학기 '학기 구분 없음' 을 저절로 고른다 —
    // 학년 → 출판사 순서라 사람은 보통 '고2' 를 골라 둔 채 문학 교과서를 고르는데, 그대로 두면 대단원 칸이 비어
    // 고장처럼 보인다. 그래서 학년을 거르지 않고 그 교과서의 대단원을 전부 읽어 본다.
    // ⚠️ 학년은 훅의 handleGradeChange 가 아니라 prop 으로 직접 바꾼다(그쪽은 방금 고른 출판사를 비운다).
    //    학기도 **같은 콜백에서** 바꿔야 대단원 조회가 `!semester` 가드를 지나 한 번에 돈다.
    // 그 사이 사람이 학년·학기를 고르거나 임시저장을 불러왔으면 덮지 않는다(세대 + 현재 값 대조)
    const pubName = pub?.name ?? '';
    getMajorChapters(pubId).then((all) => {
      if (autoSemesterSeq.current !== seq || all.length === 0) return;
      // 같은 교과서이고 학기가 아직 비어 있을 때만 — 그 사이 사람이 고르거나 임시저장을 불러왔으면 손대지 않는다
      const now = currentRef.current;
      if (now.level !== level || now.grade !== grade || now.publisher !== pubName || now.semester !== '') return;
      if (all.every((c) => c.grade === '') && grade !== NO_GRADE_OPTION) onGradeChange(NO_GRADE_OPTION);
      if (all.every((c) => c.semester === '')) onSemesterChange(NO_SEMESTER_OPTION);
    }).catch(() => undefined); // 못 읽으면 그냥 사람이 고른다
  };

  const handleSemesterChange = (v: string) => {
    autoSemesterSeq.current += 1;
    onSemesterChange(v);
    onChapterChange(''); onSubChapterChange('');
    setChapterId(''); setSubChapterId('');
  };

  const handleChapterSelect = (chapId: string) => {
    setChapterId(chapId);
    const ch = chapters.find((c) => c.id === chapId);
    onChapterChange(ch?.name ?? '');
    onSubChapterChange(''); setSubChapterId('');
  };

  const handleSubChapterSelect = (subId: string) => {
    setSubChapterId(subId);
    const sub = subChaptersList.find((s) => s.id === subId);
    onSubChapterChange(sub?.name ?? '');
  };

  const handleSchoolSelect = (schId: string) => {
    setSchoolId(schId);
    const sch = schools.find((s) => s.id === schId);
    onSchoolNameChange(sch?.name ?? '');
    onChapterChange(''); setMaterialId('');
  };

  const handleMaterialSelect = (matId: string) => {
    setMaterialId(matId);
    const mat = visibleMaterials.find((m) => m.id === matId);
    onChapterChange(mat?.name ?? '');
  };

  const noPublishers = publishers.length === 0 && !!grade && level !== EXTERNAL_LEVEL;
  const noSchools = schools.length === 0 && level === EXTERNAL_LEVEL;
  /**
   * 학교·년도·학년까지 골랐는데 프린트가 하나도 없는 상태.
   * `noSchools`(마스터가 비었다 = 관리자시스템 문제)와 **원인도 갈 곳도 다르다** —
   * 프린트는 이제 `학교 프린트 시험지` 업로드만 만든다(2026-09-14).
   */
  const noMaterials = visibleMaterials.length === 0
    && level === EXTERNAL_LEVEL && !!schoolId && !!year && !!grade;

  return {
    publishers, chapters, subChaptersList, schools,
    materials: visibleMaterials,
    publisherId, chapterId, subChapterId, schoolId, materialId,
    gradeOptions, yearOptions,
    handleLevelChange, handleYearChange, handleGradeChange, handlePublisherSelect,
    handleSemesterChange, handleChapterSelect, handleSubChapterSelect,
    handleSchoolSelect, handleMaterialSelect,
    noPublishers, noSchools, noMaterials,
  };
}
