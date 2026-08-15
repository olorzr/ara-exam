'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, FileText, PlusCircle, History, Upload, FolderOpen, FolderCog, Lightbulb } from 'lucide-react';

/**
 * 대시보드 페이지. 통계 요약과 빠른 실행 메뉴를 표시한다.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ words: 0, categories: 0, exams: 0, concepts: 0 });

  useEffect(() => {
    if (!user) return;

    async function loadStats() {
      // 통계 조회가 실패해도(네트워크 예외 등) 화면이 깨지지 않도록 0 으로 둔다.
      try {
        const [wordsRes, catsRes, examsRes, conceptsRes] = await Promise.all([
          supabase.from('words').select('id', { count: 'exact', head: true }),
          supabase.from('categories').select('id', { count: 'exact', head: true }),
          supabase.from('exams').select('id', { count: 'exact', head: true }),
          supabase.from('concept_sheets').select('id', { count: 'exact', head: true }),
        ]);
        setStats({
          words: wordsRes.count ?? 0,
          categories: catsRes.count ?? 0,
          exams: examsRes.count ?? 0,
          concepts: conceptsRes.count ?? 0,
        });
      } catch {
        // 통계는 보조 정보이므로 초기값(0)을 유지한다.
      }
    }

    loadStats();
  }, [user]);

  const quickActions = [
    { href: '/exam/builder', icon: Lightbulb, label: '개념 관리', desc: '개념지를 만들고 관리해요 💡' },
    { href: '/words/new', icon: PlusCircle, label: '단어 입력', desc: '새 단어를 추가해요 ✨' },
    { href: '/words', icon: FolderOpen, label: '단어 관리', desc: '저장된 단어를 관리해요 📖' },
    { href: '/categories', icon: FolderCog, label: '카테고리 관리', desc: '출판사·단원을 정리해요 📂' },
    { href: '/exam/create', icon: FileText, label: '시험지 생성', desc: '시험지를 만들어요 ✏️' },
    { href: '/exam/history', icon: History, label: '시험 이력', desc: '이전 시험지를 확인해요 🔍' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🏠 대시보드</h1>
        <p className="text-gray-500 mt-1"><span style={{ fontFamily: "'Gmarket Sans', sans-serif", fontWeight: 700 }}>아라국어논술 시험 관리 시스템</span>에 오신 것을 환영해요 🌷</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">📚 총 단어 수</CardTitle>
            <BookOpen className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.words}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">📂 카테고리</CardTitle>
            <Upload className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.categories}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">📝 시험지</CardTitle>
            <FileText className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.exams}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">💡 개념지</CardTitle>
            <Lightbulb className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.concepts}</p>
          </CardContent>
        </Card>
      </div>

      {/* 빠른 실행 */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">⚡ 빠른 실행</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="hover:border-primary/50 hover:shadow-md hover:shadow-primary/10 transition-all cursor-pointer h-full">
                <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
                  <action.icon className="h-10 w-10 text-primary" />
                  <div>
                    <p className="font-semibold text-gray-900">{action.label}</p>
                    <p className="text-sm text-gray-500">{action.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
