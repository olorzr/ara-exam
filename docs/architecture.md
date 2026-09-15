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
│       ├── categories/      # 카테고리 관리 (최상위 메뉴 — 중등/고등 출판사·대단원·소단원 마스터)
│       ├── words/           # 단어 관리
│       │   └── new/         # 단어 입력 (직접/CSV)
│       ├── exam/            # 시험 관련
│       │   ├── create/      # 단어 시험지 생성 (메뉴 없음 — 단어 시험지 화면의 버튼으로 들어간다)
│       │   ├── history/     # 단어 시험지 (목록 + 새 시험지 버튼)
│       │   ├── builder/     # 개념지 (목록 + [id] 편집기)
│       │   └── view/        # 시험지/답안지/단어장 보기
│       ├── print-sheets/    # 학교 프린트 시험지 (목록 · upload 스캔 올리기 · [bundleId] 편집)
│       ├── reference-texts/ # 작품 전문 (목록 · [id] 편집, 'new' 면 새로 올리기)
│       └── problems/         # 문제 은행 (archive 아카이브 · upload 기출 올리기 · sources 검수 ·
│                             #            papers 문제지 조합 · quiz O,X·단답형)
├── components/
│   ├── layout/              # 앱 셸 (AppShell·Sidebar·nav-items — 좌측 사이드바 네비게이션)
│   ├── print-scan/          # 학교 프린트 스캔 (스캔 정보 폼·쪽 묶기·묶음 폼·목록 줄·원본 쪽 패널·쪽 크게 보기)
│   ├── reference-texts/     # 작품 전문 (목록 줄·편집 폼·파일 가져오기)
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

### lib/category-master (카테고리 마스터 + 선택 가능 카테고리 집계)
- 역할: 출판사/대단원/소단원 마스터의 CRUD, 학교·프린트 마스터의 **조회(+프린트 생성)**, 그리고 **앱에서 선택 가능한 모든 카테고리**의 단일 출처(`getAllSelectableCategories`) 제공
- ⚠️ 전부가 CRUD 는 아니다(2026-09-14): **학교**는 관리자시스템 `public.schools` 가 원본이라 조회 + `ensureSchoolMirror` 뿐이고(sql/27), **프린트(`school_materials`)** 는 `학교 프린트 시험지` 업로드가 만든다(`ensureSchoolMaterial`) — 조회 + 생성뿐이고 앱에 수정·삭제 화면이 없다
- 의존: `lib/supabase`, `lib/constants`, `types`
- 주요 파일: `src/lib/category-master/{publishers,major-chapters,sub-chapters,schools,school-materials,aggregate}.ts`
- `getAllSelectableCategories`: **마스터 중등/고등 전개 ∪ 마스터 외부지문 전개 ∪ `categories` 테이블** 을 자연키로 dedupe(중복 시 `categories` 행 우선 — 실제 UUID 를 가진 쪽). 단어 등록 여부와 무관하게 빈 카테고리도 포함하므로 개념지 편집기가 그대로 쓴다. 소단원이 있는 대단원도 `sub_chapter: ''` 단독 행을 함께 만들어 "대단원 전체"를 고를 수 있다
- rename 동기화: 마스터 이름 수정은 DB 트리거(`sync_*_name`)가 `categories` + `concept_sheets` 를 갱신하고, 출판사·대단원·소단원 모듈은 앱 레벨에서도 **같은 두 테이블**을 갱신한다(트리거 누락 환경 안전장치). 한쪽만 고치면 단어지와 개념지 표기가 갈라진다. 학교·프린트는 앱에 rename 경로가 없어 트리거(`sync_school_name`/`sync_school_material_name`, sql/26)가 정본이다

