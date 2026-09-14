'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BundleDraft } from '@/lib/print-scan/bundles';
import { composePrintName } from '@/lib/print-scan/scan-meta';

interface BundleFormProps {
  bundle: BundleDraft;
  /** 스캔 제목 — 저장되는 프린트 이름의 앞부분 */
  scanTitle: string;
  errors?: { name?: string; pages?: string };
  pageCount: number;
  disabled?: boolean;
  onChange: (patch: Partial<BundleDraft>) => void;
}

/**
 * 고른 프린트 한 장의 정보 — 이름·손글씨·단어 등록.
 *
 * 학교·학년도·학년·학기·시험은 **스캔을 올릴 때 한 번** 고른다(`ScanMetaForm`) — 여기는
 * 프린트마다 실제로 다른 것만 묻는다.
 *
 * 저장되는 이름은 **스캔 제목 + 여기 적은 이름**이다(`composePrintName`). 그 값이 그대로
 * 시험지 제목이자 카테고리 트리의 프린트 이름이 되므로, 무엇으로 저장되는지 미리 보여 준다 —
 * 안 보여 주면 트리에서 처음 보는 긴 이름을 만나게 된다.
 */
export default function BundleForm({
  bundle, scanTitle, errors, pageCount, disabled, onChange,
}: BundleFormProps) {
  const fullName = composePrintName(scanTitle, bundle.name);

  return (
    <div className="space-y-3">
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
        <p className="text-xs text-gray-400">
          저장되는 이름: <span className="text-gray-600">{fullName || '—'}</span>
        </p>
        <p className="text-xs text-gray-400">
          비우면 스캔 제목이 그대로 프린트 이름이 됩니다. 시험지 제목과 카테고리에 그대로 쓰입니다.
        </p>
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

      <label className="flex items-start gap-2 rounded-md border border-gray-200 p-2.5">
        <Checkbox
          checked={bundle.registerWords}
          onCheckedChange={(checked) => onChange({ registerWords: checked === true })}
          disabled={disabled}
          aria-label="단어 목록도 등록"
          className="mt-0.5"
        />
        <span className="text-sm">
          <span className="font-medium text-gray-900">단어 목록도 등록</span>
          <span className="mt-0.5 block text-xs text-gray-500">
            프린트에 &apos;단어 — 뜻&apos; 으로 적힌 어휘를 이 프린트의 단어로 등록해요.
            뜻이 안 적힌 단어는 등록하지 않고 따로 알려 드려요. 읽기가 끝난 뒤 ChatGPT 를 한 번 더 씁니다.
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
