'use client';

import Link from 'next/link';
import type { CategoryLevel } from '@/types';
import { EXTERNAL_LEVEL, SEMESTER_OPTIONS } from '@/lib/constants';
import { UNSPECIFIED_OPTION } from '@/lib/external-category';
import { schoolOptionLabel } from '@/lib/category-master';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OptionSelect, type SelectOption } from '@/components/ui/option-select';
import { Settings } from 'lucide-react';
import { useCategoryFormState, type CategoryFormProps } from '@/hooks/useCategoryFormState';

/** 마스터 목록(id/name)을 선택지 모양으로 — 값은 UUID, 이름은 한글 */
const toSelectItems = (list: { id: string; name: string }[]): SelectOption[] =>
  list.map((item) => ({ value: item.id, label: item.name }));

/**
 * 단어 입력 시 카테고리(구분/학년/출판사/학기/단원) 선택 폼 컴포넌트.
 * 마스터 데이터에서 등록된 항목만 선택 가능하다. 데이터 로딩/선택 상태 로직은
 * useCategoryFormState 훅이 담당하고, 이 컴포넌트는 화면만 그린다.
 */
export default function CategoryForm(props: CategoryFormProps) {
  const { level, year, grade, semester } = props;
  const s = useCategoryFormState(props);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">카테고리 설정</CardTitle>
        <Link
          href="/categories"
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          카테고리 관리
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>구분</Label>
            <OptionSelect
              value={level}
              options={['중등', '고등', EXTERNAL_LEVEL]}
              className="w-full"
              ariaLabel="구분"
              onChange={(v) => s.handleLevelChange(v as CategoryLevel)}
            />
          </div>

          {level !== EXTERNAL_LEVEL ? (
            <>
              <div className="space-y-2">
                <Label>학년</Label>
                <OptionSelect
                  value={grade}
                  options={s.gradeOptions}
                  placeholder="학년 선택"
                  className="w-full"
                  ariaLabel="학년"
                  onChange={s.handleGradeChange}
                />
              </div>
              <div className="space-y-2">
                <Label>출판사</Label>
                <OptionSelect
                  value={s.publisherId}
                  options={toSelectItems(s.publishers)}
                  placeholder="출판사 선택"
                  disabled={!grade}
                  className="w-full"
                  ariaLabel="출판사"
                  onChange={s.handlePublisherSelect}
                />
              </div>
              <div className="space-y-2">
                <Label>학기</Label>
                <OptionSelect
                  value={semester}
                  options={SEMESTER_OPTIONS}
                  placeholder="학기 선택"
                  disabled={!s.publisherId}
                  className="w-full"
                  ariaLabel="학기"
                  onChange={s.handleSemesterChange}
                />
              </div>
              <div className="space-y-2">
                <Label>대단원</Label>
                <OptionSelect
                  value={s.chapterId}
                  options={toSelectItems(s.chapters)}
                  placeholder="대단원 선택"
                  disabled={!semester}
                  className="w-full"
                  ariaLabel="대단원"
                  onChange={s.handleChapterSelect}
                />
              </div>
              <div className="space-y-2">
                <Label>소단원 (선택)</Label>
                <OptionSelect
                  value={s.subChapterId}
                  options={toSelectItems(s.subChaptersList)}
                  placeholder="소단원 선택"
                  disabled={!s.chapterId}
                  className="w-full"
                  ariaLabel="소단원"
                  onChange={s.handleSubChapterSelect}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>학교명</Label>
                <OptionSelect
                  value={s.schoolId}
                  options={s.schools.map((sc) => ({ value: sc.id, label: schoolOptionLabel(sc) }))}
                  placeholder="학교 선택"
                  className="w-full"
                  ariaLabel="학교명"
                  onChange={s.handleSchoolSelect}
                />
              </div>
              <div className="space-y-2">
                <Label>년도</Label>
                <OptionSelect
                  value={year}
                  options={s.yearOptions.map((y) => ({
                    value: y,
                    label: y === UNSPECIFIED_OPTION ? y : `${y}학년도`,
                  }))}
                  placeholder="년도 선택"
                  disabled={!s.schoolId}
                  className="w-full"
                  ariaLabel="년도"
                  onChange={s.handleYearChange}
                />
              </div>
              <div className="space-y-2">
                <Label>학년</Label>
                <OptionSelect
                  value={grade}
                  options={s.gradeOptions}
                  placeholder="학년 선택"
                  disabled={!year}
                  className="w-full"
                  ariaLabel="학년"
                  onChange={s.handleGradeChange}
                />
              </div>
              <div className="space-y-2">
                <Label>프린트/작품명</Label>
                <OptionSelect
                  value={s.materialId}
                  options={toSelectItems(s.materials)}
                  placeholder="프린트/작품명 선택"
                  disabled={!grade}
                  className="w-full"
                  ariaLabel="프린트/작품명"
                  onChange={s.handleMaterialSelect}
                />
              </div>
            </>
          )}
        </div>

        {/*
          안내는 **비어 있는 이유마다 가는 곳이 다르다.** 한 문장으로 묶으면 학교가 없어도
          "카테고리 관리에서 등록" 이라고 말하게 되는데, 학교는 관리자시스템이 원본이고
          프린트는 프린트 업로드만 만든다(2026-09-14).
        */}
        {s.noPublishers && (
          <p className="mt-3 text-xs text-gray-500">
            등록된 출판사가 없습니다.{' '}
            <Link href="/categories" className="text-primary underline">카테고리 관리</Link>
            에서 먼저 등록해주세요.
          </p>
        )}
        {s.noSchools && (
          <p className="mt-3 text-xs text-gray-500">
            등록된 학교가 없습니다. 관리자시스템 › 학원 관리 › 학교 에서 먼저 등록해 주세요.
          </p>
        )}
        {s.noMaterials && (
          <p className="mt-3 text-xs text-gray-500">
            이 학교·학년의 프린트가 아직 없습니다.{' '}
            <Link href="/print-sheets/upload" className="text-primary underline">학교 프린트 시험지</Link>
            에서 프린트를 올리면 여기 나타나요.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