### lib/print-words (학교 프린트 단어 등록)
- 역할: 읽어 둔 프린트 본문에서 **'단어 — 뜻' 으로 인쇄된 어휘**를 뽑아 그 프린트의 카테고리에 단어로 등록한다. 프린트 읽기와 **별개의 텍스트 한 턴**이다(목록의 '단어 등록' 버튼으로도 돌아야 하고, OCR 의 쪽 배치 병합을 건드리지 않는다)
- 의존: `lib/ai/codex`, `lib/concept-pick`(`htmlToPlainText`), `lib/words-save`(`ensureCategoryId`·`insertWordsToCategory`), `lib/problem-ocr/batch-run`(`FATAL_CODES`)
- ⚠️ **`lib/print-scan` 을 값으로 import 하지 않는다.** 카테고리와 영수증 저장 함수를 호출자가 주입한다 — 안 그러면 `print-scan/index → run → print-words → print-scan/save` 순환이 되고 `__checks/import-cycles.test.ts` 가 잡는다(2026-09-11 장애와 같은 모양)
- ⚠️ `registerBundleWords` 는 **절대 던지지 않는다.** 시험지는 이미 저장돼 있어, 던지면 `runBundle` 의 catch 가 멀쩡한 묶음을 '실패' 로 되돌린다. 무슨 일이 있었는지는 `words_meta` 영수증과 `onWarnings` 로만 말한다
- 주요 파일: `src/lib/print-words/{constants,schema,prompt,parse,run,register,summary}.ts`, `src/hooks/usePrintWordsRegister.ts`

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
5. 개념지 저장 → `api/sync-concept-to-grades` → ara-system 성적에 채점 회차 멱등 등록. 폴더 매핑은 **그룹 = 중등/고등이면 출판사 · 외부지문이면 학교명**, **시리즈 = 학년 + 학기**(외부지문은 학기가 없어 학년만), 회차명 = 단원(외부지문은 프린트/작품명). 년도는 시리즈에 넣지 않는다(회차 라벨이 연도별로 리셋됨). **합격 기준(`pass_percentage`, 기본 80)도 함께 보낸다** — 그쪽이 합격/불합격을 판정한다
6. 재시험 생성 → `create_exam_with_words`(부모 단어 재조립·서버 셔플) → `api/sync-to-grades` → ara-system 이 **원본 회차에 딸린 재시험지**로 붙인다(회차를 새로 만들지 않는다, 그쪽 mig477). 학생별 차수는 채점할 때 `exam_results.attempt_no` 가 오른다. 원본이 미등록이면 409 → 경고 토스트

## concept_sheets HTML 파이프라인
- 입력이 둘이다: ① 선생님이 편집기에서 직접 친 것, ② **학교 프린트 읽기**가 만든 것
  (`finalizePrintHtml` → `sanitizeConceptHTML` 을 거쳐 저장된다). 그 뒤 경로는 완전히 같다
- 입력 (저장): TipTap `editor.getHTML()` → `sanitizeConceptHTML` → supabase insert/update (`src/hooks/useConceptSheetEditor.ts` 의 `handleSave`)
- 출력 (렌더): supabase select → `src/lib/exam-transform.ts` 의 `transformHTML` / `stripTrailingEmpty` / `extractMarkedWords` 각 함수 entry 에서 `sanitizeConceptHTML` 호출 → `ExamSheetRenderer` 의 `dangerouslySetInnerHTML`
- 화이트리스트 위치: `src/lib/sanitize-html.ts` (`ALLOWED_TAGS`, `ALLOWED_ATTR`). 새 TipTap 확장 추가 시 같이 갱신 필수
- 네트워크 계층 방어: `next.config.ts` 의 CSP — `object-src 'none'`, `frame-ancestors 'none'`, `connect-src` 화이트리스트(Supabase, NaverWorks)

---

## 문제 은행 (2026-09)

학교 기출·모의고사·문제집 PDF 를 읽어 문항 단위로 쌓고, 골라서 새 문제지를 만든다.

### 데이터 흐름

```
[업로드]  출처 정보(학교급 → 학교 → 학년 → … → 교과서, 제목 자동)
          · **작품 칸**은 그 학교의 프린트 이름·기출 지문에서 자동으로 채운다(저장하지 않고
            프롬프트의 '작품후보' 로만 실린다 — work-candidates.ts)
          → PDF(+ 선택: 답지 PDF 하나 또는 사진 여러 장)
          → pdf.js 렌더(scale 2) → 쪽 역할 지정(문제/정답표/제외, '마지막 N쪽' 단축)
          → Storage(exam-problem-bank) → problem_sources(추출중)
[OCR]     3쪽씩(겹침 1) 묶어 선생님 PC 의 코덱스 turn → parse → merge
          · 2단 쪽은 **단별 이미지 두 장**(columnDetect) + PDF 글자 레이어가 있으면 함께
          · 실패한 묶음은 **쪽을 쪼개 한 번 더**
          → verify-structure / verify-text 로 확인거리 자동 표시
          → passages/problems INSERT → bbox 로 영역 크롭 + **그림만 따로 크롭**
          → 정답표는 따로 읽어 번호로 붙임(원본 안 쪽 + 별도 답지를 각각 5장 묶음)
          → problem_sources(검수중)
[검수]    원본 페이지 이미지 + 영역 오버레이 ↔ TipTap 편집·정답·영역·교과서 단원
          + 따로 올린 답지 보기 + 그림 추가(끌어 잡기)·빼기
          + 다음 쪽 이어 읽기 / 앞 지문에 붙이기
[아카이브] 왼쪽 패널 탭 4개(교과서·단원 | 학교 기출 | 작품 | 문법)
          카드 클릭 → 상세 창(지문+발문+선지+정답). 작품 조건이면 지문별로 묶어 표시
          + 필터(출처·학교·년도·학년·학기·시험·교과서·단원·영역·검색)
          + 페이지네이션 + 선택 삭제
[문제지]  드래그 조합 → RPC create_problem_paper(스냅샷) → A4 인쇄 3종
[O,X·단답형] 지문 붙여넣기(또는 아카이브 지문 불러오기) → 코덱스 turn 한 번
          → 근거·답을 지문과 대조해 거르기 → 화면에서 수정·삭제 → 문제지·정답표 인쇄
          · **저장하지 않는다**(DB 표 없음, 새로고침하면 사라진다)
```

