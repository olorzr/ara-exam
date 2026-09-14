'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { OptionSelect } from '@/components/ui/option-select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MasterListPanel } from '@/components/words';
import { kstYear } from '@/lib/kst-year';
import {
  EXTERNAL_GRADE_OPTIONS, UNSPECIFIED_OPTION, buildYearOptions, toStoredValue,
} from '@/lib/external-category';
import type { SchoolMaterial, SelectableSchool } from '@/types';
import * as cm from '@/lib/category-master';

/**
 * 외부지문 및 프린트 카테고리(학교 > 년도 > 학년 > 프린트/작품명) 관리 탭.
 * 자체 상태와 CRUD 를 가진 self-contained 컴포넌트.
 *
 * 프린트 목록은 학교 단위로 한 번만 받아 년도/학년으로 클라이언트에서 거른다
 * (학교당 수십 건 규모라 왕복을 늘릴 이유가 없고, 같은 목록에서 년도 옵션도 뽑는다).
 */
export default function ExternalCategoryTab() {
  const [schools, setSchools] = useState<SelectableSchool[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [materials, setMaterials] = useState<SchoolMaterial[]>([]);
  const [year, setYear] = useState(() => String(kstYear()));
  const [grade, setGrade] = useState('');

  const loadSchools = useCallback(async () => {
    setSchools(await cm.getSelectableSchools());
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

  // --- Material CRUD ---
  // 학교는 여기서 만들지 않는다 — 원본이 관리자시스템 public.schools 다(sql/27).
  const reloadMats = () => cm.getSchoolMaterials(selectedSchoolId).then(setMaterials);
  const handleAddMat = async (name: string) => {
    // 프린트를 붙일 자리를 먼저 만든다 — school_materials.school_id 는 exam.schools 로 가는
    // 하드 FK 라, 마스터에서 고른 학교가 거울에 없으면 등록이 조용히 막힌다
    const school = schools.find((s) => s.id === selectedSchoolId);
    if (!school) { toast.error('학교를 먼저 고르세요.'); return; }
    const mirror = await cm.ensureSchoolMirror(school);
    if (mirror.warning) toast.warning(mirror.warning);
    if (!mirror.id) return;

    const { error } = await cm.createSchoolMaterial(name, mirror.id, storedYear, storedGrade);
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
          <OptionSelect
            value={year}
            options={yearOptions.map((y) => ({
              value: y,
              label: y === UNSPECIFIED_OPTION ? y : `${y}학년도`,
            }))}
            placeholder="년도 선택"
            disabled={!selectedSchoolId}
            className="w-36"
            ariaLabel="년도"
            onChange={setYear}
          />
        </div>
        <div className="space-y-2">
          <Label>학년</Label>
          <OptionSelect
            value={grade}
            options={EXTERNAL_GRADE_OPTIONS}
            placeholder="학년 선택"
            disabled={!selectedSchoolId}
            className="w-32"
            ariaLabel="학년"
            onChange={setGrade}
          />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MasterListPanel
              title="학교"
              items={schools.map((s) => ({ id: s.id, name: cm.schoolOptionLabel(s) }))}
              selectedId={selectedSchoolId}
              onSelect={setSelectedSchoolId}
              note="학교는 관리자시스템 › 학원 관리 › 학교 에서 등록합니다."
              emptyMessage="학교 목록을 불러오지 못했습니다"
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
