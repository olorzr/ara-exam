'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OptionSelect } from '@/components/ui/option-select';
import { schoolOptionLabel } from '@/lib/category-master';
import { buildYearOptions, EXTERNAL_GRADE_OPTIONS } from '@/lib/external-category';
import type { BundleDraft } from '@/lib/print-scan/bundles';
import type { SelectableSchool } from '@/types';

interface BundleFormProps {
  bundle: BundleDraft;
  schools: SelectableSchool[];
  errors?: { name?: string; school?: string; pages?: string };
  pageCount: number;
  disabled?: boolean;
  onChange: (patch: Partial<BundleDraft>) => void;
}

/**
 * 고른 프린트 한 장의 정보 — 학교·년도·학년·이름·손글씨 여부.
 *
 * 값은 개념지와 **같은 규약**이다: 학교/년도/학년/프린트명이 그대로 외부지문 카테고리가 된다.
 * 그래서 '미지정' ↔ '' 변환도 같은 함수(`toStoredValue`)를 지나며, 그 변환은 저장 직전
 * (`toBundleInsert`)에 한 번만 한다 — 화면은 표시값을 그대로 들고 있는다.
 *
 * ⚠️ 학교는 **관리자시스템 학교 마스터**에서 온다. 여기서 새 학교를 만들지 않는다 —
 *    손으로 적은 이름이 마스터와 갈라지는 바람에 예전엔 선택지가 두 곳뿐이었다.
 * ⚠️ 선택지의 값은 이름이 아니라 **학교 id** 다. 마스터에는 이름 UNIQUE 가 없어,
 *    이름으로 id 를 되찾으면 동명 학교가 생기는 순간 조용히 엉뚱한 학교에 붙는다.
 */
export default function BundleForm({
  bundle, schools, errors, pageCount, disabled, onChange,
}: BundleFormProps) {
  const schoolOptions = schools.map((s) => ({ value: s.id, label: schoolOptionLabel(s) }));
  // 새로 올리는 프린트라 '데이터에 있는 년도' 가 없다 — 롤링 윈도만으로 충분하다
  const yearOptions = buildYearOptions([]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="bundle-school">학교</Label>
        <OptionSelect
          id="bundle-school"
          value={bundle.schoolId}
          options={schoolOptions}
          placeholder="학교를 고르세요"
          disabled={disabled}
          onChange={(id) => onChange({
            schoolId: id,
            // 저장되는 이름은 꼬리표가 붙지 않은 원래 이름이다(라벨과 값을 헷갈리지 말 것)
            schoolName: schools.find((s) => s.id === id)?.name ?? '',
          })}
          className="w-full"
        />
        {errors?.school && <p className="text-xs text-red-600">{errors.school}</p>}
        <p className="text-xs text-gray-400">
          목록에 없는 학교는 관리자시스템 › 학원 관리 › 학교 에서 먼저 등록해 주세요.
        </p>
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
