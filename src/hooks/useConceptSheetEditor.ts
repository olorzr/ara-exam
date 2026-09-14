'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Editor } from '@tiptap/react';
import type { BuilderCategory, MarkItem } from '@/components/exam-builder';
import { extractMarks } from '@/lib/concept-marks';
import { sanitizeConceptHTML } from '@/lib/sanitize-html';
import { fireConceptGradeSync } from '@/lib/concept-grade-sync';
import {
  DEFAULT_CONCEPT_CATEGORY,
  buildConceptSheetPayload,
  generateConceptTitle,
  isCategoryIncomplete,
} from '@/lib/concept-sheet-form';
import { useConceptMarkActions } from './useConceptMarkActions';
import { DEFAULT_PASS_PERCENTAGE } from '@/lib/constants';
import type { ConceptSheet } from '@/types';

export interface ConceptSheetEditorOptions {
  /** 편집할 개념지 id. 'new' 면 새로 만든다 */
  sheetId: string;
  /**
   * 목록 화면 경로. 뒤로 가기와 '찾을 수 없음' 이 여기로 돌아가고,
   * 새로 만든 뒤 주소도 `${listHref}/{id}` 가 된다.
   *
   * ⚠️ 그래서 **편집기의 부모 경로**여야 한다(개념지는 `/exam/builder`).
   *    'new' 로 들어오지 않는 화면(프린트 시험지)은 그 규칙과 무관하다.
   */
  listHref: string;
  /** 처음 보일 화면. 없으면 새 개념지는 편집기, 기존 개념지는 미리보기 */
  initialScreen?: 'editor' | 'preview';
}

/**
 * 개념지 에디터의 상태·로딩·저장을 캡슐화한 훅.
 * `sheetId` 가 'new' 이면 새 개념지, UUID 이면 기존 개념지를 불러와 편집한다.
 *
 * 화면을 두 곳에서 쓴다 — 개념지(`/exam/builder/[id]`)와 학교 프린트 시험지
 * (`/print-sheets/[bundleId]`). 그래서 경로를 훅 안에서 읽지 않고 **호출부가 넘긴다**.
 *
 * 마킹 조작은 `useConceptMarkActions`, 제목·검증·payload 조립은
 * `@/lib/concept-sheet-form` 이 담당한다.
 *
 * 보안: editor_html 은 저장 시에도 불러올 때도 `sanitizeConceptHTML` 로 정화한다
 * (Stored XSS 방어 — concept_sheets 는 authenticated 전원이 쓰는 공유 테이블이다).
 */
