'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MasterListPanel } from '@/components/words';
import { kstYear } from '@/lib/kst-year';
import {
  EXTERNAL_GRADE_OPTIONS, UNSPECIFIED_OPTION, buildYearOptions, toStoredValue,
} from '@/lib/external-category';
import type { School, SchoolMaterial } from '@/types';
import * as cm from '@/lib/category-master';

/**
 * 외부지문 및 프린트 카테고리(학교 > 년도 > 학년 > 프린트/작품명) 관리 탭.
 * 자체 상태와 CRUD 를 가진 self-contained 컴포넌트.
 *
 * 프린트 목록은 학교 단위로 한 번만 받아 년도/학년으로 클라이언트에서 거른다
 * (학교당 수십 건 규모라 왕복을 늘릴 이유가 없고, 같은 목록에서 년도 옵션도 뽑는다).
 */
export default function ExternalCategoryTab() {
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [materials, setMaterials] = useState<SchoolMaterial[]>([]);
  const [year, setYear] = useState(() => String(kstYear()));
  const [grade, setGrade] = useState('');

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

  const yearOptions = useMemo(
    () => buildYearOptions(materials.map((m) => m.year)),
    [materials],
  );

  // 년도/학년이 정해져야 프린트를 추가·표시할 수 있다. '미지정'도 유효한 선택이다.
  const scopeReady = !!selectedSchoolId && !!year && !!grade;
  const storedYear = toStoredValue(year);
  const storedGrade = toStoredValue(grade);

  const visibleMaterials = useMemo(
    () => (scopeReady ? materials.filter((m) => m.year === storedYear && m.grade === storedGrade) : []),
    [materials, scopeReady, storedYear, storedGrade],
  );

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
    const { error } = await cm.deleteSchool(id);
    if (error) { toast.error(`학교 삭제 실패: ${error.message}`); return; }
    toast.success('학교가 삭제되었습니다.');
    if (selectedSchoolId === id) setSelectedSchoolId('');
    loadSchools();
  };

  // --- Material CRUD ---
  const reloadMats = () => cm.getSchoolMaterials(selectedSchoolId).then(setMaterials);
  const handleAddMat = async (name: string) => {
    const { error } = await cm.createSchoolMaterial(name, selectedSchoolId, storedYear, storedGrade);
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
    const { error } = await cm.deleteSchoolMaterial(id);
    if (error) { toast.error(`항목 삭제 실패: ${error.message}`); return; }
    toast.success('항목이 삭제되었습니다.');
    reloadMats();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="space-y-2">
          <Label>년도</Label>
          <Select value={year} onValueChange={(v) => { if (v) setYear(v); }} disabled={!selectedSchoolId}>
            <SelectTrigger className="w-36"><SelectValue placeholder="년도 선택" /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>{y === UNSPECIFIED_OPTION ? y : `${y}학년도`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>학년</Label>
          <Select value={grade} onValueChange={(v) => { if (v) setGrade(v); }} disabled={!selectedSchoolId}>
            <SelectTrigger className="w-32"><SelectValue placeholder="학년 선택" /></SelectTrigger>
            <SelectContent>
              {EXTERNAL_GRADE_OPTIONS.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
              items={visibleMaterials}
              onAdd={handleAddMat}
              onEdit={handleEditMat}
              onDelete={handleDeleteMat}
              placeholder="예: 프린트1, 작품명"
              disabled={!scopeReady}
              emptyMessage={
                scopeReady ? '항목이 없습니다' : '학교 · 년도 · 학년을 먼저 선택하세요'
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
