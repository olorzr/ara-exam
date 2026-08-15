'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { EXTERNAL_LEVEL, DRAFT_STORAGE_KEY } from '@/lib/constants';
import {
  ensureCategoryId,
  findDuplicateWords,
  removeDuplicateWords,
  insertWordsToCategory,
  type DuplicateWordsResult,
} from '@/lib/words-save';
import { toStoredValue } from '@/lib/external-category';
import type { CategoryLevel } from '@/types';
import type { WordEntry } from '@/components/words';
import { CategoryForm, WordEntryTable, DuplicateWordsDialog } from '@/components/words';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface DraftShape {
  level: CategoryLevel;
  year: string;
  grade: string;
  publisher: string;
  semester: string;
  chapter: string;
  subChapter: string;
  schoolName: string;
  wordEntries: WordEntry[];
}

const CATEGORY_LEVELS: readonly CategoryLevel[] = ['중등', '고등', '외부지문 및 프린트'];

const isWordEntry = (v: unknown): v is WordEntry =>
  typeof v === 'object'
  && v !== null
  && typeof (v as WordEntry).word === 'string'
  && typeof (v as WordEntry).meaning === 'string';

const isDraftShape = (v: unknown): v is DraftShape => {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  if (!CATEGORY_LEVELS.includes(d.level as CategoryLevel)) return false;
  if (!Array.isArray(d.wordEntries) || !d.wordEntries.every(isWordEntry)) return false;
  return true;
};

/**
 * 새 단어 입력 페이지 (카테고리 설정 + 단어 목록 입력)
 */
