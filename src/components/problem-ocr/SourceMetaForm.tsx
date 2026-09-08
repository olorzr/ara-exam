'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SEMESTER_OPTIONS } from '@/lib/constants';
import {
  UNSPECIFIED_OPTION, buildYearOptions, toOptionValue, toStoredValue,
} from '@/lib/external-category';
import type { NaesinSchool } from '@/lib/naesin-scope/types';
import type { ScopeHint } from '@/lib/problem-bank/scope-resolve';
import {
  EXAM_TYPE_OPTIONS, SCHOOL_LEVEL_OPTIONS, SOURCE_TYPE_OPTIONS, gradeOptionsForLevel,
  suggestTitle, visibleFields,
  type SchoolLevel, type SourceFormErrors, type SourceFormValues,
} from '@/lib/problem-bank/source-form';
import type { ProblemSourceType } from '@/types/problem-bank';
import LabeledSelect from './LabeledSelect';
import SourceTextbookField from './SourceTextbookField';

interface SourceMetaFormProps {
  values: SourceFormValues;
  errors: SourceFormErrors;
  /** 관리자시스템에 등록된 그 학교급의 학교 */
  schools: NaesinSchool[];
  /** 그 학교급의 교과서 이름 (= exam.publishers.name) */
  textbooks: string[];
  /** 내신 관리에 등록된 시험범위 힌트 */
  scope: ScopeHint | null;
  onChange: (patch: Partial<SourceFormValues>) => void;
}

/**
 * 기출 업로드의 출처 정보 폼.
 *
 * 묻는 순서가 곧 좁혀 가는 순서다: **학교급 → 학교 → 학년**. 학교급을 먼저 골라야
 * 학교 목록(중학교 15 / 고등학교 5)과 학년(중1~3 / 고1~3)을 그 급으로 좁힐 수 있다.
 * 유형에 따라 묻는 항목이 달라진다 — 문제집에 학교를 물으면 빈 칸만 늘어난다.
 *
 * 제목은 **버튼 없이** 고른 값을 따라간다(`applySourcePatch`). 직접 치면 그대로 두고,
 * 비우면 다시 따라간다.
 */
export default function SourceMetaForm({
  values, errors, schools, textbooks, scope, onChange,
}: SourceMetaFormProps) {
  const fields = useMemo(() => new Set(visibleFields(values.source_type)), [values.source_type]);
  const yearOptions = useMemo(() => buildYearOptions([values.year]), [values.year]);
  const suggestion = useMemo(() => suggestTitle(values), [values]);

  const schoolOptions = useMemo(() => [
    { value: UNSPECIFIED_OPTION, label: UNSPECIFIED_OPTION },
    ...schools.map((s) => ({ value: s.id, label: s.name })),
  ], [schools]);

  // 학교는 id 로 고르고 이름을 함께 담는다 — 표시·필터·문제지 스냅샷이 이름을 쓴다
  const pickSchool = (id: string) => {
    if (id === UNSPECIFIED_OPTION) {
      onChange({ school_id: '', school_name: '' });
      return;
    }
    onChange({ school_id: id, school_name: schools.find((s) => s.id === id)?.name ?? '' });
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <LabeledSelect
        label="출처 유형"
        value={values.source_type}
        options={SOURCE_TYPE_OPTIONS}
        onChange={(v) => onChange({ source_type: v as ProblemSourceType })}
      />

      <LabeledSelect
        label="학교급"
        value={values.level}
        options={SCHOOL_LEVEL_OPTIONS}
        onChange={(v) => onChange({ level: v as SchoolLevel })}
      />

      {fields.has('school_name') && (
        <LabeledSelect
          label="학교"
          value={values.school_id || UNSPECIFIED_OPTION}
          options={schoolOptions}
          placeholder="학교 선택"
          error={errors.school_name}
          onChange={pickSchool}
        />
      )}

      <LabeledSelect
        label="학년"
        value={toOptionValue(values.grade)}
        options={gradeOptionsForLevel(values.level)}
        onChange={(v) => onChange({ grade: toStoredValue(v) })}
      />

      <LabeledSelect
        label="학년도"
        value={toOptionValue(values.year)}
        options={yearOptions}
        error={errors.year}
        onChange={(v) => onChange({ year: toStoredValue(v) })}
      />

      {fields.has('semester') && (
        <LabeledSelect
          label="학기"
          value={toOptionValue(values.semester)}
          options={[UNSPECIFIED_OPTION, ...SEMESTER_OPTIONS]}
          onChange={(v) => onChange({ semester: toStoredValue(v) })}
        />
      )}

      {fields.has('exam_type') && (
        <LabeledSelect
          label="시험"
          value={toOptionValue(values.exam_type)}
          options={[UNSPECIFIED_OPTION, ...EXAM_TYPE_OPTIONS]}
          onChange={(v) => onChange({ exam_type: toStoredValue(v) })}
        />
      )}

      {fields.has('publisher') && (
        <div className="space-y-2">
          <Label>{values.source_type === '모의고사' ? '주관' : '출판사'}</Label>
          <Input
            value={values.publisher}
            onChange={(e) => onChange({ publisher: e.target.value })}
            placeholder={values.source_type === '모의고사' ? '교육청 · 평가원' : '출판사 이름'}
          />
        </div>
      )}

      <SourceTextbookField
        value={values.textbook}
        textbooks={textbooks}
        scope={scope}
        onChange={(v) => onChange({ textbook: v })}
      />

      <div className="space-y-2 sm:col-span-2 lg:col-span-3">
        <Label htmlFor="source-title">제목</Label>
        <Input
          id="source-title"
          value={values.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={suggestion || '예: 2026 상현중 중2 1학기 중간'}
        />
        {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
      </div>
    </div>
  );
}
