'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OptionSelect } from '@/components/ui/option-select';
import { createSchool } from '@/lib/category-master';
import { buildYearOptions, EXTERNAL_GRADE_OPTIONS } from '@/lib/external-category';
import type { BundleDraft } from '@/lib/print-scan/bundles';
import type { School } from '@/types';

interface BundleFormProps {
  bundle: BundleDraft;
  schools: School[];
  errors?: { name?: string; school?: string; pages?: string };
  pageCount: number;
  disabled?: boolean;
  onChange: (patch: Partial<BundleDraft>) => void;
  onSchoolAdded: (school: School) => void;
}

/**
 * 고른 프린트 한 장의 정보 — 학교·년도·학년·이름·손글씨 여부.
 *
 * 값은 개념지와 **같은 규약**이다: 학교/년도/학년/프린트명이 그대로 외부지문 카테고리가 된다.
 * 그래서 '미지정' ↔ '' 변환도 같은 함수(`toStoredValue`)를 지나며, 그 변환은 저장 직전
 * (`toBundleInsert`)에 한 번만 한다 — 화면은 표시값을 그대로 들고 있는다.
 */
export default function BundleForm({
  bundle, schools, errors, pageCount, disabled, onChange, onSchoolAdded,
}: BundleFormProps) {
  const [newSchool, setNewSchool] = useState('');
  const [adding, setAdding] = useState(false);

  const schoolOptions = schools.map((s) => ({ value: s.name, label: s.name }));
  // 새로 올리는 프린트라 '데이터에 있는 년도' 가 없다 — 롤링 윈도만으로 충분하다
  const yearOptions = buildYearOptions([]);

  const addSchool = async () => {
    const name = newSchool.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      const { data, error } = await createSchool(name);
      if (error || !data) throw error ?? new Error('학교를 추가하지 못했어요.');
      const school = data as School;
      onSchoolAdded(school);
      onChange({ schoolId: school.id, schoolName: school.name });
      setNewSchool('');
      toast.success(`${school.name} 을(를) 추가했어요.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '학교를 추가하지 못했어요.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="bundle-school">학교</Label>
        <OptionSelect
          id="bundle-school"
          value={bundle.schoolName}
          options={schoolOptions}
          placeholder="학교를 고르세요"
          disabled={disabled}
          onChange={(name) => onChange({
            schoolName: name,
            schoolId: schools.find((s) => s.name === name)?.id ?? '',
          })}
          className="w-full"
        />
        {errors?.school && <p className="text-xs text-red-600">{errors.school}</p>}
        <div className="flex items-center gap-1.5">
          <Input
            value={newSchool}
            onChange={(e) => setNewSchool(e.target.value)}
            placeholder="목록에 없으면 새 학교 이름"
            disabled={disabled || adding}
            className="h-8 text-sm"
            aria-label="새 학교 이름"
          />
          <Button
            type="button" variant="outline" size="sm"
            onClick={addSchool}
            disabled={disabled || adding || !newSchool.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
            추가
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="bundle-year">학년도</Label>
          <OptionSelect
            id="bundle-year"
            value={bundle.year}
            options={yearOptions}
            disabled={disabled}
            onChange={(year) => onChange({ year })}
            className="w-full"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bundle-grade">학년</Label>
          <OptionSelect
            id="bundle-grade"
            value={bundle.grade}
            options={EXTERNAL_GRADE_OPTIONS}
            disabled={disabled}
            onChange={(grade) => onChange({ grade })}
            className="w-full"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bundle-name">프린트 이름</Label>
        <Input
          id="bundle-name"
          value={bundle.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="예: 봄봄 학습지"
          disabled={disabled}
        />
        {errors?.name && <p className="text-xs text-red-600">{errors.name}</p>}
        <p className="text-xs text-gray-400">시험지 제목과 카테고리에 그대로 쓰입니다.</p>
      </div>

      <label className="flex items-start gap-2 rounded-md border border-gray-200 p-2.5">
        <Checkbox
          checked={bundle.includeHandwriting}
          onCheckedChange={(checked) => onChange({ includeHandwriting: checked === true })}
          disabled={disabled}
          aria-label="손글씨도 읽기"
          className="mt-0.5"
        />
        <span className="text-sm">
          <span className="font-medium text-gray-900">손글씨(학생 답·필기)도 읽기</span>
          <span className="mt-0.5 block text-xs text-gray-500">
            꺼 두면 인쇄된 글만 옮기고, 손으로 채운 빈칸도 빈칸으로 남깁니다.
          </span>
        </span>
      </label>

      <p className="text-xs text-gray-500">
        고른 쪽 {pageCount}쪽
        {errors?.pages && <span className="ml-1 text-red-600">· {errors.pages}</span>}
      </p>
    </div>
  );
}
