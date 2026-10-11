'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { OptionSelect } from '@/components/ui/option-select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { NO_SEMESTER_OPTION, semesterOptionsFor, toStoredSemester } from '@/lib/semester';
import { NO_GRADE_OPTION, gradeOptionsFor, toStoredGrade } from '@/lib/textbook-grade';
import { MasterListPanel } from '@/components/words';
import type { Publisher, MajorChapter, SubChapter } from '@/types';
import * as cm from '@/lib/category-master';

/**
 * 중등/고등 교과 카테고리(출판사 > 대단원 > 소단원) 관리 탭.
 * 자체 상태와 CRUD 를 가진 self-contained 컴포넌트.
 */
export default function CurriculumCategoryTab() {
  const [level, setLevel] = useState<'중등' | '고등'>('중등');
  const [grade, setGrade] = useState('');
  const [semester, setSemester] = useState('');
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [selectedPubId, setSelectedPubId] = useState('');
  const [chapters, setChapters] = useState<MajorChapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [subChapters, setSubChapters] = useState<SubChapter[]>([]);

  // 고등만 학년 '선택과목'·학기 '학기 구분 없음'(선택과목은 고2·고3, 1·2학기 어디서든 배운다).
  // 화면 값을 저장값으로 바꾸는 자리는 아래 셋 — 조회·재조회·추가
  const storedGrade = toStoredGrade(grade);
  const storedSemester = toStoredSemester(semester);

  const loadPublishers = useCallback(async () => {
    setPublishers(await cm.getPublishers(level));
  }, [level]);

  useEffect(() => {
    (async () => {
      await loadPublishers();
      setSelectedPubId('');
      setChapters([]);
      setSelectedChapterId('');
      setSubChapters([]);
    })();
  }, [loadPublishers]);

  useEffect(() => {
    (async () => {
      if (!selectedPubId || !grade || !semester) {
        setChapters([]); setSelectedChapterId(''); setSubChapters([]);
        return;
      }
      const data = await cm.getMajorChapters(selectedPubId, toStoredGrade(grade), toStoredSemester(semester));
      setChapters(data);
      setSelectedChapterId('');
      setSubChapters([]);
    })();
  }, [selectedPubId, grade, semester]);

  useEffect(() => {
    (async () => {
      if (!selectedChapterId) { setSubChapters([]); return; }
      setSubChapters(await cm.getSubChapters(selectedChapterId));
    })();
  }, [selectedChapterId]);

  // --- Publisher CRUD ---
  const handleAddPub = async (name: string) => {
    const { error } = await cm.createPublisher(name, level);
    if (error) { toast.error('이미 존재하는 출판사입니다.'); return; }
    toast.success('출판사가 추가되었습니다.');
    loadPublishers();
  };
  const handleEditPub = async (id: string, name: string) => {
    const { error } = await cm.updatePublisher(id, name);
    if (error) { toast.error(`출판사 수정 실패: ${error.message}`); return; }
    toast.success('출판사명이 수정되었습니다.');
    loadPublishers();
  };
  const handleDeletePub = async (id: string) => {
    const { error } = await cm.deletePublisher(id);
    if (error) { toast.error(`출판사 삭제 실패: ${error.message}`); return; }
    toast.success('출판사가 삭제되었습니다.');
    if (selectedPubId === id) setSelectedPubId('');
    loadPublishers();
  };

  // --- Chapter CRUD ---
  const reloadChapters = () => cm.getMajorChapters(selectedPubId, storedGrade, storedSemester).then(setChapters);
  const handleAddChapter = async (name: string) => {
    const { error } = await cm.createMajorChapter(name, selectedPubId, storedGrade, storedSemester);
    if (error) { toast.error('이미 존재하는 대단원입니다.'); return; }
    toast.success('대단원이 추가되었습니다.');
    reloadChapters();
  };
  const handleEditChapter = async (id: string, name: string) => {
    const { error } = await cm.updateMajorChapter(id, name);
    if (error) { toast.error(`대단원 수정 실패: ${error.message}`); return; }
    toast.success('대단원명이 수정되었습니다.');
    reloadChapters();
  };
  const handleDeleteChapter = async (id: string) => {
    const { error } = await cm.deleteMajorChapter(id);
    if (error) { toast.error(`대단원 삭제 실패: ${error.message}`); return; }
    toast.success('대단원이 삭제되었습니다.');
    if (selectedChapterId === id) setSelectedChapterId('');
    reloadChapters();
  };

  // --- SubChapter CRUD ---
  const reloadSubs = () => cm.getSubChapters(selectedChapterId).then(setSubChapters);
  const handleAddSub = async (name: string) => {
    const { error } = await cm.createSubChapter(name, selectedChapterId);
    if (error) { toast.error('이미 존재하는 소단원입니다.'); return; }
    toast.success('소단원이 추가되었습니다.');
    reloadSubs();
  };
  const handleEditSub = async (id: string, name: string) => {
    const { error } = await cm.updateSubChapter(id, name);
    if (error) { toast.error(`소단원 수정 실패: ${error.message}`); return; }
    toast.success('소단원명이 수정되었습니다.');
    reloadSubs();
  };
  const handleDeleteSub = async (id: string) => {
    const { error } = await cm.deleteSubChapter(id);
    if (error) { toast.error(`소단원 삭제 실패: ${error.message}`); return; }
    toast.success('소단원이 삭제되었습니다.');
    reloadSubs();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="space-y-2">
          <Label>구분</Label>
          <OptionSelect
            value={level}
            options={['중등', '고등']}
            className="w-32"
            ariaLabel="구분"
            onChange={(v) => {
              // 학년·학기는 학교급마다 선택지가 다르다 — 남기면 중등에 '학기 구분 없음' 이 걸린 채 남는다
              setLevel(v as '중등' | '고등'); setGrade(''); setSemester('');
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>학년</Label>
          <OptionSelect
            value={grade}
            options={gradeOptionsFor(level)}
            placeholder="학년 선택"
            className="w-32"
            ariaLabel="학년"
            onChange={(v) => {
              // 선택과목은 학기도 나누지 않는다 — 학기를 함께 채운다(칸은 열려 있어 바꿀 수 있다)
              setGrade(v); setSemester(v === NO_GRADE_OPTION ? NO_SEMESTER_OPTION : '');
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>학기</Label>
          <OptionSelect
            value={semester}
            options={semesterOptionsFor(level)}
            placeholder="학기 선택"
            disabled={!grade}
            className="w-40"
            ariaLabel="학기"
            onChange={setSemester}
          />
        </div>
      </div>
      {level === '고등' && (
        <p className="text-xs text-muted-foreground">
          문학·화법과 언어처럼 한 권을 고2·고3, 1·2학기 어디서든 쓰는 선택과목은 학년을 &lsquo;선택과목&rsquo;으로 고르세요(학기는 &lsquo;학기 구분 없음&rsquo;이 함께 채워져요).
        </p>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MasterListPanel
              title="출판사"
              items={publishers}
              selectedId={selectedPubId}
              onSelect={setSelectedPubId}
              onAdd={handleAddPub}
              onEdit={handleEditPub}
              onDelete={handleDeletePub}
              placeholder="예: 비상, 천재"
            />
            <MasterListPanel
              title="대단원"
              items={chapters}
              selectedId={selectedChapterId}
              onSelect={setSelectedChapterId}
              onAdd={handleAddChapter}
              onEdit={handleEditChapter}
              onDelete={handleDeleteChapter}
              placeholder="예: 1. 문학의 갈래"
              disabled={!selectedPubId || !grade || !semester}
            />
            <MasterListPanel
              title="소단원"
              items={subChapters}
              onAdd={handleAddSub}
              onEdit={handleEditSub}
              onDelete={handleDeleteSub}
              placeholder="예: (1) 시의 이해"
              disabled={!selectedChapterId}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
