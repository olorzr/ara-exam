'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SEMESTER_OPTIONS } from '@/lib/constants';
import {
  EXTERNAL_GRADE_OPTIONS, UNSPECIFIED_OPTION, buildYearOptions, toOptionValue,
} from '@/lib/external-category';
import {
  EXAM_TYPE_OPTIONS, SOURCE_TYPE_OPTIONS, suggestTitle, visibleFields,
  type SourceFormErrors, type SourceFormValues,
} from '@/lib/problem-bank/source-form';
import type { ProblemSourceType } from '@/types/problem-bank';

interface SourceMetaFormProps {
  values: SourceFormValues;
  errors: SourceFormErrors;
  /** 학교 마스터 이름 목록 (exam.schools) */
  schools: string[];
  onChange: (patch: Partial<SourceFormValues>) => void;
}

/**
 * 기출 업로드의 출처 정보 폼.
 * 유형에 따라 묻는 항목이 달라진다 — 문제집에 학교를 물으면 빈 칸만 늘어난다.
 */
export default function SourceMetaForm({ values, errors, schools, onChange }: SourceMetaFormProps) {
  const fields = useMemo(() => new Set(visibleFields(values.source_type)), [values.source_type]);
  const yearOptions = useMemo(() => buildYearOptions([values.year]), [values.year]);
  const suggestion = useMemo(() => suggestTitle(values), [values]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-2">
        <Label>출처 유형</Label>
        <Select
          value={values.source_type}
          onValueChange={(v) => { if (v) onChange({ source_type: v as ProblemSourceType }); }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SOURCE_TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {fields.has('school_name') && (
        <div className="space-y-2">
          <Label>학교</Label>
          <Select
            value={toOptionValue(values.school_name)}
            onValueChange={(v) => { if (v) onChange({ school_name: v }); }}
          >
            <SelectTrigger><SelectValue placeholder="학교 선택" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSPECIFIED_OPTION}>{UNSPECIFIED_OPTION}</SelectItem>
              {schools.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.school_name && <p className="text-xs text-red-600">{errors.school_name}</p>}
        </div>
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

      <div className="space-y-2">
        <Label>학년도</Label>
        <Select
          value={toOptionValue(values.year)}
          onValueChange={(v) => { if (v) onChange({ year: v }); }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.year && <p className="text-xs text-red-600">{errors.year}</p>}
      </div>

      <div className="space-y-2">
        <Label>학년</Label>
        <Select
          value={toOptionValue(values.grade)}
          onValueChange={(v) => { if (v) onChange({ grade: v }); }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {EXTERNAL_GRADE_OPTIONS.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {fields.has('semester') && (
        <div className="space-y-2">
          <Label>학기</Label>
          <Select
            value={toOptionValue(values.semester)}
            onValueChange={(v) => { if (v) onChange({ semester: v }); }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSPECIFIED_OPTION}>{UNSPECIFIED_OPTION}</SelectItem>
              {SEMESTER_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {fields.has('exam_type') && (
        <div className="space-y-2">
          <Label>시험</Label>
          <Select
            value={toOptionValue(values.exam_type)}
            onValueChange={(v) => { if (v) onChange({ exam_type: v }); }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSPECIFIED_OPTION}>{UNSPECIFIED_OPTION}</SelectItem>
              {EXAM_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2 sm:col-span-2 lg:col-span-3">
        <Label htmlFor="source-title">제목</Label>
        <Input
          id="source-title"
          value={values.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={suggestion || '예: 2026 상현중 중2 1학기 중간'}
        />
        {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
        {!values.title && suggestion && (
          <button
            type="button"
            className="text-xs text-primary underline underline-offset-2"
            onClick={() => onChange({ title: suggestion })}
          >
            &lsquo;{suggestion}&rsquo; 로 채우기
          </button>
        )}
      </div>
    </div>
  );
}
