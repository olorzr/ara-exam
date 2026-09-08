'use client';

import { useState } from 'react';
import { Check, Image as ImageIcon, Trash2, Type } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProblemHtmlEditor from '@/components/problem-editor/ProblemHtmlEditor';
import AreaPathPicker from './AreaPathPicker';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';
import type { ProblemPatch } from '@/lib/problem-bank/mutations';
import type { Problem, QuestionType } from '@/types/problem-bank';

const QUESTION_TYPES: QuestionType[] = ['객관식', '주관식', '서술형'];

interface ProblemEditorCardProps {
  problem: Problem;
  areaTree: AreaTreeNode[];
  selected: boolean;
  onSelect: () => void;
  onSave: (patch: ProblemPatch) => Promise<boolean>;
  onToggleVerified: (verified: boolean) => void;
  onDelete: () => void;
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
  problem, areaTree, selected, onSelect, onSave, onToggleVerified, onDelete,
}: ProblemEditorCardProps) {
  const [stem, setStem] = useState(problem.stem_html);
  const [choices, setChoices] = useState<string[]>(problem.choices);
  const [answer, setAnswer] = useState(problem.answer);
  const [score, setScore] = useState(problem.score === null ? '' : String(problem.score));
  const [type, setType] = useState<QuestionType>(problem.question_type);
  const [area, setArea] = useState<string[]>(problem.area_path);
  const [workTitle, setWorkTitle] = useState(problem.work_title);
  const [saving, setSaving] = useState(false);

  const verified = problem.status === '검수완료';
  const missingAnswer = !answer.trim();

  const handleSave = async () => {
    setSaving(true);
    const parsedScore = score.trim() === '' ? null : Number(score);
    await onSave({
      stem_html: stem,
      choices: choices.filter((c) => c.trim().length > 0),
      answer: answer.trim(),
      // 배점을 못 읽었으면 null 로 둔다 — 0 으로 채우면 만점 계산이 조용히 틀어진다
      score: parsedScore !== null && Number.isFinite(parsedScore) ? parsedScore : null,
      question_type: type,
      area_path: area,
      work_title: workTitle,
    });
    setSaving(false);
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
            onClick={() => onToggleVerified(!verified)}
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
                  onChange={(e) => {
                    const next = [...choices];
                    next[i] = e.target.value;
                    setChoices(next);
                  }}
                  className="h-8 text-sm"
                  aria-label={`${i + 1}번 선지`}
                />
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            <Label className="text-xs text-gray-500">배점</Label>
            <Input
              value={score} onChange={(e) => setScore(e.target.value)}
              className="h-8 text-sm" inputMode="decimal" placeholder="비워도 됨"
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

        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}
