'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { useLazyLoad } from '@/hooks/useLazyLoad';
import { getAllSelectableCategories } from '@/lib/category-master';
import { EXTERNAL_LEVEL } from '@/lib/constants';
import type { Category } from '@/types';
import type { ReferenceUnit } from '@/types/reference-text';
import UnitPickBody from './UnitPickBody';

/**
 * 고를 수 있는 단원 카테고리 — 중등·고등만.
 * ⚠️ 외부지문·프린트는 뺀다: 학교 축은 없고(원장님 결정) 교과서 단원도 없다.
 * @returns 카테고리
 */
async function loadUnitCategories(): Promise<Category[]> {
  const all = await getAllSelectableCategories();
  return all.filter((c) => c.level !== EXTERNAL_LEVEL);
}

interface UnitPickSheetProps {
  value: ReferenceUnit[];
  onChange: (units: ReferenceUnit[]) => void;
}

/**
 * '단원 고르기' 단추와 왼쪽에서 열리는 시트.
 *
 * 개념지 머리의 카테고리 시트와 같은 모양이다(`ExamCategoryBar`). 다른 점: 하나를 고르고
 * 닫히는 것이 아니라 **열린 채로 여러 개를 붙이고 뗀다** — 같은 작품이 여러 교과서에 실린다.
 * 카테고리는 **처음 열 때** 읽는다(`useLazyLoad`).
 * @param props - 붙은 단원과 바뀐 목록 콜백
 * @returns 단추와 시트
 */
export default function UnitPickSheet({ value, onChange }: UnitPickSheetProps) {
  const [open, setOpen] = useState(false);
  const { data: categories, failed, ensureLoaded } = useLazyLoad(loadUnitCategories);

  const openSheet = () => {
    ensureLoaded();
    setOpen(true);
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={openSheet}>
        <Plus className="h-3.5 w-3.5" />
        <span className="ml-1">단원 고르기</span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-[380px] flex-col sm:max-w-[380px]">
          <SheetHeader>
            <SheetTitle>교과서 단원 고르기</SheetTitle>
            <SheetDescription>
              이 작품이 실린 단원을 모두 고르세요. 교과서가 여럿이면 각각 붙입니다.
            </SheetDescription>
          </SheetHeader>
          <UnitPickBody
            categories={categories}
            failed={failed}
            onRetry={ensureLoaded}
            value={value}
            onChange={onChange}
          />
          <SheetFooter className="border-t border-gray-100">
            <Button type="button" onClick={() => setOpen(false)}>다 골랐어요</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
