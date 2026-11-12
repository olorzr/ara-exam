'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Masthead, SectionLabel, StatGrid } from '@/components/magazine';

/** 빠른 실행 — 잡지 지면의 번호 붙은 꼭지(#01 …)로 그린다 */
const QUICK_ACTIONS = [
  { href: '/exam/builder', label: '개념지', desc: '개념지를 만들고 관리해요' },
  { href: '/words/new', label: '단어 입력', desc: '새 단어를 추가해요' },
  { href: '/words', label: '단어 관리', desc: '저장된 단어를 관리해요' },
  { href: '/categories', label: '카테고리 관리', desc: '출판사·단원을 정리해요' },
  { href: '/exam/create', label: '단어 시험지 생성', desc: '시험지를 만들어요' },
  { href: '/exam/history', label: '단어 시험지', desc: '이전 시험지를 확인해요' },
  { href: '/problems/archive', label: '문제 아카이브', desc: '기출 문항을 찾아봐요' },
  { href: '/problems/sources', label: '올라간 기출', desc: '올라간 시험지를 한눈에 봐요' },
  { href: '/problems/papers/new', label: '문제지 조합', desc: '기출로 문제지를 만들어요' },
  { href: '/problems/quiz', label: 'O,X·단답형', desc: '지문으로 O,X·단답형을 만들어요' },
] as const;

/**
 * 대시보드 페이지 — 잡지 표지처럼 머리띠·숫자 격자·번호 붙은 빠른 실행(연한 민트 잡지 테마, 2026-11-12).
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ words: 0, categories: 0, exams: 0, problems: 0 });

  useEffect(() => {
    if (!user) return;

    async function loadStats() {
      // 통계 조회가 실패해도(네트워크 예외 등) 화면이 깨지지 않도록 0 으로 둔다.
      try {
        const [wordsRes, catsRes, examsRes, problemsRes] = await Promise.all([
          supabase.from('words').select('id', { count: 'exact', head: true }),
          supabase.from('categories').select('id', { count: 'exact', head: true }),
          supabase.from('exams').select('id', { count: 'exact', head: true }),
          supabase.from('problems').select('id', { count: 'exact', head: true }),
        ]);
        setStats({
          words: wordsRes.count ?? 0,
          categories: catsRes.count ?? 0,
          exams: examsRes.count ?? 0,
          problems: problemsRes.count ?? 0,
        });
      } catch {
        // 통계는 보조 정보이므로 초기값(0)을 유지한다.
      }
    }

    loadStats();
  }, [user]);

  return (
    <div className="mx-auto max-w-[1080px] space-y-10">
      <Masthead
        title="아라국어논술"
        subtitle="시험 관리 시스템"
        note="아라국어논술 시험 관리 시스템에 오신 것을 환영해요"
      />

      <section aria-labelledby="dashboard-numbers" className="space-y-3">
        <SectionLabel en="THE NUMBERS"><span id="dashboard-numbers">숫자로 보기</span></SectionLabel>
        <StatGrid
          items={[
            { en: 'WORDS', label: '총 단어 수', value: stats.words },
            { en: 'CATEGORIES', label: '카테고리', value: stats.categories },
            { en: 'TESTS', label: '단어 시험지', value: stats.exams },
            { en: 'PROBLEMS', label: '총 문제 수', value: stats.problems },
          ]}
        />
      </section>

      <section aria-labelledby="dashboard-quick" className="space-y-3.5">
        <SectionLabel en="QUICK START"><span id="dashboard-quick">빠른 실행</span></SectionLabel>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-6 sm:gap-y-7 lg:grid-cols-5">
          {QUICK_ACTIONS.map((action, index) => (
            <li key={action.href} className="flex">
              <Link
                href={action.href}
                className="group flex flex-1 flex-col border-y-2 border-ink pt-1.5 pb-3.5 text-ink"
              >
                <span aria-hidden="true" className="flex items-baseline justify-end gap-2">
                  <span className="font-label text-[10px] font-medium tracking-[0.18em]">( MENU )</span>
                  <b className="font-label text-xl font-extrabold tracking-[0.02em]">#{String(index + 1).padStart(2, '0')}</b>
                </span>
                <hr className="mt-2 mb-3 border-0 border-t-2 border-dotted border-ink" />
                <span className="font-display text-[17px] leading-snug font-bold group-hover:text-primary">{action.label}</span>
                <span className="mt-1.5 text-[13px] leading-normal text-gray-500">{action.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
