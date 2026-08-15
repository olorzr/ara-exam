'use client';

import Link from 'next/link';
import type { CategoryLevel } from '@/types';
import { EXTERNAL_LEVEL, SEMESTER_OPTIONS } from '@/lib/constants';
import { UNSPECIFIED_OPTION } from '@/lib/external-category';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings } from 'lucide-react';
import { useCategoryFormState, type CategoryFormProps } from '@/hooks/useCategoryFormState';

/**
 * 마스터 목록(id/name)을 base-ui Select 의 items(value→label) 구조로 변환한다.
 * items 를 넘기지 않으면 SelectValue 가 팝업을 한 번도 열기 전까지 선택된 value(UUID)를
 * 그대로 표시하므로, 한글 이름이 보이도록 매핑을 제공한다.
 */
const toSelectItems = (list: { id: string; name: string }[]) =>
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
            <Select value={level} onValueChange={(v) => { if (v) s.handleLevelChange(v as CategoryLevel); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="중등">중등</SelectItem>
                <SelectItem value="고등">고등</SelectItem>
                <SelectItem value={EXTERNAL_LEVEL}>외부지문 및 프린트</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {level !== EXTERNAL_LEVEL ? (
            <>
              <div className="space-y-2">
                <Label>학년</Label>
                <Select value={grade} onValueChange={(v) => { if (v) s.handleGradeChange(v); }}>
                  <SelectTrigger><SelectValue placeholder="학년 선택" /></SelectTrigger>
                  <SelectContent>
                    {s.gradeOptions.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>출판사</Label>
                <Select value={s.publisherId} items={toSelectItems(s.publishers)} onValueChange={(v) => { if (v) s.handlePublisherSelect(v); }} disabled={!grade}>
                  <SelectTrigger><SelectValue placeholder="출판사 선택" /></SelectTrigger>
                  <SelectContent>
                    {s.publishers.map((p) => (
                      <SelectItem key={p.id} value={p.id} label={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>학기</Label>
                <Select value={semester} onValueChange={(v) => { if (v) s.handleSemesterChange(v); }} disabled={!s.publisherId}>
                  <SelectTrigger><SelectValue placeholder="학기 선택" /></SelectTrigger>
                  <SelectContent>
                    {SEMESTER_OPTIONS.map((sem) => (
                      <SelectItem key={sem} value={sem}>{sem}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>대단원</Label>
                <Select value={s.chapterId} items={toSelectItems(s.chapters)} onValueChange={(v) => { if (v) s.handleChapterSelect(v); }} disabled={!semester}>
                  <SelectTrigger><SelectValue placeholder="대단원 선택" /></SelectTrigger>
                  <SelectContent>
                    {s.chapters.map((c) => (
                      <SelectItem key={c.id} value={c.id} label={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>소단원 (선택)</Label>
                <Select value={s.subChapterId} items={toSelectItems(s.subChaptersList)} onValueChange={(v) => { if (v) s.handleSubChapterSelect(v); }} disabled={!s.chapterId}>
                  <SelectTrigger><SelectValue placeholder="소단원 선택" /></SelectTrigger>
                  <SelectContent>
                    {s.subChaptersList.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id} label={sub.name}>{sub.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>학교명</Label>
                <Select value={s.schoolId} items={toSelectItems(s.schools)} onValueChange={(v) => { if (v) s.handleSchoolSelect(v); }}>
                  <SelectTrigger><SelectValue placeholder="학교 선택" /></SelectTrigger>
                  <SelectContent>
                    {s.schools.map((sch) => (
                      <SelectItem key={sch.id} value={sch.id} label={sch.name}>{sch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>년도</Label>
                <Select value={year} onValueChange={(v) => { if (v) s.handleYearChange(v); }} disabled={!s.schoolId}>
                  <SelectTrigger><SelectValue placeholder="년도 선택" /></SelectTrigger>
                  <SelectContent>
                    {s.yearOptions.map((y) => (
                      <SelectItem key={y} value={y}>{y === UNSPECIFIED_OPTION ? y : `${y}학년도`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>학년</Label>
                <Select value={grade} onValueChange={(v) => { if (v) s.handleGradeChange(v); }} disabled={!year}>
                  <SelectTrigger><SelectValue placeholder="학년 선택" /></SelectTrigger>
                  <SelectContent>
                    {s.gradeOptions.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>프린트/작품명</Label>
                <Select value={s.materialId} items={toSelectItems(s.materials)} onValueChange={(v) => { if (v) s.handleMaterialSelect(v); }} disabled={!grade}>
                  <SelectTrigger><SelectValue placeholder="프린트/작품명 선택" /></SelectTrigger>
                  <SelectContent>
                    {s.materials.map((m) => (
                      <SelectItem key={m.id} value={m.id} label={m.name}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        {(s.noPublishers || s.noSchools) && (
          <p className="mt-3 text-xs text-gray-500">
            등록된 항목이 없습니다.{' '}
            <Link href="/categories" className="text-primary underline">카테고리 관리</Link>
            에서 먼저 등록해주세요.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
