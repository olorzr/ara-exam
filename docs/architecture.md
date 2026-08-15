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
│       ├── categories/      # 카테고리 관리 (최상위 메뉴 — 출판사·대단원·소단원 마스터)
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

### print (A4 낱장 인쇄 엔진 — 시험지·답안지·단어장·개념지 공용)
- 역할: 인쇄 문서를 **고정 크기 A4 낱장 여러 장**으로 나눠 그린다. 블록 높이를 실측해 페이지·컬럼에 배정하므로 헤더/푸터가 매 페이지 제자리에 오고, 화면 미리보기와 인쇄물이 1:1로 일치한다
- 의존: 없음(순수 계산 + DOM 측정). 문서 컴포넌트들이 이 엔진을 소비한다
- 주요 파일:
  - `src/lib/print/constants.ts` — A4 96dpi px 상수(210mm=793.7px), 여백, 컬럼 폭. **크기의 단일 출처**
  - `src/lib/print/paginate.ts` — 순수 그리디 배치(블록 순서 보존, 좌→우 컬럼 채움)
  - `src/lib/print/split-html-blocks.ts` — 개념지 HTML → 블록 분해, 긴 표의 행 단위 재분할
  - `src/hooks/useA4Pagination.ts` — 숨김 컨테이너 실측 + 재측정(fonts.ready / ResizeObserver / img load / beforeprint)
  - `src/hooks/useConceptSheetBlocks.ts` — 개념지 블록 상태 + 초과 표 재분할(최대 2패스)
  - `src/components/print/{A4Document,A4Sheet,CompactPageHeader}.tsx` — 측정 컨테이너 + 낱장 렌더
  - `src/styles/print-a4.css` — 낱장·푸터·페이지 브레이크 CSS (globals.css 에서 @import)
- 소비자: `components/exam/{ExamPaperView,MultipleChoiceView,MultipleChoiceAnswerView,WordBookView}.tsx`, `components/exam-builder/ExamSheetRenderer.tsx`
- 블록 단위: 시험지=문항 1개, 객관식 답안지=5문항 1줄, 단어장=단어 1줄, 개념지=본문 HTML 최상위 요소 1개

### lib/naesin-scope (ara-system 내신 관리 연동, 읽기 전용)
- 역할: ara-system 수업 > 내신 관리가 저장한 내신 시험범위(`public.school_exam_scopes`)를 읽어, 시험지 생성 시 해당 범위의 단어 카테고리를 자동 선택
- 의존: `lib/supabase-public`(`publicDb()` — `supabase.schema('public')` 체이닝, **쓰기 금지**), `types`
- 주요 파일: `src/lib/naesin-scope/{types,fetch,match}.ts`, `src/lib/supabase-public.ts`, `src/components/exam/NaesinScopeLoader.tsx`
- 매칭 규칙: 단원 키("대단원" | "대단원 > 소단원") ↔ `exam.categories.chapter/sub_chapter` 텍스트 매칭(공백 정규화, 출판사는 공백 전제거 비교, 학기 필터). 미매칭 단원은 unmatchedUnits 로 반환해 UI 에 반드시 표면화
- `noExam`(ara-system `school_exam_scopes.no_exam`, mig379): 그 학교가 안 보는 시험. **true 여도 범위·교과서가 남아 있다**(ara-system 이 값 보존·잠금 방식) → 범위를 쓰기 전에 이 플래그를 먼저 판정하고 UI 는 안내만 표시
- `slotOptionsForGrade`: 중1 은 자유학기제라 1학기 시험 선택지를 뺀다. **ara-system `app/lib/examScope.ts` 의 `isSlotHiddenForGrade` 와 같은 규칙의 교차 저장소 복제** — 바꿀 땐 양쪽 함께(`src/lib/naesin-scope/types.test.ts` 가 규칙 고정)

## 데이터 흐름
1. 사용자 로그인 → Supabase Auth → AuthContext에 세션 저장
2. 단어 입력 → categories + words 테이블에 저장 (RLS로 사용자별 격리)
3. 시험지 생성 → 선택된 단어를 exam_words에 스냅샷 저장 → exams 테이블에 메타 저장
4. 시험지 보기 → exam_words에서 스냅샷 로드 → 문항 블록 실측 → A4 낱장 배치(`lib/print`) → 인쇄

## concept_sheets HTML 파이프라인
- 입력 (저장): TipTap `editor.getHTML()` → `sanitizeConceptHTML` → supabase insert/update (`src/app/(main)/exam/builder/[id]/page.tsx` handleSave)
- 출력 (렌더): supabase select → `src/lib/exam-transform.ts` 의 `transformHTML` / `stripTrailingEmpty` / `extractMarkedWords` 각 함수 entry 에서 `sanitizeConceptHTML` 호출 → `ExamSheetRenderer` 의 `dangerouslySetInnerHTML`
- 화이트리스트 위치: `src/lib/sanitize-html.ts` (`ALLOWED_TAGS`, `ALLOWED_ATTR`). 새 TipTap 확장 추가 시 같이 갱신 필수
- 네트워크 계층 방어: `next.config.ts` 의 CSP — `object-src 'none'`, `frame-ancestors 'none'`, `connect-src` 화이트리스트(Supabase, NaverWorks)
