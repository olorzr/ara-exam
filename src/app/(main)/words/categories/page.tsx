'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CurriculumCategoryTab, ExternalCategoryTab } from '@/components/words';

/**
 * 카테고리 마스터 데이터 관리 페이지.
 * 중등/고등 교과 탭과 외부지문/프린트 탭을 셸로 묶는다. 각 탭의 상태·CRUD 는
 * 해당 탭 컴포넌트가 self-contained 로 관리한다.
 */
export default function CategoryManagePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/words">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            돌아가기
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">📂 카테고리 관리</h1>
      </div>

      <Tabs defaultValue="school">
        <TabsList>
          <TabsTrigger value="school">중등 / 고등</TabsTrigger>
          <TabsTrigger value="external">외부지문 및 프린트</TabsTrigger>
        </TabsList>

        <TabsContent value="school">
          <CurriculumCategoryTab />
        </TabsContent>

        <TabsContent value="external">
          <ExternalCategoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
