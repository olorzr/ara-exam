'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CurriculumCategoryTab, ExternalCategoryTab } from '@/components/words';

/**
 * 카테고리 마스터 데이터 관리 페이지 (최상위 메뉴 `/categories`).
 * 중등/고등 교과 탭과 외부지문/프린트 탭을 셸로 묶는다. 각 탭의 상태·CRUD 는
 * 해당 탭 컴포넌트가 self-contained 로 관리한다.
 *
 * 여기서 만든 출판사·대단원·소단원은 단어/개념 분류일 뿐 아니라,
 * ara-system(학원 관리)이 매일 새벽 읽어가 내신 관리의 **교과서 목차**가 된다.
 */
export default function CategoryManagePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📂 카테고리 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          출판사 · 대단원 · 소단원을 관리합니다. 여기 등록한 교과서 목차가 학원 관리의 내신 시험범위에도 그대로 쓰여요.
        </p>
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
