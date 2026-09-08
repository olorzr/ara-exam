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
│           ├── create/      # 단어 시험지 생성
│           ├── history/     # 시험 이력
│           └── view/        # 시험지/답안지/단어장 보기
├── components/
│   ├── layout/              # 앱 셸 (AppShell·Sidebar·nav-items — 좌측 사이드바 네비게이션)
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

### lib/category-master (카테고리 마스터 CRUD + 선택 가능 카테고리 집계)
- 역할: 출판사/대단원/소단원/학교/프린트 마스터의 CRUD 와, **앱에서 선택 가능한 모든 카테고리**의 단일 출처(`getAllSelectableCategories`) 제공
- 의존: `lib/supabase`, `lib/constants`, `types`
- 주요 파일: `src/lib/category-master/{publishers,major-chapters,sub-chapters,schools,school-materials,aggregate}.ts`
- `getAllSelectableCategories`: **마스터 중등/고등 전개 ∪ 마스터 외부지문 전개 ∪ `categories` 테이블** 을 자연키로 dedupe(중복 시 `categories` 행 우선 — 실제 UUID 를 가진 쪽). 단어 등록 여부와 무관하게 빈 카테고리도 포함하므로 개념지 편집기가 그대로 쓴다. 소단원이 있는 대단원도 `sub_chapter: ''` 단독 행을 함께 만들어 "대단원 전체"를 고를 수 있다
- rename 동기화: 마스터 이름 수정은 DB 트리거(`sync_*_name`)가 `categories` + `concept_sheets` 를 갱신하고, 각 CRUD 모듈이 앱 레벨에서도 **같은 두 테이블**을 갱신한다(트리거 누락 환경 안전장치). 한쪽만 고치면 단어지와 개념지 표기가 갈라진다

### lib/external-category (외부지문 년도·학년)
- 역할: 년도/학년 Select 옵션 생성과 `'미지정'` ↔ `''` 변환을 한 곳에 모은다
- 의존: `lib/constants`, `lib/kst-year`
- 주요 파일: `src/lib/external-category.ts`, `src/lib/kst-year.ts`

### print (A4 낱장 인쇄 엔진 — 시험지·답안지·단어장·개념지 공용)
- 역할: 인쇄 문서를 **고정 크기 A4 낱장 여러 장**으로 나눠 그린다. 블록 높이를 실측해 페이지·컬럼에 배정하므로 헤더/푸터가 매 페이지 제자리에 오고, 화면 미리보기와 인쇄물이 1:1로 일치한다
- 의존: 없음(순수 계산 + DOM 측정). 문서 컴포넌트들이 이 엔진을 소비한다
- 주요 파일:
  - `src/lib/print/constants.ts` — A4 96dpi px 상수(210mm=793.7px), 여백, 컬럼 폭. **크기의 단일 출처**
  - `src/lib/print/paginate.ts` — 순수 그리디 배치(블록 순서 보존, 좌→우 컬럼 채움) + 분할 요청(`splitRequests`)·축소 대상(`oversized`) 산출
  - `src/lib/print/split-html-blocks.ts` — 개념지 HTML → 블록 분해, 긴 표의 행 단위 재분할(rowspan 경계 인식 · 제목 행 반복 · 조각 열 폭 고정)
  - `src/lib/print/table-row-plan.ts` — 순수 계산: 절단 가능 행 판정(`legalCutFlags`) + 조각 범위 배정(`planRowChunks`)
  - `src/lib/print/table-measure.ts` — 측정 컨테이너의 표에서 행 높이·기준 열 폭·열별 max-content 폭 실측
  - `src/lib/print/table-col-fit.ts` — 열 폭 배분(짧은 열 보호 + 긴 열 비례, 하한은 칸 폭의 1/5·최대 96px) → 퍼센트 colgroup 주입
  - `src/lib/print/table-grid.ts` — 순수 계산: rowspan/colspan 격자 걷기(셀 → 열 인덱스)
  - `src/lib/print/table-dom.ts` — 표 HTML 공용 DOM 헬퍼(루트 표·셀·span 파싱)
  - `src/lib/print/sheet-columns.ts` — 개념지 단 수 결정(글자 수 300자 초과 → 2단). 루트 표 열 수는 보지 않고(열 폭 맞춤이 칸에 맞춘다), 래퍼 안의 넓은 표만 1단 폴백
  - `src/hooks/useA4Pagination.ts` — 숨김 컨테이너 실측 + 재측정(fonts.ready / ResizeObserver / img load / beforeprint)
  - `src/hooks/useConceptSheetBlocks.ts` — 개념지 블록 상태 + 표 열 폭 맞춤(배치 전) + 남은 자리를 채우는 표 재분할(패스당 표 하나, 최대 32)
  - `src/components/print/{A4Document,A4Sheet,CompactPageHeader}.tsx` — 측정 컨테이너 + 낱장 렌더
  - `src/styles/print-a4.css` — 낱장·푸터·페이지 브레이크 CSS (globals.css 에서 @import)
