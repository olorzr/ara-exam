'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Category } from '@/types';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { School } from 'lucide-react';
import { toast } from 'sonner';
import { MIDDLE_SCHOOL_GRADES, HIGH_SCHOOL_GRADES } from '@/lib/constants';
import { fetchNaesinSchools, fetchPublicTextbook, fetchScopeSlot } from '@/lib/naesin-scope/fetch';
import { matchScopeToCategories } from '@/lib/naesin-scope/match';
import { EXAM_SLOT_OPTIONS, slotOptionsForGrade, type NaesinSchool, type PublicTextbook, type ScopeSlotRow } from '@/lib/naesin-scope/types';

/** KST 기준 올해 학년도 */
const kstYear = (): number =>
  Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date()));

interface NaesinScopeLoaderProps {
  /** exam/create 페이지가 이미 로드한 전체 카테고리 */
  categories: Category[];
  /** 매칭된 카테고리 id 를 선택 목록에 반영 (합집합은 호출처 책임) */
  onApply: (ids: string[]) => void;
}

/**
 * 내신 시험범위 불러오기 카드 — ara-system 수업 > 내신 관리에 저장된 시험범위를 읽어
 * 학교/학년/학년도/시험만 고르면 해당 범위의 단어 카테고리를 자동 선택한다.
 */
