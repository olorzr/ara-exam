'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { getAllSelectableCategories } from '@/lib/category-master';
import { buildCategoryTree } from '@/lib/category-tree';
import { categoryNaturalKey } from '@/lib/category-key';
import CategoryTree from '@/components/words/CategoryTree';
import { formatCategoryLabel } from '@/lib/format';
import { FolderOpen, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Category, CategoryLevel } from '@/types';

/** 빌더 카테고리 정보 */
export interface BuilderCategory {
  level: CategoryLevel;
  /** 학년도(외부지문 전용). '' 는 미지정 */
  year: string;
  grade: string;
  publisher: string;
  semester: string;
  unit: string;
  subunit: string;
  /** 학교명(외부지문 전용) */
  schoolName: string;
}

interface ExamCategoryBarProps {
  category: BuilderCategory;
  onChange: (cat: BuilderCategory) => void;
}

/**
 * Category → BuilderCategory 변환.
 * 단어관리의 카테고리를 빌더용 형식으로 매핑한다.
 */
function toBuilderCategory(cat: Category): BuilderCategory {
  return {
    level: cat.level,
    year: cat.year,
    grade: cat.grade,
    publisher: cat.publisher,
    semester: cat.semester,
    unit: cat.chapter,
    subunit: cat.sub_chapter || '',
    schoolName: cat.school_name || '',
  };
}

/** BuilderCategory → Category 변환(라벨 포맷·자연키 비교용 어댑터) */
function toCategory(cat: BuilderCategory): Category {
  return {
    id: '',
    level: cat.level,
    year: cat.year,
    grade: cat.grade,
    publisher: cat.publisher,
    semester: cat.semester,
    chapter: cat.unit,
    sub_chapter: cat.subunit,
    school_name: cat.schoolName,
    user_id: '',
    created_at: '',
  };
}

/**
 * 개념지 빌더 상단 카테고리 선택 바.
 * 단어관리·시험지 생성과 동일한 카테고리 소스(getAllSelectableCategories)에서 선택한다.
 */
export default function ExamCategoryBar({ category, onChange }: ExamCategoryBarProps) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setCategories(await getAllSelectableCategories());
      } catch {
        // 예전엔 에러를 삼켜서 RLS/네트워크 실패가 "카테고리가 없습니다" 로만 보였다.
        toast.error('카테고리를 불러오지 못했어요.');
      }
    })();
  }, []);

  // 개념지는 카테고리 id 가 아니라 텍스트를 복사 저장하므로, 현재 카테고리를 자연키로
  // 대조해 트리의 선택 상태를 파생시킨다(예전엔 초기화가 없어 기존 개념지를 열면
  // 아무것도 선택돼 있지 않은 것처럼 보였다).
  const selectedCategoryId = useMemo(() => {
    // 정규화 키로 대조한다 — 개념지에 옛 표기(`천재 (정호웅)`)로 저장돼 있어도
    // 정규형 트리 노드와 매칭되어 선택 상태가 살아난다.
    const key = categoryNaturalKey(toCategory(category));
    return categories.find((c) => categoryNaturalKey(c) === key)?.id;
  }, [categories, category]);

  const filtered = useMemo(
    () => (searchQuery
      ? categories.filter((c) =>
        formatCategoryLabel(c).toLowerCase().includes(searchQuery.toLowerCase()))
      : categories),
    [categories, searchQuery],
  );

  const tree = useMemo(() => buildCategoryTree(filtered), [filtered]);

  const handleSelect = (cat: Category) => {
    onChange(toBuilderCategory(cat));
    setOpen(false);
  };

  const label = category.unit ? formatCategoryLabel(toCategory(category)) : '카테고리를 선택하세요';

  return (
    <div className="bg-white border-b-2 border-primary p-4 flex items-center gap-3 sticky top-[var(--app-topbar-h)] z-40" data-no-print>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="outline" className="border-primary text-primary hover:bg-primary/5" />
          }
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          카테고리 선택
        </SheetTrigger>
        <SheetContent side="left" className="w-[380px] sm:max-w-[380px]">
          <SheetHeader>
            <SheetTitle>카테고리 선택</SheetTitle>
            <SheetDescription>학년 · 출판사 · 단원 또는 외부지문을 선택하세요.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="카테고리 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* 검색 중에는 트리를 펼쳐 둔다 — 기본 접힘(depth<2)이라 매칭된 단원이
                3단계 아래에 숨어 "검색이 안 먹는다"로 보였다. */}
            <CategoryTree
              nodes={tree}
              selectedId={selectedCategoryId}
              onSelect={handleSelect}
              forceExpanded={!!searchQuery}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${category.unit ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
          {label}
        </p>
      </div>
    </div>
  );
}
