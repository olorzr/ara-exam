'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MIDDLE_SCHOOL_GRADES, HIGH_SCHOOL_GRADES, SEMESTER_OPTIONS } from '@/lib/constants';
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

  const gradeOptions = level === '중등' ? MIDDLE_SCHOOL_GRADES : HIGH_SCHOOL_GRADES;

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
      const data = await cm.getMajorChapters(selectedPubId, grade, semester);
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
  const reloadChapters = () => cm.getMajorChapters(selectedPubId, grade, semester).then(setChapters);
  const handleAddChapter = async (name: string) => {
    const { error } = await cm.createMajorChapter(name, selectedPubId, grade, semester);
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
          <Select value={level} onValueChange={(v) => { if (v) setLevel(v as '중등' | '고등'); }}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="중등">중등</SelectItem>
              <SelectItem value="고등">고등</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>학년</Label>
          <Select value={grade} onValueChange={(v) => { if (v) { setGrade(v); setSemester(''); } }}>
            <SelectTrigger className="w-32"><SelectValue placeholder="학년 선택" /></SelectTrigger>
            <SelectContent>
              {gradeOptions.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>학기</Label>
          <Select value={semester} onValueChange={(v) => { if (v) setSemester(v); }} disabled={!grade}>
            <SelectTrigger className="w-32"><SelectValue placeholder="학기 선택" /></SelectTrigger>
            <SelectContent>
              {SEMESTER_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