### 모듈

## lib/ai (+ lib/ai/codex)
- 역할: 선생님 PC 의 코덱스 브릿지와 통신. **서버는 AI 를 호출하지 않는다**
- 의존: 없음(순수 프로토콜) — 원본은 ara-system `app/lib/ai/`
- 주요 파일: codex/protocol.ts, codex/localClient.ts, codex/generateDraft.ts, errors.ts, flags.ts,
  ocrPref.ts(읽기 턴의 모델·노력 고르기)
- **읽기 턴은 모델·노력을 명시한다**(`resolveOcrPref`). 아무것도 안 보내면 선생님 PC 의
  `config.toml` 기본값(대개 낮은 노력)으로 도는데, 시험지 전사는 한 글자만 틀려도 틀린 시험지다.
  ⚠️ **모델 id 를 노력과 함께** 보내야 한다 — `sanitizeOverride` 가 모델의 지원 목록으로
  노력을 검증하므로, 모델이 없으면 노력을 통째로 버린다. 선생님이 고른 값은 늘 이긴다
- 환경 판정: setupOs.ts(윈도우/맥 · Safari 여부), winInstaller.ts·macInstaller.ts(설치 주소·명령 조립).
  ⚠️ **Safari 는 https 문서에서 로컬 연결을 막아 쓸 수 없다** — 맥은 Chrome 필수
- 설치 안내: components/ai/AiSetupGuide(탭) → AiSetupSteps{Windows,Mac}. 설치 파일·스크립트는
  전부 ara-system 호스팅이고 이 앱은 링크·명령 문자열만 만든다
  (윈도우 `ara-ai.cmd` 하나 / 맥 `install-mac.sh` 한 줄. 윈도우는 켤 때마다 스스로 갱신된다)

## lib/pdf
- 역할: PDF → 캔버스 → JPEG data URL. 썸네일. 글자 레이어 읽기
- 의존: pdfjs-dist (⚠️ `wasmUrl: '/pdfjs-wasm/'` 필수 — 없으면 스캔본이 백지로 렌더된다)
- 주요 파일: pdfRenderer.ts, pdfPages.ts, pdfColumns.ts, columnDetect.ts, rowDetect.ts, pdfRows.ts,
  pdfText.ts, imageToJpeg.ts(사진 답지 → JPEG, EXIF 회전 반영)
- **2단 쪽은 단별로 갈라 보낸다**(`OCR_SPLIT_COLUMNS`). 읽는 순서가 하나뿐이 되고 글자가
  커진다. 홈을 못 찾으면 **가르지 않는다** — 1단을 반으로 자르면 모든 줄이 두 동강 난다.
  **가로만** 자르므로 모델이 주는 `top`·`bottom` 은 쪽 기준 그대로다
- **1단 쪽은 빈 줄에서 위·아래로 가른다**(`splitRows`, rowDetect.ts). 비전 모델은 받은 이미지를
  자기 상한에 맞춰 도로 줄이므로 `maxSide` 를 올려도 글자는 안 커진다 — **한 장에 담는 글의 양**을
  줄이는 것만이 효과가 있다(A4 1단 10pt 기준 13px → 18px). 빈 줄을 못 찾으면 가르지 않고,
  조각이 예산에 안 들어가면 **통째로 되돌린다**(조각 예산 = 쪽 예산 ÷ 조각 수, `pieceBudget`)
- ⚠️ **기출은 세로를 자르지 않는다** — 그림 크롭이 쪽 기준 `top`·`bottom` 에 달려 있다.
  위아래 가르기는 프린트 읽기 전용이다
- **화질을 낮춰 보낸 쪽을 남긴다**(`encodeWithinBudgetStep` → `RenderedPages.degraded`,
  `{page, step}`). 노이즈가 많아 압축이 안 되는 스캔이 사다리를 내려가는데, 그런 쪽이 가장
  안 읽힌다. ⚠️ **기록은 한 칸부터, 경고는 두 칸부터**다 — 한 칸까지 알리면 큰 스캔마다
  '확인 필요' 가 붙어 경고 전체를 안 믿게 된다
- `RenderedPages.rendered` 는 `{page, part}[]` 다(쪽 번호 배열이 아니다) — 한 쪽이 두 장 넘게
  되므로 "이미지 순서 = 이 쪽" 약속을 쪽 번호만으로는 지킬 수 없다
