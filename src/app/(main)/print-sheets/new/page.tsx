'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScanMetaForm } from '@/components/print-scan';
import { getSelectableSchools } from '@/lib/category-master';
import { kstYear } from '@/lib/kst-year';
import {
  applyScanMetaPatch, composePrintName, initialScanMeta, type ScanMetaValues,
} from '@/lib/print-scan/scan-meta';
import { createTypedPrintSheet } from '@/lib/print-scan/typed-create';
import { validateTypedSheet } from '@/lib/print-scan/typed';
import type { SelectableSchool } from '@/types';

/** 목록 경로 */
const LIST_HREF = '/print-sheets';

/**
 * 학교 프린트 시험지 직접 입력 (`/print-sheets/new`).
 *
 * 스캔 없이 편집기에 바로 친다 — 개념지를 만드는 것과 같다. 여기서는 **어느 학교·학년·시험의
 * 어떤 프린트인가**만 묻고 빈 시험지를 만든 뒤, 기존 시험지 편집 화면(`/print-sheets/{id}`)으로
 * 보낸다. 편집·마킹·인쇄·성적 연동은 스캔으로 만든 시험지와 똑같다.
 *
 * 묻는 칸은 스캔 올리기와 **같은 폼**(`ScanMetaForm`)이다 — 이름·카테고리 규칙이 같아야
 * 같은 프린트가 두 길에서 다른 폴더로 갈라지지 않는다.
 */
export default function PrintSheetNewPage() {
  const router = useRouter();
  const [meta, setMeta] = useState(() => initialScanMeta(String(kstYear())));
  const [schools, setSchools] = useState<SelectableSchool[]>([]);
  const [label, setLabel] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getSelectableSchools()
      .then((rows) => { if (alive) setSchools(rows); })
      .catch(() => toast.error('학교 목록을 불러오지 못했어요.'));
    return () => { alive = false; };
  }, []);

  const changeMeta = useCallback((patch: Partial<ScanMetaValues>) => {
    setMeta((s) => applyScanMetaPatch(s, patch));
  }, []);

  const errors = validateTypedSheet(meta.values, label);
  const name = composePrintName(meta.values.title, label);

  const create = async () => {
    setTried(true);
    if (errors.school || errors.name) {
      toast.error(errors.school ?? errors.name ?? '');
      return;
    }
    setSaving(true);
    try {
      const bundleId = await createTypedPrintSheet(
        meta.values, label, (warning) => toast.warning(warning),
      );
      toast.success('빈 시험지를 만들었어요. 내용을 입력해 주세요.');
      router.push(`${LIST_HREF}/${bundleId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '시험지를 만들지 못했어요.');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">✍️ 학교 프린트 직접 입력</h1>
        <p className="mt-1 text-sm text-gray-500">
          스캔 없이 프린트 내용을 직접 입력해 빈칸 시험지로 만듭니다. 개념지를 만들 때와 같아요.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1. 어느 학교·시험의 프린트인가요?</CardTitle></CardHeader>
        <CardContent>
          <ScanMetaForm
            state={meta}
            schools={schools}
            disabled={saving}
            onChange={changeMeta}
            titleLabel="시험지 제목 앞부분"
            titleHelp="학교를 고르면 자동으로 채워지고, 아래 프린트 이름 앞에 붙어요. 직접 고쳐도 됩니다."
          />
          {tried && errors.school && <p className="mt-2 text-xs text-red-600">{errors.school}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">2. 프린트 이름</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="typed-label">작품·단원 등</Label>
          <Input
            id="typed-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예: 봄봄 학습지"
            disabled={saving}
            className="max-w-md"
          />
          <p className="text-xs text-gray-500">
            저장될 이름: <strong className="text-gray-800">{name || '—'}</strong>
          </p>
          {tried && errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={create}
          disabled={saving}
          className="bg-primary text-white hover:bg-primary-hover"
        >
          {saving ? '만드는 중…' : '만들고 입력하기'}
        </Button>
        <Link href={LIST_HREF}>
          <Button type="button" variant="outline" disabled={saving}>취소</Button>
        </Link>
      </div>
    </div>
  );
}