export default function NaesinScopeLoader({ categories, onApply }: NaesinScopeLoaderProps) {
  const baseYear = useMemo(kstYear, []);
  const [level, setLevel] = useState<'중등' | '고등'>('중등');
  const [schools, setSchools] = useState<NaesinSchool[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [grade, setGrade] = useState('');
  const [year, setYear] = useState(baseYear);
  const [slotKey, setSlotKey] = useState('');
  const [slot, setSlot] = useState<ScopeSlotRow | null>(null);
  const [textbook, setTextbook] = useState<PublicTextbook | null>(null);
  const [loading, setLoading] = useState(false);
  const [unmatched, setUnmatched] = useState<string[]>([]);

  useEffect(() => {
    // 구분을 빠르게 오가면 먼저 보낸 요청이 늦게 도착해 현재 구분 목록을 덮을 수 있어 취소 가드.
    // 이전 구분의 학교가 새 구분 아래 남아 선택되는 일이 없게 목록도 즉시 비운다.
    let cancelled = false;
    setSchools([]);
    fetchNaesinSchools(level)
      .then((list) => { if (!cancelled) setSchools(list); })
      .catch(() => { if (!cancelled) toast.error('학교 목록을 불러오지 못했습니다.'); });
    setSchoolId('');
    setGrade('');
    return () => { cancelled = true; };
  }, [level]);

  // 중1 은 자유학기제라 1학기 시험이 없다 — 고를 수 있는 시험은 학년에 따라 달라진다
  const slotOptions = slotOptionsForGrade(grade);
  const slotOption = EXAM_SLOT_OPTIONS.find((o) => o.key === slotKey) ?? null;

  // 학년을 바꿔 지금 선택이 무효가 되면(중1 로 바꿨는데 1학기가 선택돼 있음) 선택을 비운다.
  useEffect(() => {
    if (slotKey && !slotOptions.some((o) => o.key === slotKey)) setSlotKey('');
  }, [slotKey, slotOptions]);

  // 학교·학년·학년도·시험이 모두 정해지면 저장된 시험범위 슬롯을 조회한다
  useEffect(() => {
    setSlot(null);
    setTextbook(null);
    setUnmatched([]);
    if (!schoolId || !grade || !slotOption) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const row = await fetchScopeSlot(schoolId, grade, year, slotOption.semester, slotOption.examType);
        if (cancelled) return;
        setSlot(row);
        if (row?.textbook_id) {
          const tb = await fetchPublicTextbook(row.textbook_id);
          if (!cancelled) setTextbook(tb);
        }
      } catch {
        if (!cancelled) toast.error('시험범위를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [schoolId, grade, year, slotKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApply = () => {
    if (!slot || !slotOption) return;
    // 안 보는 시험엔 잠긴 옛 범위가 남아 있을 수 있다 — 버튼은 안 그려지지만 안전망으로 막는다
    if (slot.noExam) return;
    if (slot.units.length === 0) {
      toast.info('저장된 단원 체크가 없어 자동 선택할 수 없어요. 아래 범위 텍스트를 참고해 직접 선택해주세요.');
      return;
    }
    if (!textbook) {
      toast.info('저장된 교과서가 없어 자동 선택할 수 없어요. 범위 텍스트를 참고해 직접 선택해주세요.');
      return;
    }
    const { matchedIds, unmatchedUnits } = matchScopeToCategories(slot.units, textbook, slotOption.semester, categories);
    setUnmatched(unmatchedUnits);
    if (matchedIds.length === 0) {
      toast.error('시험범위와 일치하는 단어 카테고리를 찾지 못했어요. 단원 이름이 서로 다르게 등록됐는지 확인해주세요.');
      return;
    }
    onApply(matchedIds);
    toast.success(`카테고리 ${matchedIds.length}개를 자동 선택했어요.`);
    if (unmatchedUnits.length > 0) {
      toast.warning(`단원 ${unmatchedUnits.length}개는 단어 카테고리에 없어 선택되지 않았어요.`);
    }
  };

  const yearOptions = [baseYear + 1, baseYear, baseYear - 1];
  const grades = level === '중등' ? MIDDLE_SCHOOL_GRADES : HIGH_SCHOOL_GRADES;
  const ready = schoolId && grade && slotOption;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <School className="h-5 w-5 text-primary" />
          내신 시험범위 불러오기
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="space-y-2">
            <Label>구분</Label>
            <Select value={level} onValueChange={(v) => { if (v) setLevel(v as '중등' | '고등'); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="중등">중등</SelectItem>
                <SelectItem value="고등">고등</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>학교</Label>
            <Select
              value={schoolId}
              items={schools.map((s) => ({ value: s.id, label: s.name }))}
              onValueChange={(v) => { if (v) setSchoolId(v); }}
            >
              <SelectTrigger><SelectValue placeholder="학교 선택" /></SelectTrigger>
              <SelectContent>
                {schools.map((s) => (
                  <SelectItem key={s.id} value={s.id} label={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>학년</Label>
            <Select value={grade} onValueChange={(v) => { if (v) setGrade(v); }}>
              <SelectTrigger><SelectValue placeholder="학년" /></SelectTrigger>
              <SelectContent>
                {grades.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>학년도</Label>
            <Select value={String(year)} onValueChange={(v) => { if (v) setYear(Number(v)); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}학년도</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>시험</Label>
            <Select value={slotKey} onValueChange={(v) => { if (v) setSlotKey(v); }}>
              <SelectTrigger><SelectValue placeholder="시험 선택" /></SelectTrigger>
              <SelectContent>
                {slotOptions.map((o) => (
                  <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {ready && (loading ? (
          <p className="text-sm text-gray-500">시험범위를 불러오는 중...</p>
        ) : !slot ? (
          <p className="text-sm text-gray-500">
            저장된 시험범위가 없어요. 아라시스템 <span className="font-medium">수업 &gt; 내신 관리</span>에서 먼저 등록해주세요.
          </p>
        ) : slot.noExam ? (
          /* ara-system 은 '시험 안 봄'이어도 값을 지우지 않고 잠그기만 한다 —
             남아 있는 범위·교과서를 쓰면 안 되므로 여기서 갈라 안내만 한다. */
          <p className="text-sm text-gray-500">
            🚫 이 학교는 이 시험을 보지 않아요. (아라시스템 <span className="font-medium">내신 관리</span>에 &lsquo;시험 안 봄&rsquo;으로 표시)
          </p>
        ) : (
          <div className="rounded-md border bg-gray-50 p-3 text-sm space-y-1">
            {slot.scope && <p><span className="text-gray-500">범위</span> {slot.scope}</p>}
            {textbook && (
              <p><span className="text-gray-500">교과서</span> {textbook.publisher} {textbook.book_title}</p>
            )}
            {slot.teacher_name && <p><span className="text-gray-500">국어쌤</span> {slot.teacher_name}</p>}
            {(slot.exam_start_date || slot.korean_exam_date) && (
              /* 국어 시험일만 먼저 공지되는 경우도 흔해서 기간 없이도 표시한다 */
              <p>
                <span className="text-gray-500">일정</span>{' '}
                {[
                  slot.exam_start_date ? `${slot.exam_start_date}${slot.exam_end_date ? ` ~ ${slot.exam_end_date}` : ''}` : '',
                  slot.korean_exam_date ? `국어: ${slot.korean_exam_date}` : '',
                ].filter(Boolean).join(' · ')}
              </p>
            )}
            <Button size="sm" className="mt-2 bg-primary hover:bg-primary-hover text-white" onClick={handleApply}>
              이 범위로 카테고리 자동 선택
            </Button>
            {unmatched.length > 0 && (
              <div className="mt-2 text-xs text-red-500">
                <p>단어 카테고리에서 못 찾은 단원:</p>
                <ul className="list-disc pl-4">
                  {unmatched.map((u) => (<li key={u}>{u}</li>))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