- 글자 레이어(`pdfText`)는 **있으면 보너스**다. 기출은 대부분 스캔본이라 보통 비어 있고,
  복합기 자동 OCR 레이어는 `hasUsableText` 가 걸러낸다(없느니만 못하다)
- **한양 PUA(U+E0BC–F8F7)는 깨진 글자가 아니다**(pdfText). 아래아한글이 옛한글을 거기 저장하므로
  깨진 글자로 세면 중세국어 쪽의 글자 레이어가 통째로 버려진다. 대신 `〔옛〕` 으로 바꿔 자리만 알린다

## lib/print-scan (학교 프린트 스캔 → 묶음 → 시험지)
- 역할: 스캔 PDF 를 프린트(묶음)별로 나눠 읽고 그 결과로 **개념지**를 만든다
- 의존: lib/problem-ocr(batch-plan·batch-run·describe-images·normalize-html), lib/pdf, lib/ai,
  lib/sanitize-html, lib/concept-sheet-form, lib/problem-bank/storage
- 주요 파일: scan-meta.ts(스캔 단위 학교·학년·시험 + 제목·프린트 이름 규칙),
  bundles.ts(초안·쪽 배정), bundle-plan.ts(검증·읽기 횟수·저장 모양),
  page-preview.ts(크게 보기 이동 규칙),
  prompt.ts, schema.ts, parse.ts, read-bundle.ts(묶음 읽기), run-env.ts(실행 환경 타입),
  quality.ts(화질 경고), run.ts(묶음 하나의 상태 전이), run-scan.ts(스캔 전체·다시 읽기),
  save.ts, queries.ts, page-images.ts, storage-paths.ts, scan-delete.ts
- **분류는 스캔마다 한 번 묻고 묶음마다 복사한다**(`scan-meta.ts` → `toBundleInsert`). DB 는
  묶음 단위 그대로다 — 카테고리 트리·rename 트리거·목록 줄이 전부 묶음 행을 본다
- 쪽 **크게 보기**는 화면마다 그림의 출처가 다르다: 업로드 화면은 PDF 를 1.5배로 다시 그리고
  (`pdfPagePreview` + `src/hooks/usePdfPagePreview.ts` — 문서를 한 번만 열고 들고 있는다),
  편집 화면은 이미 올려 둔 원본 이미지를 그대로 쓴다. 창(`PagePreviewDialog`)과 앞뒤 이동
  규칙(`page-preview.ts`)은 한 벌이다
- **시험지를 위한 표를 따로 만들지 않았다** — `concept_sheets` 에 `print_bundle_id` 만 더했다.
  편집기·빈칸 변환·인쇄·합격 기준·성적 연동이 전부 그대로 재사용된다
- 기출과 **다른 점**: 겹쳐 읽지 않는다(평문은 병합할 수 없다), 정답표·크롭이 없다,
  프롬프트가 `BODY_FORMAT_RULES` 를 쓰지 않는다(개념지 정화기가 figure·data-box 를 지운다),
  **1단 쪽을 위·아래로 가른다**(기출은 크롭 좌표 때문에 못 한다)
- **본문 읽기 턴만 꼼꼼한 모델·노력으로 부른다**(`ocrPref` → `read-bundle`). 쪽 방향 판정과
  단어 등록은 선생님 선택(`pref`) 그대로다 — 하나는 각도만 묻고 하나는 이미 읽은 글자만 다룬다
- **PDF 글자 레이어가 있으면 참고 텍스트로 함께 보낸다**(`ocr_meta.textSource`). 스캔본은
  'none' 이 정상이고, 아래아한글로 만든 프린트에서만 값이 붙는다. ⚠️ 규칙은 기출 것과 **따로**다 —
  프린트에는 "줄 나눔은 참고 텍스트를 믿지 않는다" 가 더 필요하다(산문 줄바꿈이 그대로 들어온다)

## lib/concept-pick (AI 추천 빈칸)
- 역할: 개념지 본문에서 빈칸으로 낼 용어를 골라 온다. 개념지·프린트 시험지 **양쪽**의 편집기에서 쓴다
- 의존: lib/ai(generateDraft)
- 주요 파일: plain-text.ts(HTML→평문 — 표·제목·목록의 구조를 기호로 남긴다),
  chunk.ts(평문을 묶음으로 — **줄 경계로만** 자른다), prompt.ts,
  schema.ts, parse.ts, run.ts, fold.ts(대조용 접기),
  notice.ts(하나도 못 붙였을 때의 안내 — AI 가 일부러 안 고른 것과 다 걸러진 것을 가른다)
- 마킹할 **자리**는 `lib/concept-mark-target.ts` 가 고른다: 자리 힌트 → 표 칸 → 첫 자리 순.
  "처음 나오는 곳" 으로 되돌리면 작품 원문에 빈칸이 뚫린다
