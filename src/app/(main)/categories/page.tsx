'use client';

import { CurriculumCategoryTab } from '@/components/words';

/**
 * 카테고리 마스터 데이터 관리 페이지 (최상위 메뉴 `/categories`).
 * 중등/고등 교과서 목차(출판사 · 대단원 · 소단원)를 관리한다.
 *
 * 여기서 만든 출판사·대단원·소단원은 단어/개념 분류일 뿐 아니라,
 * ara-system(학원 관리)이 매일 새벽 읽어가 내신 관리의 **교과서 목차**가 된다.
 *
 * ⚠️ **외부지문·프린트 탭은 없다**(2026-09-14). 학교는 관리자시스템이 원본이고
 *    프린트는 `학교 프린트 시험지` 업로드가 `ensureSchoolMaterial` 로 자동 등록한다 —
 *    손으로 적는 길을 함께 두면 이름이 갈라져 트리가 두 폴더로 쪼개진다.
 */
export default function CategoryManagePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📂 카테고리 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          중등 · 고등 교과서의 출판사 · 대단원 · 소단원을 관리합니다. 여기 등록한 교과서 목차가 학원 관리의 내신 시험범위에도 그대로 쓰여요.
        </p>
      </div>

      <CurriculumCategoryTab />
    </div>
  );
}
