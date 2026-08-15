'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { ADMIN_EMAIL } from '@/lib/constants';

/**
 * 앱 상단 네비게이션 헤더. 데스크톱/모바일 반응형 메뉴를 제공한다.
 */
export default function Header() {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const navLinks = [
    { href: '/dashboard', label: '🏠 대시보드' },
    { href: '/exam/builder', label: '📝 개념 관리' },
    { href: '/words', label: '📚 단어 관리' },
    { href: '/categories', label: '📂 카테고리 관리' },
    { href: '/exam/create', label: '✏️ 시험지 생성' },
    { href: '/exam/history', label: '📋 시험 이력' },
    ...(isAdmin ? [{ href: '/admin/audit', label: '🔒 감사 로그' }] : []),
  ];

  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50" data-no-print>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <Image src="/logo.png" alt="아라국어논술" width={36} height={36} />
            <span
              className="hidden xl:inline text-lg font-bold text-gray-900 whitespace-nowrap"
              style={{ fontFamily: "'Gmarket Sans', sans-serif" }}
            >
              아라국어논술
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors whitespace-nowrap"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* 로그인 이메일은 데스크톱에서 표시하지 않는다 — 메뉴 7개 + 브랜드까지 한 줄에
              들어가야 해서 폭이 부족했고, 텍스트가 접혀 헤더가 2줄이 됐다(모바일 메뉴에는 유지). */}
          <div className="hidden lg:flex items-center shrink-0">
            <Button variant="outline" size="sm" onClick={signOut} className="whitespace-nowrap">
              <LogOut className="h-4 w-4 mr-1" />
              로그아웃
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="lg:hidden p-2"
            aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="lg:hidden pb-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-3 py-2 text-sm font-medium text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t">
              <span className="block px-3 py-1 text-sm text-gray-500">{user?.email}</span>
              <button
                type="button"
                onClick={signOut}
                className="block px-3 py-2 text-sm font-medium text-red-600"
              >
                로그아웃
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