- 추천은 **띄어쓰기 없는 한 어절**만 통과시킨다 — `extractMarks` 가 공백으로 쪼개 세기 때문이다
- **양은 선생님 손 마킹의 밀도**다 — prompt.ts 가 `CONCEPT_PICK_DENSITY_PER_100`(100자당 5개)만
  주고 개수는 본문 길이가 정한다. 근거는 `docs/concept-pick-criteria.md`
- **묶음마다 한 번씩 부르고 받는 즉시 마킹한다** — run.ts 가 `onChunk` 로 올리고 훅이 그 자리에서
  붙인다. 취소해도 거기까지는 남는다. `CONCEPT_PICK_MAX_COUNT` 는 **묶음 하나의 상한**이고,
  schema.ts 의 `maxItems` 와 parse.ts 의 자름과 프롬프트 문구가 그 값 **하나**를 본다
  (셋이 갈라지면 스키마 위반으로 출력이 통째 실패)

## lib/passage-quiz (O,X·단답형)
- 역할: 지문(문학·비문학)과 **참고자료**를 받아 O,X 문항과 단답형 문항을 만든다.
  만든 것은 **저장하지 않는다**
- 의존: lib/ai(generateDraft·wrapUntrustedData), lib/concept-pick/fold(대조용 접기)
  ⚠️ `@/lib/concept-pick` **배럴을 쓰지 않는다** — 그쪽이 run.ts 를 재수출해 순환이 생긴다. 파일 경로로 가져온다
- 주요 파일: constants.ts, schema.ts, prompt.ts, parse.ts(근거·답 대조), notice.ts,
  items.ts(화면용 목록·번호 매기기), draft.ts(입력값 검사), reference.ts(참고자료 자르기·이름 유일화),
  print-blocks.ts(지문 쪼개기), run.ts
- 근거 구절과 단답형 답이 지문 **또는 참고자료 하나**에 글자 그대로 있는지 **`foldStrict` 로 대조**한다.
  `foldLoose` 로 접으면 공백이 사라져 '아버지가 방에'와 '아버지 가방에'가 같아진다 —
  지어낸 문장이 그대로 통과한다
- ⚠️ **근거의 출처는 파서가 정한다**(스키마에 출처 필드가 없다 — 모델에게 물으면 그 말을 믿게 된다).
  지문을 먼저 보므로 양쪽에 있는 구절은 지문(`''`)이고, 두 자료에 걸친 근거는 버려진다
- ⚠️ 참고자료가 **없으면 프롬프트는 예전과 글자 하나까지 같다** — 규칙 블록도 데이터 키도 넣지 않는다
- **개수는 비우면 AI 가 정한다** — prompt.ts 가 눈대중·상한만 주고, schema.ts 의 `maxItems` 와 parse.ts 의
  자름이 `PASSAGE_QUIZ_MAX_PER_TYPE` **하나**를 본다(셋이 갈라지면 스키마 위반으로 출력이 통째 실패)
- 번호는 `numberQuizItems` 한 곳에서 매긴다 — 문제지와 정답표가 따로 세면 문항을 뺐을 때 어긋난다
- 인쇄는 입력칸이 아니라 **만들 때 굳힌 지문**(`usePassageQuiz` 의 `source`)을 싣는다
- 저장하지 않는 화면이라 떠나기 전에 묻는다: `hooks/useUnsavedGuard.ts` + `lib/nav-guard.ts`
  (`beforeunload` 는 메뉴 이동에서 발화하지 않아 링크 누름을 잡아채는 단계에서 한 번 더 본다)

## lib/quiz-references (참고자료 찾기·붙이기)
- 역할: 지문과 함께 읽을 자료(개념지·학교 프린트·기출 지문·작품 전문)를 **찾아 점수를 매기고**
  붙인 것의 본문을 읽는다. 글자를 다루는 일은 `lib/passage-quiz/reference.ts` 가 맡는다
- 의존: lib/supabase, lib/problem-bank(passage-search·queries.escapeIlike·detail-queries·work-title),
  lib/reference-texts/queries, lib/concept-pick/plain-text
  ⚠️ 배럴 셋을 **값으로 쓰지 않는다** — `@/lib/passage-quiz`·`@/lib/concept-pick` 은 순환이 되고
  `@/lib/reference-texts` 는 pdf.js 를 이 화면 번들로 끌어온다. 전부 파일 경로로 가져온다
- 주요 파일: types.ts, constants.ts, signals.ts(찾기 신호), labels.ts(이름·부제),
  match.ts(합치기·점수·까닭), candidates.ts(자동 찾기), search.ts(직접 고르기), bodies.ts(본문 읽기)
- ⚠️ `.or()` 를 쓰지 않는다 — 신호마다 쿼리를 하나씩 만들어 `allSettled` 로 돌리고 `key` 로 합친다.
  한 조회가 실패해도 본 기능을 막지 않는다(실패한 수만 알린다)
