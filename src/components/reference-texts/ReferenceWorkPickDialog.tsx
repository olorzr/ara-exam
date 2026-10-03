'use client';

import { useState } from 'react';
import { Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useLazyLoad } from '@/hooks/useLazyLoad';
import { fetchWorkFacets } from '@/lib/problem-bank/facets';
import WorkPickBody, { type PickedWork } from './WorkPickBody';

interface ReferenceWorkPickDialogProps {
  onPick: (work: PickedWork) => void;
}

/**
 * '작품 고르기' 단추와 문제 은행 작품 창.
 *
 * 고르면 제목·지은이 칸이 채워지고 창이 닫힌다. 칸은 그대로 손으로 고칠 수 있다 —
 * 문제 은행에 아직 없는 작품도 올릴 수 있어야 한다.
 * ⚠️ 작품 목록은 문항·지문 전체를 훑어 만들어서 **처음 열 때** 한 번만 읽는다(`useLazyLoad`).
 * @param props - 고른 작품 콜백
 * @returns 단추와 창
 */
export default function ReferenceWorkPickDialog({ onPick }: ReferenceWorkPickDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: facets, failed, ensureLoaded } = useLazyLoad(fetchWorkFacets);

  const openDialog = () => {
    ensureLoaded();
    setOpen(true);
  };

  const pick = (work: PickedWork) => {
    onPick(work);
    setOpen(false);
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={openDialog}>
        <Library className="h-3.5 w-3.5" />
        <span className="ml-1">문제 은행에서 작품 고르기</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle className="text-base">작품 고르기</DialogTitle>
          <DialogDescription>
            문제 은행에 쌓인 작품에서 고르면 기출과 같은 표기로 제목·지은이가 들어가요.
          </DialogDescription>
          <WorkPickBody facets={facets} failed={failed} onRetry={ensureLoaded} onPick={pick} />
        </DialogContent>
      </Dialog>
    </>
  );
}
