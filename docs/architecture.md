# 프로젝트 아키텍처

## 기술 스택
- **Frontend**: Next.js 16 (App Router), Tailwind CSS v4, Shadcn UI
- **Backend/DB**: Supabase (Auth, Database, RLS)
- **아이콘**: Lucide React
- **배포**: Vercel

## 디렉토리 구조

```
src/
├── app/                     # Next.js App Router 페이지
│   ├── (auth)/login/        # 인증 관련 페이지
│   └── (main)/              # 인증 필요 페이지 (레이아웃에서 가드)
│       ├── dashboard/       # 대시보드
│       ├── words/           # 단어 관리
│       │   └── new/         # 단어 입력 (직접/CSV)
│       └── exam/            # 시험 관련
│           ├── create/      # 시험지 생성
│           ├── history/     # 시험 이력
│           └── view/        # 시험지/답안지/단어장 보기
├── components/
│   ├── layout/              # 레이아웃 컴포넌트 (Header 등)
│   ├── words/               # 단어 입력 관련 분리 컴포넌트
│   └── ui/                  # Shadcn UI 컴포넌트
├── lib/                     # 유틸리티, 설정
│   ├── constants.ts         # 매직 넘버 상수화
│   ├── format.ts            # 포맷팅 유틸리티 함수
│   ├── supabase.ts          # Supabase 클라이언트
│   ├── auth-context.tsx     # 인증 Context Provider
│   └── utils.ts             # Tailwind 병합 유틸
└── types/                   # TypeScript 타입 정의
    └── index.ts
```

## 모듈 간 의존관계

### lib/supabase
- 역할: Supabase 클라이언트 인스턴스 생성
- 의존: 환경변수 (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
- 주요 파일: `src/lib/supabase.ts`

### lib/auth-context
- 역할: 인증 상태 관리 및 로그인/로그아웃 기능 제공
- 의존: `lib/supabase`
- 주요 파일: `src/lib/auth-context.tsx`

### lib/constants
- 역할: 앱 전체에서 사용하는 상수 (색상, 기본값 등) 중앙 관리
- 의존: 없음
- 주요 파일: `src/lib/constants.ts`

### lib/format
- 역할: 카테고리 라벨, 날짜 등 포맷팅 유틸리티
- 의존: `types`, `lib/constants`
- 주요 파일: `src/lib/format.ts`

### types
- 역할: 프로젝트 전체 TypeScript 타입 정의
- 의존: 없음
- 주요 파일: `src/types/index.ts`

### lib/naesin-scope (ara-system 내신 관리 연동, 읽기 전용)
- 역할: ara-system 수업 > 내신 관리가 저장한 내신 시험범위(`public.school_exam_scopes`)를 읽어, 시험지 생성 시 해당 범위의 단어 카테고리를 자동 선택
- 의존: `lib/supabase-public`(`publicDb()` — `supabase.schema('public')` 체이닝, **쓰기 금지**), `types`
- 주요 파일: `src/lib/naesin-scope/{types,fetch,match}.ts`, `src/lib/supabase-public.ts`, `src/components/exam/NaesinScopeLoader.tsx`
- 매칭 규칙: 단원 키("대단원" | "대단원 > 소단원") ↔ `exam.categories.chapter/sub_chapter` 텍스트 매칭(공백 정규화, 출판사는 공백 전제거 비교, 학기 필터). 미매칭 단원은 unmatchedUnits 로 반환해 UI 에 반드시 표면화

## 데이터 흐름
1. 사용자 로그인 → Supabase Auth → AuthContext에 세션 저장
2. 단어 입력 → categories + words 테이블에 저장 (RLS로 사용자별 격리)
3. 시험지 생성 → 선택된 단어를 exam_words에 스냅샷 저장 → exams 테이블에 메타 저장
4. 시험지 보기 → exam_words에서 스냅샷 로드 → A4 레이아웃 렌더링 → 인쇄

## concept_sheets HTML 파이프라인
- 입력 (저장): TipTap `editor.getHTML()` → `sanitizeConceptHTML` → supabase insert/update (`src/app/(main)/exam/builder/[id]/page.tsx` handleSave)
- 출력 (렌더): supabase select → `src/lib/exam-transform.ts` 의 `transformHTML` / `stripTrailingEmpty` / `extractMarkedWords` 각 함수 entry 에서 `sanitizeConceptHTML` 호출 → `ExamSheetRenderer` 의 `dangerouslySetInnerHTML`
- 화이트리스트 위치: `src/lib/sanitize-html.ts` (`ALLOWED_TAGS`, `ALLOWED_ATTR`). 새 TipTap 확장 추가 시 같이 갱신 필수
- 네트워크 계층 방어: `next.config.ts` 의 CSP — `object-src 'none'`, `frame-ancestors 'none'`, `connect-src` 화이트리스트(Supabase, NaverWorks)