- ⚠️ 후보는 **본문을 읽지 않는다**(개념지 본문은 서버에서만 훑는다). 실제로 붙인 것만 `bodies.ts` 가 읽는다
- 점수: 신호 무게(`MATCH_WEIGHTS`) 합 + 종류 덤(`KIND_BONUS`), `MATCH_MIN_SCORE` 미만은 안 붙인다

## lib/reference-texts (작품 전문)
- 역할: 작품 원문 CRUD 와 파일 가져오기(`.txt`·PDF 글자 레이어)
- 의존: lib/supabase, lib/problem-bank/queries(escapeIlike), lib/pdf(openPdfSource·readPageText)
- 주요 파일: constants.ts, form.ts(입력값·검사·정규화), queries.ts, save.ts(낙관적 동시성),
  import-text.ts(순수: 잇기·판정), import.ts(브라우저: 파일 읽기)
- ⚠️ 본문은 **평문**이다 — 정화할 마크업이 없고 화면은 텍스트 노드로 그린다
- ⚠️ 배럴(`index.ts`)은 pdf.js 를 끌어온다. 조회만 필요한 쪽은 `./queries` 를 파일 경로로 가져갈 것

## lib/page-orientation (쪽 방향 판정)
- 역할: 스캔한 쪽이 뒤집혔는지 AI 에게 먼저 묻고, 바로 세울 각도를 돌려준다
- 의존: lib/ai(generateDraft), lib/pdf(renderPdfPage·encodeAt)
- 주요 파일: chunk.ts(8쪽씩 나누기), prompt.ts, schema.ts, parse.ts(fail-open), run.ts
- 쓰는 곳: lib/print-scan 뿐이다. 기출(problem-ocr)은 **아직 안 돌린다** — 모델이 준 좌표로
  그림·문항을 잘라내므로 이미지를 돌리면 크롭 좌표계까지 같이 돌려야 한다

## lib/yet-hangul (옛한글 — 감지 · 자모 조합 · 프롬프트 규칙)
- 역할: 옛한글(중세국어) 글자를 **알아보고**(글꼴 클래스), 대체 표기 `⟦ㅎㆍㄴ⟧` 를 **첫가끝 자모로
  합치고**, OCR 프롬프트에 실을 **규칙 문장과 경고 문구**를 한 곳에서 낸다
- 의존: **없다(잎 모듈)** — problem-ocr·print-scan·pdf 를 import 하지 않는다. 그쪽이 이쪽을 쓴다
- 주요 파일: detect.ts(`hasYetHangul`·`markHanyangPua`·`YET_HANGUL_UNICODE_RANGE`),
  jamo-tables.ts(호환 자모 → 첫가끝 표 셋), compose.ts(`composeSyllable`·`convertYetHangulNotation`),
  prompt-rules.ts(세 프롬프트가 공유), warn.ts(경고 문구), webfont.test.ts(글꼴 파일 고정)
- 쓰는 곳: 프롬프트 3(problem-ocr·print-scan·continue-passage) · 파서 2 · pdfText · verify-text ·
  렌더 6(지문·문항 뷰, 인쇄 블록·렌더, 개념지, 편집기) · 편집기 입력 창
- ⚠️ `YET_HANGUL_UNICODE_RANGE` 는 globals.css 의 `@font-face` 와 **글자 그대로** 같아야 한다
  (detect.test.ts 가 CSS 를 읽어 대조한다)

## lib/problem-ocr
- 역할: 프롬프트 조립 → 구조화 출력 파싱 → 묶음 실행 → 병합 → 영역 크롭
- 의존: lib/ai, lib/pdf, lib/sanitize-problem
- 주요 파일: schema.ts, prompt.ts, describe-images.ts(보낸 이미지 설명 — **lib/print-scan 과 공유**.
  기출 전용 문구는 호출자가 `splitRules` 로 넘긴다), prompt-answer-key.ts, parse.ts, parse-answer-key.ts,
  normalize-html.ts, batch-plan.ts, batch-attempt.ts, batch-run.ts,
  merge.ts, merge-keys.ts, merge-fill.ts, crop.ts, run.ts, run-images.ts,
  page-text.ts, verify-structure.ts, verify-text.ts, continue-passage.ts,
  answer-key.ts, answer-key-input.ts, answer-key-upload.ts, run-answer-key.ts,
  yet-hangul-pages.ts(옛한글이 든 쪽 모으기 — 경고를 쪽 단위로 내려는 값)
- **실패한 묶음은 쪽을 쪼개 한 번 더** 읽는다(batch-attempt/batch-run). 겹침이 1쪽뿐이라
  묶음 가운데 쪽은 그 묶음만 보는데, 죽으면 그 쪽이 통째로 사라졌다. 살려 낸 쪽은
  실패로 세지 않고 **끝내 못 읽은 쪽만** 경고에 싣는다