export default function NewWordsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [level, setLevel] = useState<CategoryLevel>('중등');
  const [year, setYear] = useState('');
  const [grade, setGrade] = useState('');
  const [publisher, setPublisher] = useState('');
  const [semester, setSemester] = useState('');
  const [chapter, setChapter] = useState('');
  const [subChapter, setSubChapter] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [wordEntries, setWordEntries] = useState<WordEntry[]>([{ word: '', meaning: '' }]);
  const [saving, setSaving] = useState(false);

  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateWordsResult | null>(null);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const [pendingValidWords, setPendingValidWords] = useState<WordEntry[] | null>(null);

  const validateInputs = (validWords: WordEntry[]): boolean => {
    if (validWords.length === 0) {
      toast.error('최소 1개의 단어를 입력해주세요.');
      return false;
    }
    if (level !== EXTERNAL_LEVEL && (!grade || !publisher || !semester || !chapter)) {
      toast.error('학년, 출판사, 학기, 대단원을 모두 입력해주세요.');
      return false;
    }
    if (level === EXTERNAL_LEVEL && (!schoolName || !year || !grade || !chapter)) {
      toast.error('학교, 년도, 학년, 프린트/작품명을 모두 선택해주세요.');
      return false;
    }
    return true;
  };

  const finalizeInsert = async (categoryId: string, words: WordEntry[]) => {
    const result = await insertWordsToCategory(categoryId, words);
    if (!result.ok) {
      toast.error('단어 저장 중 오류가 발생했습니다.');
      return false;
    }

    const skipped = result.skippedDuplicates.length;
    if (result.insertedCount === 0) {
      toast.error('모두 중복이라 저장되지 않았습니다.');
      return false;
    }

    if (skipped > 0) {
      toast.success(`${result.insertedCount}개 저장, ${skipped}개는 다른 사용자가 방금 추가해 건너뛰었습니다.`);
    } else {
      toast.success(`${result.insertedCount}개 단어가 저장되었습니다.`);
    }
    router.push('/words');
    return true;
  };

  const handleSave = async () => {
    if (!user) return;
    const validWords = wordEntries.filter((w) => w.word.trim() && w.meaning.trim());
    if (!validateInputs(validWords)) return;

    setSaving(true);

    // 년도/학년의 '미지정' 은 DB 에 빈 문자열로 저장한다(external-category.ts 참조)
    const categoryId = await ensureCategoryId({
      level,
      year: toStoredValue(year),
      grade: toStoredValue(grade),
      publisher, semester, chapter, subChapter, schoolName,
    });
    if (!categoryId) {
      toast.error('카테고리 저장 중 오류가 발생했습니다.');
      setSaving(false);
      return;
    }

    const dupes = await findDuplicateWords(categoryId, validWords);
    if (!dupes) {
      toast.error('단어 중복 확인 중 오류가 발생했습니다.');
      setSaving(false);
      return;
    }

    if (dupes.inBatch.length > 0 || dupes.existing.length > 0) {
      setPendingCategoryId(categoryId);
      setPendingValidWords(validWords);
      setDuplicateCheck(dupes);
      setSaving(false);
      return;
    }

    await finalizeInsert(categoryId, validWords);
    setSaving(false);
  };

  const handleConfirmSkipDuplicates = async () => {
    if (!pendingCategoryId || !pendingValidWords || !duplicateCheck) return;

    const deduped = removeDuplicateWords(pendingValidWords, duplicateCheck.existing);
    setDuplicateCheck(null);

    if (deduped.length === 0) {
      toast.error('저장할 단어가 없습니다. 모두 중복입니다.');
      setPendingCategoryId(null);
      setPendingValidWords(null);
      return;
    }

    setSaving(true);
    await finalizeInsert(pendingCategoryId, deduped);
    setSaving(false);
    setPendingCategoryId(null);
    setPendingValidWords(null);
  };

  const handleCancelDuplicates = () => {
    setDuplicateCheck(null);
    setPendingCategoryId(null);
    setPendingValidWords(null);
  };

  const handleSaveDraft = () => {
    const draft = { level, year, grade, publisher, semester, chapter, subChapter, schoolName, wordEntries };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    toast.success('임시 저장되었습니다.');
  };

  const handleLoadDraft = () => {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!saved) {
      toast.error('저장된 임시 데이터가 없습니다.');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(saved);
    } catch {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      toast.error('임시 저장 데이터가 손상되어 삭제했습니다.');
      return;
    }

    if (!isDraftShape(parsed)) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      toast.error('임시 저장 데이터 형식이 올바르지 않아 삭제했습니다.');
      return;
    }

    setLevel(parsed.level);
    setYear(parsed.year ?? '');
    setGrade(parsed.grade ?? '');
    setPublisher(parsed.publisher ?? '');
    setSemester(parsed.semester ?? '');
    setChapter(parsed.chapter ?? '');
    setSubChapter(parsed.subChapter ?? '');
    setSchoolName(parsed.schoolName ?? '');
    setWordEntries(parsed.wordEntries.length > 0 ? parsed.wordEntries : [{ word: '', meaning: '' }]);
    toast.success('임시 저장 데이터를 불러왔습니다.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/words">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            돌아가기
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">✏️ 단어 입력</h1>
      </div>

      <CategoryForm
        level={level}
        year={year}
        grade={grade}
        publisher={publisher}
        semester={semester}
        chapter={chapter}
        subChapter={subChapter}
        schoolName={schoolName}
        onLevelChange={setLevel}
        onYearChange={setYear}
        onGradeChange={setGrade}
        onPublisherChange={setPublisher}
        onSemesterChange={setSemester}
        onChapterChange={setChapter}
        onSubChapterChange={setSubChapter}
        onSchoolNameChange={setSchoolName}
      />

      <WordEntryTable
        entries={wordEntries}
        saving={saving}
        onEntriesChange={setWordEntries}
        onSave={handleSave}
        onSaveDraft={handleSaveDraft}
        onLoadDraft={handleLoadDraft}
      />

      <DuplicateWordsDialog
        open={duplicateCheck !== null}
        onOpenChange={(v) => { if (!v) handleCancelDuplicates(); }}
        inBatchDuplicates={duplicateCheck?.inBatch ?? []}
        existingDuplicates={duplicateCheck?.existing ?? []}
        onConfirmSkipDuplicates={handleConfirmSkipDuplicates}
        onCancel={handleCancelDuplicates}
      />
    </div>
  );
}
