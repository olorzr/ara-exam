import type { Metadata, Viewport } from "next";
import { Gowun_Batang, Jost } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

/*
 * 화면 전용 글꼴(연한 민트 잡지 테마, 2026-11-12) — 빌드 때 받아 자기 주소에서 내준다(CSP 그대로).
 * 영문 작은 대문자 라벨·숫자는 Jost, 화면 제목은 고운바탕. CSS 변수로만 노출하고(`font-label`·`font-display`)
 * 기본 글꼴(--font-sans)과 인쇄 시트 글꼴은 그대로 둔다 — 시트 글꼴이 바뀌면 쪽 수가 바뀐다.
 * ⚠️ 테스트(vitest)에서는 next/font 가 돌지 않으므로 이 파일 밖에서 부르지 말 것.
 */
const label = Jost({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-jost",
  display: "swap",
});
// 한글 조각은 unicode-range 로 쓰는 글자만 받는다 — 미리 받기를 끈다
const display = Gowun_Batang({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-gowun",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "아라국어논술 - 시험 관리 시스템",
  description: "아라국어논술 시험 관리 시스템",
};

export const viewport: Viewport = {
  themeColor: "#e8f6f2",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${label.variable} ${display.variable}`}>
      <body
        className="antialiased"
      >
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