- **읽고 난 뒤 기계적으로 대조한다**(verify-structure: 빠진 번호·선지 수·머리글 범위,
  verify-text: PDF 글자와의 대조). **확실할 때만 말한다** — 번호가 겹치는 자료(문제집)는
  검사를 건너뛰고, **옛한글이 든 항목은 대조하지 않는다**(PDF 는 한양 PUA·모델은 첫가끝 자모라
  같은 글도 늘 '다르다' 가 된다)
  빠짐 검사를 아예 건너뛴다. 틀린 경고가 섞이면 경고 전체를 못 믿게 된다
- **그림은 부분만 잘라 본문 제자리에 끼운다.** `figures`(쪽 + 좌표)와 본문의
  `<figure data-figure="n">` 이 순번으로 짝이다. 조각을 이어 붙일 때 번호를 민다 —
  쪽 넘김 그림 지문이 이것으로 온전해졌다
- ⚠️ **짝이 어긋나면 1번 자리에 딴 그림이 그려진다.** 그래서 글을 갈아 끼울 때는 그림도
  함께 갈고(`replaceFragment`·`fillGaps`), 좌표를 버릴 때는 번호를 옮겨 붙인다
  (`remapFigurePlaceholders`). 그리기는 HTML 을 **자르지 않고** 그 자리의 태그만
  바꾼다(`figure-render.ts`) — 자르면 〈보기〉 상자가 먼저 닫혀 그림이 밖으로 나온다
- 정답표는 **두 곳**에서 온다: 원본 PDF 안의 '정답표' 쪽과 따로 올린 답지 파일.
  둘은 다른 문서라 묶음을 섞지 않는다(`run-answer-key.ts` 가 공급원 목록으로 다룬다)
- 서식 규약: 밑줄 `<u>`, 시행 줄바꿈 `<br>`, 원문의 빈 줄 `<p></p>`, 구분선 `<hr>`,
  구역 상자 `<blockquote data-box="…">`. **다듬기(normalize-html)가 정화보다 먼저** 돈다 —
  정화기는 허용 목록 밖 `data-box` 값을 되돌릴 수 없게 지운다
- 배점은 읽지 않는다(2026-09-08). 스키마·프롬프트·정답표 모두에서 뺐다
- 문법 분류는 모델에게 **마디 배열의 배열**(`[['단어','품사','명사']]`)로 받고 `parse.ts` 가
  저장 모양인 경로 문자열로 접는다 — `OcrItem.grammar_paths` 는 **접은 뒤**의 모양이라
  JSON 스키마와 타입이 다르다. 병합에서 이 축만 **합집합**이다(겹쳐 읽은 묶음이 각각 다른
  개념을 알아볼 수 있어 '빈 칸만 채운다' 규칙을 쓰면 나중 것이 버려진다)

## lib/problem-bank
- 역할: 아카이브 조회·쓰기, Storage 경로·서명, 영역·단원 마스터 읽기, 필터·패싯
- 의존: lib/supabase, lib/supabase-public(읽기 전용), lib/category-master(단원 마스터)
- 주요 파일: queries.ts, facets.ts, mutations.ts, mutations-source.ts, review-data.ts,
  storage.ts, storage-paths.ts, bbox.ts, figure-placeholders.ts, figure-capture.ts,
  area-tree.ts, area-master.ts, unit-tree.ts, unit-master.ts, grammar-tree.ts,
  scope-resolve.ts, scope-pick.ts, source-form.ts, filters.ts, selection.ts, school-exam-tree.ts,
  passage-search.ts(O,X·단답형에서 지문을 골라 오는 조회 — 목록에 html 을 싣지 않고 `.or()` 를 쓰지 않는다)
- 분류의 세 축: **영역**(ara-system 마스터, 최대 4단), **교과서 단원**(이 앱의 카테고리 관리,
  2단), **문법**(코드 상수 마스터, 최대 3단). 셋 다 노드 id 가 아니라 **이름 경로 스냅샷**이다
- 문법 축만 **문항에 여러 개** 붙는다(`grammar_paths`, 원소 하나가 경로 하나). 그래서 저장 모양과
  조회 연산자가 다르다 — 상위 검색은 `grammarPathsUnder` 로 잎을 펴서 `overlaps(&&)`,
  필터 선택지는 `expandGrammarAncestors` 로 패싯의 조상을 편다. 마스터가 상수라 트리를
  못 읽는 fail-soft 경로가 없는 유일한 축이다
- 훑는 축이 네 가지다: 교과서 단원 트리, **학교 기출 트리**(학교 › 학년도 › 학년 › 학기·시험),
  **작품 트리**(지은이 › 작품, `work-tree.ts`), **문법 트리**(대분류 › 중분류 › 개념,
  `grammar-browse-tree.ts`). 한 트리에서 고르면 **나머지 세 트리의 축은 비운다** —
  남기면 교집합이 조용히 0건이 되는데 화면에 이유가 없다
