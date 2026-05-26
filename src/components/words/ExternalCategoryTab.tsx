'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { MasterListPanel } from '@/components/words';
import type { School, SchoolMaterial } from '@/types';
import * as cm from '@/lib/category-master';

/**
 * 외부지문 및 프린트 카테고리(학교 > 프린트/작품명) 관리 탭.
 * 자체 상태와 CRUD 를 가진 self-contained 컴포넌트.
 */
export default function ExternalCategoryTab() {
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [materials, setMaterials] = useState<SchoolMaterial[]>([]);

  const loadSchools = useCallback(async () => {
    setSchools(await cm.getSchools());
  }, []);

  useEffect(() => {
    (async () => { await loadSchools(); })();
  }, [loadSchools]);

  useEffect(() => {
    (async () => {
      if (!selectedSchoolId) { setMaterials([]); return; }
      setMaterials(await cm.getSchoolMaterials(selectedSchoolId));
    })();
  }, [selectedSchoolId]);

  // --- School CRUD ---
  const handleAddSchool = async (name: string) => {
    const { error } = await cm.createSchool(name);
    if (error) { toast.error('이미 존재하는 학교입니다.'); return; }
    toast.success('학교가 추가되었습니다.');
    loadSchools();
  };
  const handleEditSchool = async (id: string, name: string) => {
    const { error } = await cm.updateSchool(id, name);
    if (error) { toast.error(`학교 수정 실패: ${error.message}`); return; }
    toast.success('학교명이 수정되었습니다.');
    loadSchools();
  };
  const handleDeleteSchool = async (id: string) => {
    await cm.deleteSchool(id);
    toast.success('학교가 삭제되었습니다.');
    if (selectedSchoolId === id) setSelectedSchoolId('');
    loadSchools();
  };

  // --- Material CRUD ---
  const reloadMats = () => cm.getSchoolMaterials(selectedSchoolId).then(setMaterials);
  const handleAddMat = async (name: string) => {
    const { error } = await cm.createSchoolMaterial(name, selectedSchoolId);
    if (error) { toast.error('이미 존재하는 항목입니다.'); return; }
    toast.success('프린트/작품명이 추가되었습니다.');
    reloadMats();
  };
  const handleEditMat = async (id: string, name: string) => {
    const { error } = await cm.updateSchoolMaterial(id, name);
    if (error) { toast.error(`항목 수정 실패: ${error.message}`); return; }
    toast.success('항목이 수정되었습니다.');
    reloadMats();
  };
  const handleDeleteMat = async (id: string) => {
    await cm.deleteSchoolMaterial(id);
    toast.success('항목이 삭제되었습니다.');
    reloadMats();
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MasterListPanel
            title="학교"
            items={schools}
            selectedId={selectedSchoolId}
            onSelect={setSelectedSchoolId}
            onAdd={handleAddSchool}
            onEdit={handleEditSchool}
            onDelete={handleDeleteSchool}
            placeholder="예: OO중학교"
          />
          <MasterListPanel
            title="프린트/작품명"
            items={materials}
            onAdd={handleAddMat}
            onEdit={handleEditMat}
            onDelete={handleDeleteMat}
            placeholder="예: 프린트1, 작품명"
            disabled={!selectedSchoolId}
          />
        </div>
      </CardContent>
    </Card>
  );
}