export function useConceptSheetEditor(opts: ConceptSheetEditorOptions) {
  const { sheetId, listHref } = opts;
  const router = useRouter();
  const { user } = useAuth();
  const isNew = sheetId === 'new';

  const [screen, setScreen] = useState<'editor' | 'preview'>(
    opts.initialScreen ?? (isNew ? 'editor' : 'preview'),
  );
  const [title, setTitle] = useState('');
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(!isNew);
  const [category, setCategory] = useState<BuilderCategory>(DEFAULT_CONCEPT_CATEGORY);
  const [editorHTML, setEditorHTML] = useState('');
  const [marks, setMarks] = useState<MarkItem[]>([]);
  // 합격 기준(%) — 단어 시험지와 같은 규약. 커트라인 미만이면 재시험이고,
  // 이 값이 학원 관리 시스템의 합격/불합격 판정 기준이 된다(sql/25).
  const [passPercentage, setPassPercentage] = useState(DEFAULT_PASS_PERCENTAGE);
  const [previewTab, setPreviewTab] = useState('concept');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [savedId, setSavedId] = useState<string | null>(isNew ? null : sheetId);
  const [initialHTML, setInitialHTML] = useState<string | null>(isNew ? '' : null);
  // 낙관적 동시성 제어용. 불러올 때의 updated_at 을 기억해 저장 시 버전 충돌을 감지한다.
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const markActions = useConceptMarkActions(editorRef, setEditorHTML);

  /** 카테고리 변경 시 자동 제목도 갱신한다 */
  const handleCategoryChange = useCallback((next: BuilderCategory) => {
    setCategory(next);
    if (!titleManuallyEdited) {
      setTitle(generateConceptTitle(next));
    }
  }, [titleManuallyEdited]);

  /** 제목 직접 입력 */
  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);
    setTitleManuallyEdited(true);
  }, []);

  /* ── 기존 개념지 불러오기 ── */
  useEffect(() => {
    (async () => {
      if (isNew || !user) {
        setLoading(false);
        return;
      }
      // 네트워크 예외(throw)가 나도 스피너가 멈추도록 finally 에서 loading 을 내린다.
      try {
        const { data, error } = await supabase
          .from('concept_sheets')
          .select('*')
          .eq('id', sheetId)
          .single();

        if (error || !data) {
          toast.error('개념지를 찾을 수 없습니다.');
          router.push(listHref);
          return;
        }

        const sheet = data as ConceptSheet;
        setTitle(sheet.title);
        setCategory({
          level: sheet.level,
          year: sheet.year ?? '',
          grade: sheet.grade,
          publisher: sheet.publisher,
          semester: sheet.semester,
          unit: sheet.unit,
          subunit: sheet.subunit,
          schoolName: sheet.school_name ?? '',
        });
        setLoadedUpdatedAt(sheet.updated_at);
        setPassPercentage(sheet.pass_percentage ?? DEFAULT_PASS_PERCENTAGE);
        // 저장 시 sanitize 했더라도 과거 오염 데이터나 직접 DB/RPC 쓰기가 남아 있을 수
        // 있다. 편집기 content 로 주입하기 전에 읽기 경로에서도 정화한다.
        const safeHTML = sanitizeConceptHTML(sheet.editor_html);
        setInitialHTML(safeHTML);
        setEditorHTML(safeHTML);
      } catch {
        toast.error('개념지를 불러오지 못했어요.');
        router.push(listHref);
      } finally {
        setLoading(false);
      }
    })();
  }, [isNew, sheetId, user, router, listHref]);

  /* ── 저장 (editor_html 은 sanitizeConceptHTML 로 정화) ── */
  const handleSave = useCallback(async () => {
    if (!user) return;

    if (isCategoryIncomplete(category)) {
      toast.error('카테고리를 먼저 설정해주세요.');
      return;
    }

    const editor = editorRef.current;
    const currentMarks = editor ? extractMarks(editor) : marks;
    const payload = buildConceptSheetPayload({
      title,
      category,
      html: sanitizeConceptHTML(editor ? editor.getHTML() : editorHTML),
      marks: currentMarks,
      passPercentage,
    });

    setSaving(true);

    // 저장 중 throw(네트워크 등)가 나도 스피너가 멈추도록 finally 에서 saving 을 내린다.
    try {
      if (savedId) {
        // 낙관적 동시성 제어: concept_sheets 는 공유 테이블이라 두 사람이 동시에
        // 편집하면 마지막 저장이 상대 변경을 통째로 덮어쓴다(last-write-wins).
        // 불러올 때의 updated_at 과 일치할 때만 갱신하고, 어긋나면(0행 갱신) 저장을
        // 거부해 사용자에게 새로고침을 안내한다. updated_at 은 트리거가 자동 갱신한다.
        let query = supabase
          .from('concept_sheets')
          .update(payload)
          .eq('id', savedId);
        if (loadedUpdatedAt) {
          query = query.eq('updated_at', loadedUpdatedAt);
        }
        const { data, error } = await query.select('updated_at').maybeSingle();

        if (error) {
          toast.error('저장에 실패했습니다.');
          return;
        }
        if (!data) {
          toast.error('다른 사용자가 이 개념지를 먼저 수정했어요. 새로고침 후 다시 저장해주세요.');
          return;
        }
        setLoadedUpdatedAt(data.updated_at);
        fireConceptGradeSync(savedId, currentMarks.length);
        toast.success('저장되었습니다.');
      } else {
        const { data, error } = await supabase
          .from('concept_sheets')
          .insert(payload)
          .select('id, updated_at')
          .single();

        if (error || !data) {
          toast.error('저장에 실패했습니다.');
          return;
        }
        setSavedId(data.id);
        setLoadedUpdatedAt(data.updated_at);
        fireConceptGradeSync(data.id, currentMarks.length);
        toast.success('저장되었습니다.');
        router.replace(`${listHref}/${data.id}`);
      }
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
    // ⚠️ passPercentage 를 deps 에 넣지 않으면 방금 바꾼 합격 기준이 아니라 마운트 시점 값으로
    //    저장된다(화면엔 70% 인데 저장은 80% 가 되는 조용한 어긋남).
  }, [user, title, category, editorHTML, marks, passPercentage, savedId, loadedUpdatedAt, router, listHref]);

  return {
    router,
    listHref,
    screen,
    setScreen,
    title,
    handleTitleChange,
    category,
    handleCategoryChange,
    editorHTML,
    setEditorHTML,
    marks,
    setMarks,
    passPercentage,
    setPassPercentage,
    previewTab,
    setPreviewTab,
    saving,
    loading,
    initialHTML,
    editorRef,
    handleSave,
    ...markActions,
  };
}

/** 편집기 훅이 돌려주는 것 전부 — 작업 화면 컴포넌트가 그대로 받는다 */
export type ConceptSheetEditorState = ReturnType<typeof useConceptSheetEditor>;