- ⚠️ **문법 트리만 패싯이 아니라 마스터로 만든다.** 나머지 셋은 '문항이 실제로 있는 값만'
  보여 주지만 문법은 `GRAMMAR_TREE` 전체를 그리고 개념마다 문항 수를 얹는다(0건은 흐리게).
  까닭은 ① 마스터가 닫혀 있고 고정이라 다 펼쳐도 개수가 안 튀고, ② 문법 태그는 업로드가
  아니라 **나중에 손으로** 붙는 것이라 패싯만 쓰면 '태그 0건 → 선택지 0건 → 붙일 길 없음'
  이라는 닭-달걀이 되며, ③ `(0)` 자체가 "아직 아무도 안 붙였다"는 정보이기 때문이다
- 문법 건수는 **전역값**이다(다른 조건을 반영하지 않는다). 조상 건수는 잎 건수의 합이 아니라
  **문항 단위로 중복을 없앤** 값이다(`grammar-counts.ts`) — 한 문항이 같은 조상 아래 태그를
  둘 달 수 있어 그냥 더하면 두 번 세어지고, 그러면 `(n)` 이 눌렀을 때의 목록 길이와 어긋난다
- 필터 줄의 칸 규칙('전체'·'미지정' 센티널, 조건이 걸린 칸을 남길지, 패싯에 없는 현재 값을
  끼워 넣을지)은 전부 `filter-axes.ts` 한 곳에 있다. 화면(`ProblemFilterBar`)은 그리기만 한다
- 작품 축의 값은 `problems.work_title` 이고 지문(`passages.title`)과의 동기화는 **DB 트리거**가 한다
  (sql/20). 표기 정규화는 `work-title.ts` ↔ `exam.normalize_work_title` 1:1
- 학교는 관리자시스템 `public.schools` 가 원본이다(`school_id` + 이름 스냅샷). 교과서는
  내신 관리에 등록된 시험범위에서 자동으로 찾아 준다 — **학교만 고르면** 그 학교의 슬롯을
  전부 읽어(`fetchSchoolScopeRows`) 폼 조건에 **가장 가까운** 슬롯의 교과서를 쓴다
  (줄 세우기 `scope-pick.ts`, 조립 `scope-resolve.ts`, 조회 훅 `src/hooks/useScopeHint.ts`).
  학년 → 학년도 거리 → 학기 → 시험 → 최근 해 → 중간 우선이고, **다른 학년에서 빌리는 것은
  중등만**(고등은 학년마다 책이 다르다). **범위(단원)는 정확한 슬롯의 것만** 쓴다 —
  다른 해의 단원을 이번 시험 범위라고 보여 주면 거짓말이 된다

## components/ui
- 역할: 화면 조각(shadcn/base-ui 래퍼)
- ⚠️ **선택 칸은 `OptionSelect`(`option-select.tsx`) 를 쓴다.** base-ui 의 `Select.Value` 는
  `Select.Root` 에 `items`(값→이름 지도)가 없으면 고른 **값을 그대로** 그린다 —
  `SelectItem` 의 children 은 팝업 안에서만 쓰이기 때문이다. `OptionSelect` 는 `items` 와
  `SelectItem` 을 **같은 배열**에서 만들어 둘이 어긋날 수 없게 한다
- 원시 래퍼 `Select`(`select.tsx`)는 `items` 를 **타입으로 강제**한다. 빠뜨리면 화면에서만
  드러나고 타입은 멀쩡했던 버그라, 컴파일에서 잡히게 해 두었다
- 주요 파일: `option-select.tsx`(+ 회귀 테스트), `select.tsx`

## lib/problem-paper
- 역할: 문제지 조합 규칙(지문 묶음 연속성)과 인쇄 블록 조립
- 의존: lib/print(splitHtmlBlocks), lib/shuffle
- 주요 파일: compose.ts, dnd.ts, blocks.ts, html-trim.ts, settings.ts, shuffle-groups.ts
- 배점은 인쇄하지 않는다(2026-09-08). `PaperSettings.showScore` 키는 RPC 화이트리스트
  호환용으로만 남아 있고 렌더러는 보지 않는다

### 인쇄

기존 A4 엔진(`A4Document`)을 그대로 쓴다. 문서 종류를 늘리는 일은 **블록 배열을 만들어
넘기는 컴포넌트 하나**를 쓰는 것이 전부다. 타이포그래피 스코프는 `.pb-sheet`
(개념지의 `.eb-sheet-table` 과 같은 역할, `src/styles/problem-paper.css`).

⚠️ 지문은 **문단 단위 블록**으로 쪼갠다. 통째로 한 블록에 넣으면 한 쪽을 넘는 순간
`transform: scale()` 로 깨알같이 줄어든다. 문항은 하나가 한 블록이다(발문과 선지가 갈리면 못 읽는다).
