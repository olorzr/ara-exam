'use client';

import { useEffect, useState } from 'react';
import { Check, Image as ImageIcon, Trash2, Type } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProblemHtmlEditor from '@/components/problem-editor/ProblemHtmlEditor';
import { blankChoicePositions, trimTrailingChoices } from '@/lib/problem-bank/choices';
import AreaPathPicker from './AreaPathPicker';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';
import { UNIT_DEPTH_LABELS } from '@/lib/problem-bank/unit-tree';
import type { ProblemPatch } from '@/lib/problem-bank/mutations';
import type { Problem, QuestionType } from '@/types/problem-bank';

const QUESTION_TYPES: QuestionType[] = ['객관식', '주관식', '서술형'];

/** 국어는 5지선다다 — 입력 칸은 늘 다섯 개 */
const CHOICE_SLOTS = 5;

/**
 * 선지 칸 하나를 고친 새 배열.
 *
 * ⚠️ `[...choices]` 에 뒤 자리를 바로 대입하면 **구멍이 뚫린 배열**이 된다.
 *    다음 타이핑에서 그 구멍이 `undefined` 로 펼쳐져 저장할 때 터진다
 *    (선지가 다섯 개보다 적거나 뒤 칸부터 채울 때 실제로 난다 — 코덱스 리뷰 5R).
 *    항상 다섯 칸을 빈 문자열로 채워 두고 고친다.
 */
function withChoiceAt(choices: readonly string[], index: number, value: string): string[] {
  const next = Array.from({ length: CHOICE_SLOTS }, (_, i) => choices[i] ?? '');
  next[index] = value;
  return next;
}

