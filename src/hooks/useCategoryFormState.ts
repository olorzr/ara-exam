'use client';

import { useState, useEffect } from 'react';
import type { CategoryLevel, Publisher, MajorChapter, SubChapter, School, SchoolMaterial } from '@/types';
import { EXTERNAL_LEVEL, MIDDLE_SCHOOL_GRADES, HIGH_SCHOOL_GRADES } from '@/lib/constants';
import {
  getPublishers, getMajorChapters, getSubChapters,
  getSchools, getSchoolMaterials,
} from '@/lib/category-master';

export interface CategoryFormProps {
  level: CategoryLevel;
  grade: string;
  publisher: string;
  semester: string;
  chapter: string;
  subChapter: string;
  schoolName: string;
  onLevelChange: (value: CategoryLevel) => void;
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
    level, grade, publisher, semester, chapter, subChapter, schoolName,
    onLevelChange, onGradeChange, onPublisherChange, onSemesterChange,
    onChapterChange, onSubChapterChange, onSchoolNameChange,
  } = props;

  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [chapters, setChapters] = useState<MajorChapter[]>([]);
  const [subChaptersList, setSubChaptersList] = useState<SubChapter[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [materials, setMaterials] = useState<SchoolMaterial[]>([]);

  const [publisherId, setPublisherId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [subChapterId, setSubChapterId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [materialId, setMaterialId] = useState('');

  const gradeOptions = level === '중등' ? MIDDLE_SCHOOL_GRADES : level === '고등' ? HIGH_SCHOOL_GRADES : [];

  // 출판사/학교 목록 로드
  useEffect(() => {
    (async () => {
      if (level === EXTERNAL_LEVEL) {
        setSchools(await getSchools());
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
      setChapters(await getMajorChapters(publisherId, grade, semester));
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

  // 학교 이름 → ID 역추적
  useEffect(() => {
    (async () => {
      if (!schoolName || schools.length === 0) return;
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
      if (!chapter || materials.length === 0) return;
      const found = materials.find((m) => m.name === chapter);
      if (found && found.id !== materialId) setMaterialId(found.id);
    })();
  }, [chapter, materials, materialId]);

  const handleLevelChange = (v: CategoryLevel) => {
    onLevelChange(v);
    onGradeChange(''); onPublisherChange(''); onSemesterChange('');
    onChapterChange(''); onSubChapterChange(''); onSchoolNameChange('');
    setPublisherId(''); setChapterId(''); setSubChapterId('');
    setSchoolId(''); setMaterialId('');
  };

  const handleGradeChange = (v: string) => {
    onGradeChange(v);
    onPublisherChange(''); onSemesterChange('');
    onChapterChange(''); onSubChapterChange('');
    setPublisherId(''); setChapterId(''); setSubChapterId('');
  };

  const handlePublisherSelect = (pubId: string) => {
    setPublisherId(pubId);
    const pub = publishers.find((p) => p.id === pubId);
    onPublisherChange(pub?.name ?? '');
    onSemesterChange(''); onChapterChange(''); onSubChapterChange('');
    setChapterId(''); setSubChapterId('');
  };

  const handleSemesterChange = (v: string) => {
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
    const mat = materials.find((m) => m.id === matId);
    onChapterChange(mat?.name ?? '');
  };

  const noPublishers = publishers.length === 0 && !!grade && level !== EXTERNAL_LEVEL;
  const noSchools = schools.length === 0 && level === EXTERNAL_LEVEL;

  return {
    publishers, chapters, subChaptersList, schools, materials,
    publisherId, chapterId, subChapterId, schoolId, materialId,
    gradeOptions,
    handleLevelChange, handleGradeChange, handlePublisherSelect,
    handleSemesterChange, handleChapterSelect, handleSubChapterSelect,
    handleSchoolSelect, handleMaterialSelect,
    noPublishers, noSchools,
  };
}