- 소비자: `components/exam/{ExamPaperView,MultipleChoiceView,MultipleChoiceAnswerView,WordBookView}.tsx`, `components/exam-builder/ExamSheetRenderer.tsx`
- 블록 단위: 시험지=문항 1개, 객관식 답안지=5문항 1줄, 단어장=단어 1줄, 개념지=본문 HTML 최상위 요소 1개
- 개념지 단 수: 본문 글자 수 300 초과면 2단이지만, **열 3개 이상인 표가 하나라도 있으면 1단**으로 되돌린다(2단 칸 ≈328px 에 넓은 표가 안 들어간다). 표 셀은 `overflow-wrap: anywhere` + 박스 묶음 줄바꿈 허용으로 칸을 넘지 않는다

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
5. 개념지 저장 → `api/sync-concept-to-grades` → ara-system 성적에 채점 회차 멱등 등록. 폴더 매핑은 **그룹 = 중등/고등이면 출판사 · 외부지문이면 학교명**, **시리즈 = 학년 + 학기**(외부지문은 학기가 없어 학년만), 회차명 = 단원(외부지문은 프린트/작품명). 년도는 시리즈에 넣지 않는다(회차 라벨이 연도별로 리셋됨)

## concept_sheets HTML 파이프라인
- 입력 (저장): TipTap `editor.getHTML()` → `sanitizeConceptHTML` → supabase insert/update (`src/hooks/useConceptSheetEditor.ts` 의 `handleSave`)
- 출력 (렌더): supabase select → `src/lib/exam-transform.ts` 의 `transformHTML` / `stripTrailingEmpty` / `extractMarkedWords` 각 함수 entry 에서 `sanitizeConceptHTML` 호출 → `ExamSheetRenderer` 의 `dangerouslySetInnerHTML`
- 화이트리스트 위치: `src/lib/sanitize-html.ts` (`ALLOWED_TAGS`, `ALLOWED_ATTR`). 새 TipTap 확장 추가 시 같이 갱신 필수
- 네트워크 계층 방어: `next.config.ts` 의 CSP — `object-src 'none'`, `frame-ancestors 'none'`, `connect-src` 화이트리스트(Supabase, NaverWorks)

---

## 기출 문제 은행 (2026-09)

학교 기출·모의고사·문제집 PDF 를 읽어 문항 단위로 쌓고, 골라서 새 문제지를 만든다.

### 데이터 흐름

```
[업로드]  PDF → pdf.js 렌더(scale 2) → 쪽 역할 지정(문제/정답표/제외)
          → Storage(exam-problem-bank) → problem_sources(추출중)
[OCR]     3쪽씩(겹침 1) 묶어 선생님 PC 의 코덱스 turn → parse → merge
          → passages/problems INSERT → bbox 로 영역 크롭 → 이미지 업로드
          → 정답표 쪽은 따로 읽어 번호로 붙임 → problem_sources(검수중)
[검수]    원본 페이지 이미지 + 영역 오버레이 ↔ TipTap 편집·정답·배점·영역
[아카이브] 필터(출처·학교·년도·학년·영역·검색) + 페이지네이션
[문제지]  드래그 조합 → RPC create_problem_paper(스냅샷) → A4 인쇄 3종
```

### 모듈

## lib/ai (+ lib/ai/codex)
- 역할: 선생님 PC 의 코덱스 브릿지와 통신. **서버는 AI 를 호출하지 않는다**
- 의존: 없음(순수 프로토콜) — 원본은 ara-system `app/lib/ai/`
- 주요 파일: codex/protocol.ts, codex/localClient.ts, codex/generateDraft.ts, errors.ts, flags.ts

## lib/pdf
- 역할: PDF → 캔버스 → JPEG data URL. 썸네일
- 의존: pdfjs-dist (⚠️ `wasmUrl: '/pdfjs-wasm/'` 필수 — 없으면 스캔본이 백지로 렌더된다)
- 주요 파일: pdfRenderer.ts, pdfPages.ts

## lib/problem-ocr
- 역할: 프롬프트 조립 → 구조화 출력 파싱 → 묶음 실행 → 병합 → 영역 크롭
- 의존: lib/ai, lib/pdf, lib/sanitize-problem
- 주요 파일: schema.ts, prompt.ts, parse.ts, batch-plan.ts, batch-run.ts, merge.ts, crop.ts, run.ts

## lib/problem-bank
- 역할: 아카이브 조회·쓰기, Storage 경로·서명, 영역 마스터 읽기, 필터
- 의존: lib/supabase, lib/supabase-public(읽기 전용)
- 주요 파일: queries.ts, mutations.ts, storage.ts, storage-paths.ts, area-tree.ts, filters.ts

## lib/problem-paper
- 역할: 문제지 조합 규칙(지문 묶음 연속성)과 인쇄 블록 조립
- 의존: lib/print(splitHtmlBlocks), lib/shuffle
- 주요 파일: compose.ts, dnd.ts, blocks.ts, settings.ts, shuffle-groups.ts

### 인쇄

기존 A4 엔진(`A4Document`)을 그대로 쓴다. 문서 종류를 늘리는 일은 **블록 배열을 만들어
넘기는 컴포넌트 하나**를 쓰는 것이 전부다. 타이포그래피 스코프는 `.pb-sheet`
(개념지의 `.eb-sheet-table` 과 같은 역할, `src/styles/problem-paper.css`).

⚠️ 지문은 **문단 단위 블록**으로 쪼갠다. 통째로 한 블록에 넣으면 한 쪽을 넘는 순간
`transform: scale()` 로 깨알같이 줄어든다. 문항은 하나가 한 블록이다(발문과 선지가 갈리면 못 읽는다).