interface ProblemEditorCardProps {
  problem: Problem;
  areaTree: AreaTreeNode[];
  /** 교과서 단원 트리. 출처에 교과서가 없으면 빈 배열이라 칸이 안 뜬다 */
  unitTree: AreaTreeNode[];
  selected: boolean;
  onSelect: () => void;
  /** 저장 후 새 `updated_at` 을 돌려준다. 실패하면 null */
  onSave: (patch: ProblemPatch) => Promise<string | null>;
  /** `knownUpdatedAt` 은 방금 저장해 이미 아는 버전 — 화면 state 가 안 돌아도 맞는 값을 쓴다 */
  onToggleVerified: (verified: boolean, knownUpdatedAt?: string) => void;
  onDelete: () => void;
  /** 저장하지 않은 수정이 생기거나 사라질 때 알린다 — 화면이 '검수 마치기'를 막는 데 쓴다 */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * 문항 한 개의 검수 카드.
 *
 * 저장은 **누를 때만** 한다(자동 저장 없음) — 공유 표라 자동 저장이 겹치면
 * 남의 검수를 계속 밀어내게 된다.
 *
 * ⚠️ 호출부는 반드시 `key={problem.id}` 를 준다. 폼 값을 지역 state 로 들고 있으므로,
 *    key 없이 다른 문항을 같은 자리에 그리면 **앞 문항의 입력이 남는다**.
 *    효과로 되돌리는 대신 key 로 다시 마운트하는 것이 React 권장 방식이다.
 */
export default function ProblemEditorCard({
  problem, areaTree, unitTree, selected, onSelect, onSave, onToggleVerified, onDelete, onDirtyChange,
}: ProblemEditorCardProps) {
  const [stem, setStem] = useState(problem.stem_html);
  const [choices, setChoices] = useState<string[]>(problem.choices);
  const [answer, setAnswer] = useState(problem.answer);
  const [type, setType] = useState<QuestionType>(problem.question_type);
  const [area, setArea] = useState<string[]>(problem.area_path);
  const [unit, setUnit] = useState<string[]>(problem.unit_path);
  const [workTitle, setWorkTitle] = useState(problem.work_title);
  const [saving, setSaving] = useState(false);

  const verified = problem.status === '검수완료';
  const missingAnswer = !answer.trim();

  /**
   * 저장하지 않은 수정이 있는가.
   *
   * ⚠️ 이걸 안 보면 **고친 내용을 버린 채 옛 OCR 결과가 '검수완료'로 굳는다** —
   *    화면을 떠나면 지역 state 가 사라지는데 상태만 검수완료로 남아,
   *    검수한 자료인 줄 알고 그대로 인쇄하게 된다(코덱스 리뷰 8R).
   */
  const dirty = stem !== problem.stem_html
    || answer !== problem.answer
    || type !== problem.question_type
    || workTitle !== problem.work_title
    || area.join('>') !== problem.area_path.join('>')
    || unit.join('>') !== problem.unit_path.join('>')
    || trimTrailingChoices(choices).join('\u0000') !== problem.choices.join('\u0000');

  // 화면이 '검수 마치기' 를 막을 수 있게 알린다. 렌더 중 부모 state 를 건드리지 않도록
  // 값이 바뀔 때만 효과로 통지한다
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const handleSave = async (): Promise<string | null> => {
    // ⚠️ 빈 칸을 걸러내며 압축하면 안 된다 — 정답은 위치 번호라 뒤 선지가 당겨지면
    //    정답이 다른 선지를 가리키게 된다. 뒤쪽만 자르고 가운데는 자리를 지킨다
    const trimmed = trimTrailingChoices(choices);
    const blanks = blankChoicePositions(trimmed);
    if (blanks.length > 0) {
      const ok = window.confirm(
        `${blanks.join(', ')}번 선지가 비어 있어요.\n`
        + '정답 번호가 자리로 매겨지므로 빈 칸도 그대로 저장합니다. 계속할까요?',
      );
      if (!ok) return null;
    }

    setSaving(true);
    const updatedAt = await onSave({
      stem_html: stem,
      choices: trimmed,
      answer: answer.trim(),
      question_type: type,
      area_path: area,
      unit_path: unit,
      work_title: workTitle,
    });
    setSaving(false);
    return updatedAt;
  };

  /**
   * 검수 완료로 표시한다. 저장하지 않은 수정이 있으면 **먼저 저장하고**,
   * 저장이 실패하면 검수 표시도 하지 않는다 — 고친 내용을 버린 채 상태만 굳으면 안 된다.
   */
  const handleVerify = async (next: boolean) => {
    if (next && dirty) {
      const updatedAt = await handleSave();
      if (!updatedAt) return;
      // 방금 받은 버전을 그대로 넘긴다 — 화면 state 는 아직 안 돌았다
      onToggleVerified(next, updatedAt);
      return;
    }
    onToggleVerified(next);
  };

  const toggleRenderMode = () => {
    const next = problem.render_mode === 'image' ? 'text' : 'image';
    if (next === 'image' && !problem.image_path) return;
    onSave({ render_mode: next });
  };

  return (
    <div
      data-problem-id={problem.id}
      onFocusCapture={onSelect}
      className={`rounded-lg border p-4 transition ${
        selected ? 'border-primary shadow-sm' : 'border-gray-200'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onSelect} className="text-sm font-semibold text-gray-900">
          {problem.number !== null ? `${problem.number}번` : '번호 없음'}
        </button>
        <Badge variant="outline">{problem.page_no}쪽</Badge>
        {verified && <Badge className="bg-emerald-500 text-white">검수완료</Badge>}
        {missingAnswer && <Badge className="bg-amber-500 text-white">정답 미입력</Badge>}
        {dirty && <Badge className="bg-sky-500 text-white">저장 안 됨</Badge>}
        {problem.render_mode === 'image' && <Badge variant="outline">이미지 출제</Badge>}

        <div className="ml-auto flex items-center gap-1">
          {problem.image_path && (
            <Button type="button" variant="outline" size="sm" onClick={toggleRenderMode}>
              {problem.render_mode === 'image'
                ? <><Type className="h-3.5 w-3.5" /><span className="ml-1">글로 출제</span></>
                : <><ImageIcon className="h-3.5 w-3.5" /><span className="ml-1">이미지로 출제</span></>}
            </Button>
          )}
          <Button
            type="button" variant={verified ? 'outline' : 'default'} size="sm"
            onClick={() => handleVerify(!verified)}
            disabled={saving}
          >
            <Check className="h-3.5 w-3.5" />
            <span className="ml-1">{verified ? '검수 해제' : '검수 완료'}</span>
          </Button>
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => { if (window.confirm('이 문항을 지울까요?')) onDelete(); }}
            aria-label="문항 삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">발문</Label>
          <ProblemHtmlEditor value={stem} onChange={setStem} ariaLabel="발문" />
        </div>

        {type === '객관식' && (
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">선지</Label>
            {['①', '②', '③', '④', '⑤'].map((glyph, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 text-sm text-gray-500">{glyph}</span>
                <Input
                  value={choices[i] ?? ''}
                  onChange={(e) => setChoices(withChoiceAt(choices, i, e.target.value))}
                  className="h-8 text-sm"
                  aria-label={`${i + 1}번 선지`}
                />
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">유형</Label>
            <Select value={type} onValueChange={(v) => { if (v) setType(v as QuestionType); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">정답</Label>
            <Input
              value={answer} onChange={(e) => setAnswer(e.target.value)}
              className="h-8 text-sm" placeholder={type === '객관식' ? '1~5' : '답안'}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">작품명</Label>
            <Input
              value={workTitle} onChange={(e) => setWorkTitle(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <AreaPathPicker tree={areaTree} value={area} onChange={setArea} />
        <AreaPathPicker
          tree={unitTree} value={unit} labels={UNIT_DEPTH_LABELS} onChange={setUnit}
        />

        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}
