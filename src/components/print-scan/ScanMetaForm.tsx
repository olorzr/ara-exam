'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LabeledSelect from '@/components/problem-ocr/LabeledSelect';
import { schoolOptionLabel } from '@/lib/category-master';
import { buildYearOptions } from '@/lib/external-category';
import { SCHOOL_LEVEL_OPTIONS, type SchoolLevel } from '@/lib/problem-bank/source-form';
import {
  examTypeOptionsForScan, gradeOptionsForScan, schoolsForLevel, semesterOptionsForScan,
  suggestScanTitle, type ScanMetaState, type ScanMetaValues,
} from '@/lib/print-scan/scan-meta';
import type { SelectableSchool } from '@/types';

interface ScanMetaFormProps {
  state: ScanMetaState;
  schools: SelectableSchool[];
  disabled?: boolean;
  onChange: (patch: Partial<ScanMetaValues>) => void;
}

/**
 * 스캔 한 건의 공통 정보 — **학교급 → 학교 → 학년 → 학년도 → 학기 → 중간/기말**.
 *
 * 묻는 순서가 곧 좁혀 가는 순서다(기출 업로드의 `SourceMetaForm` 과 같은 규약):
 * 학교급을 먼저 골라야 학교 목록과 학년을 그 급으로 좁힐 수 있다. 예전에는 이 값들을
 * 프린트마다 물었는데, 한 번에 스캔해 오는 프린트는 거의 같은 시험 것이라 같은 값을
 * 대여섯 번 고르게 됐다.
 *
 * ⚠️ 학교는 **관리자시스템 학교 마스터**에서 온다(여기서 새로 만들지 않는다).
 * ⚠️ 선택지의 값은 이름이 아니라 **학교 id** 다 — 마스터에는 이름 UNIQUE 가 없어
 *    이름으로 id 를 되찾으면 동명 학교가 생기는 순간 조용히 엉뚱한 학교에 붙는다.
 */
export default function ScanMetaForm({ state, schools, disabled, onChange }: ScanMetaFormProps) {
  const { values } = state;
  const schoolOptions = schoolsForLevel(schools, values.level)
    .map((s) => ({ value: s.id, label: schoolOptionLabel(s) }));
  // 새로 올리는 스캔이라 '데이터에 있는 년도' 가 없다 — 롤링 윈도만으로 충분하다
  const yearOptions = buildYearOptions([]);
  const suggestion = suggestScanTitle(values);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <LabeledSelect
          label="학교급"
          value={values.level}
          options={SCHOOL_LEVEL_OPTIONS}
          disabled={disabled}
          onChange={(v) => onChange({ level: v as SchoolLevel })}
        />

        <LabeledSelect
          label="학교"
          value={values.schoolId}
          options={schoolOptions}
          placeholder="학교를 고르세요"
          disabled={disabled}
          onChange={(id) => onChange({
            schoolId: id,
            // 저장되는 이름은 꼬리표('옛 항목')가 붙지 않은 원래 이름이다
            schoolName: schools.find((s) => s.id === id)?.name ?? '',
          })}
        />

        <LabeledSelect
          label="학년"
          value={values.grade}
          options={gradeOptionsForScan(values.level)}
          disabled={disabled}
          onChange={(grade) => onChange({ grade })}
        />

        <LabeledSelect
          label="학년도"
          value={values.year}
          options={yearOptions}
          disabled={disabled}
          onChange={(year) => onChange({ year })}
        />

        <LabeledSelect
          label="학기"
          value={values.semester}
          options={semesterOptionsForScan()}
          disabled={disabled}
          onChange={(semester) => onChange({ semester })}
        />

        <LabeledSelect
          label="시험"
          value={values.examType}
          options={examTypeOptionsForScan()}
          disabled={disabled}
          onChange={(examType) => onChange({ examType })}
        />
      </div>

      <p className="text-xs text-gray-400">
        목록에 없는 학교는 관리자시스템 › 학원 관리 › 학교 에서 먼저 등록해 주세요.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="scan-title">스캔 제목</Label>
        <Input
          id="scan-title"
          value={values.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={suggestion || '학교를 고르면 자동으로 채워져요'}
          disabled={disabled}
          className="max-w-md"
        />
        <p className="text-xs text-gray-400">
          목록에서 이 스캔을 찾는 이름이고, <strong>프린트 이름 앞에 그대로 붙습니다.</strong>
          {' '}직접 고쳐도 되고, 비우면 다시 자동으로 채워집니다.
        </p>
      </div>
    </div>
  );
}
