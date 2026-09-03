# Project Rules

## File Structure
- 파일당 300줄 이하 유지. 초과 시 반드시 분리
- 하나의 파일은 하나의 역할만 담당 (Single Responsibility)
- 폴더 구조: feature 기반 (예: /features/auth/, /features/dashboard/)

## Naming
- 컴포넌트: PascalCase (UserCard.tsx)
- 유틸/훅: camelCase (useAuth.ts, formatDate.ts)
- 상수: UPPER_SNAKE_CASE
- 타입/인터페이스: PascalCase + 접미사 (UserProps, ApiResponse)

## Code Quality
- 함수는 한 가지 일만 수행
- 매직 넘버 금지 → 상수로 추출
- 중복 코드 발견 시 즉시 추출
- early return 패턴 사용 (중첩 if 금지)
- 모든 export 함수에 JSDoc 주석

## When Editing
- 수정 전 관련 파일을 먼저 읽고 구조 파악
- 300줄 초과하면 리팩터링 먼저 제안
- 새 파일 생성 시 index.ts에서 re-export

## Error Handling
- try-catch는 최상위에서만
- 에러 메시지는 사용자 친화적으로
- 콘솔 로그 대신 전용 logger 사용

## Testing
- 새 함수 작성 시 테스트 파일도 함께 생성
- 테스트 파일명: *.test.ts

## Dependencies
- 새 패키지 설치 전 반드시 사용자에게 확인
- 기존 라이브러리로 해결 가능한지 먼저 검토
- package.json에 없는 패키지를 임의로 추가하지 말 것

## Git & Commits
- Conventional Commits 형식: feat:, fix:, refactor:, docs:, test:, chore:
- 커밋 메시지는 한글 OK, 본문에 변경 이유 포함
- 하나의 커밋 = 하나의 논리적 변경

## Type Safety
- any 사용 금지 → unknown + 타입 가드 사용
- API 응답은 반드시 타입/인터페이스 정의
- as 타입 단언 최소화, 런타임 검증 우선

## Performance
- 불필요한 리렌더 방지 (React.memo, useMemo 적절히 사용)
- N+1 쿼리 금지
- 대량 데이터는 페이지네이션 또는 가상 스크롤 적용

## Security
- 시크릿/키는 반드시 환경변수(.env)로 관리
- 사용자 입력은 항상 검증 및 sanitize
- SQL/NoSQL 인젝션 방지 (parameterized query 사용)
- .env 파일은 절대 커밋하지 말 것

## Accessibility
- 시맨틱 HTML 사용 (div 남용 금지)
- 인터랙티브 요소에 aria 속성 포함
- 키보드 내비게이션 지원
- 색상만으로 정보를 전달하지 말 것

## Workflow
- 작업 전: 관련 파일 구조 파악 → 계획 제시 → 승인 후 코드 작성
- 작업 후: 변경된 파일 목록과 요약 제공
- 확신 없는 결정은 먼저 물어볼 것, 임의로 진행하지 말 것

---

## Documentation & Knowledge Management

### CLAUDE.md (이 파일) 유지 규칙
- 작업 중 발견한 중요한 사항, 주의점, 버그 패턴은 이 파일에 즉시 기록
- "다음에 이 코드를 수정할 때 꼭 알아야 할 것"이 있으면 반드시 추가
- 프로젝트 아키텍처 결정 사항(왜 이 방식을 선택했는지)도 기록
- 기록 시 날짜 포함 (예: [2025-03-09] Supabase RLS 정책 때문에 직접 쿼리 불가)

### docs/terms.md 관리
- 프로젝트에서 사용하는 도메인 용어, 비즈니스 용어를 정의
- 새로운 개념이나 용어가 등장하면 즉시 terms.md에 추가
- 형식:
```
  ## 용어명 (영문명)
  - 정의: ...
  - 코드에서의 사용: 변수명/타입명 등
  - 관련 파일: ...
```
- 코드에서 사용하는 변수명/타입명과 terms.md의 용어를 일치시킬 것
- 용어가 모호하면 사용자에게 확인 후 기록

### docs/architecture.md 관리
- 프로젝트 전체 구조도 유지 (모듈 간 의존관계)
- 주요 데이터 흐름 설명
- 새 모듈 추가 시 이 문서도 함께 업데이트
- 형식:
```
  ## 모듈명
  - 역할: ...
  - 의존: ...
  - 주요 파일: ...
```

### docs/env.example 관리
- 필요한 환경변수 목록과 설명을 예시 파일로 유지
- 새 환경변수 추가 시 반드시 이 파일도 업데이트
- 형식:
```
  # 데이터베이스
  DATABASE_URL=postgresql://user:password@localhost:5432/dbname
  
  # 인증
  JWT_SECRET=your-secret-key-here
```

### docs/api.md 관리
- API 엔드포인트 목록과 요청/응답 형식 기록
- 엔드포인트 변경 시 반드시 업데이트
- 형식:
```
  ## POST /api/auth/login
  - 설명: 로그인
  - Body: { email: string, password: string }
  - Response: { token: string, user: User }
  - 에러: 401 (잘못된 인증정보), 429 (요청 제한)
```

### CHANGELOG.md 관리
- 프로젝트 루트에 유지
- 버전별 주요 변경사항 기록
- 형식:
```
  ## [0.2.0] - 2025-03-09
  ### Added
  - 소셜 로그인 (Google, Kakao)
  ### Fixed
  - 토큰 만료 시 무한 리다이렉트 버그
  ### Changed
  - API 응답 형식 통일
```

### 문서 업데이트 원칙
- 코드 변경 시 관련 문서도 반드시 함께 업데이트
- 문서가 코드와 불일치하면 즉시 수정
- 모든 문서는 한글로 작성

---

## Known Issues
- [2026-03-09] Tailwind CSS v4에서 `print\:hidden` 같은 이스케이프 pseudo-class가 CSS 파싱 에러를 발생시킴 → `data-no-print` 어트리뷰트 + 순수 CSS로 대체
- [2026-03-09] shadcn Select의 `onValueChange`가 `string | null`을 전달함 → `(v) => { if (v) setter(v); }` 패턴 필요
- [2026-04-16] `concept_sheets.editor_html` 은 `authenticated` 전원에게 쓰기가 허용된 공유 테이블이라 한 계정이 오염시키면 다른 사용자 세션이 탈취될 수 있다. Stored XSS 방지를 위해 `sanitizeConceptHTML` ([src/lib/sanitize-html.ts](src/lib/sanitize-html.ts)) 를 저장 경로(`handleSave` in [src/hooks/useConceptSheetEditor.ts](src/hooks/useConceptSheetEditor.ts)) 와 렌더 변환 경로([src/lib/exam-transform.ts](src/lib/exam-transform.ts) 의 `transformHTML` / `stripTrailingEmpty` / `extractMarkedWords` 세 함수 entry) 양쪽에서 반드시 호출해야 한다. 새 TipTap 확장을 추가할 때는 `sanitize-html.ts` 의 `ALLOWED_TAGS` / `ALLOWED_ATTR` 화이트리스트를 같이 갱신하지 않으면 새 마크업이 조용히 제거된다
- [2026-06-16] 위 sanitize 는 **읽기(편집기 로드) 경로에서도** 호출해야 한다. 저장 시 정화했더라도 과거 오염 데이터·직접 DB/RPC 쓰기가 남을 수 있으므로, `useConceptSheetEditor` 의 기존 개념지 로드에서 `sheet.editor_html` 을 `sanitizeConceptHTML` 로 정화한 뒤 `initialHTML`/`editorHTML` 에 넣는다(편집기 `content` 주입 전 차단). 또한 `sanitize-html.ts` 는 **`class` 속성을 허용하지 않고**(Tailwind 유틸리티로 `fixed inset-0` 전체화면 overlay 주입 차단 — TipTap getHTML 은 이 확장 셋에서 class 를 직렬화하지 않으므로 정당 마크업 영향 없음), `ALLOW_DATA_ATTR: false` 로 두어 명시 화이트리스트(`data-concept`/`data-bg-color`/`data-border*`/`data-colwidth`)만 통과시킨다. 새 확장이 새 class/data-* 를 직렬화하면 화이트리스트를 같이 갱신해야 조용히 사라지지 않는다
- [2026-05-26] `sanitize-html.ts` 의 `style` 속성은 통째로 허용하면 안 된다. DOMPurify 는 CSS 속성값(예: `position:fixed;inset:0` 전체화면 overlay, `background-image:url(...)`)을 막지 않으므로, `uponSanitizeAttribute` 훅이 CSS 속성 화이트리스트(`text-align`, `background-color`, `border-*-color`)만 안전한 값으로 통과시키고 나머지는 제거한다. TipTap 이 만드는 정당한 inline style 은 이 셋뿐(TextAlign + CustomTableCell). 새 서식 확장이 inline style 을 쓰면 `ALLOWED_CSS_PROPS` 와 값 검증(`TEXT_ALIGN_VALUES` / `COLOR_VALUE_REGEXP`)을 같이 갱신해야 조용히 사라지지 않는다
- [2026-09-03] 표 재분할은 최대 2패스라, 1패스 조각이 다시 넘쳐 2패스에서 쪼개질 때 **1행짜리 조각(+반복된 제목 행)** 이 남을 수 있다. 내용 유실은 없고 외관 문제다

## Architecture Decisions
- [2026-03-09] 포인트 컬러 `#81D8D0`을 CSS 변수 `--primary`로 통합 → Tailwind `text-primary`, `bg-primary` 등으로 일관되게 사용
- [2026-03-09] 카테고리 포맷팅/그룹화 로직을 `lib/format.ts`로 추출 → words, exam/create 등 여러 페이지에서 중복 제거
- [2026-03-09] words/new 페이지를 CategoryForm + WordEntryTable로 분리 → 300줄 제한 준수
- [2026-03-09] App Router route 그룹 `(auth)`, `(main)`으로 인증 필요/불필요 영역 분리
- [2026-03-09] 네이버 웍스(LINE WORKS) OAuth 로그인으로 전환 → email/password 인증 제거, `@araeducation.co.kr` 도메인만 허용, Supabase admin API + magic link로 세션 수립

- [2026-03-10] 카테고리 마스터 테이블 도입 (publishers, major_chapters, sub_chapters, schools, school_materials) → 모든 사용자 공유, RLS는 authenticated만 체크. 기존 categories 테이블은 단어 그룹 매핑용으로 유지 (텍스트 값 저장)
- [2026-03-10] 외부지문 트리 구조: 학교명 > 프린트/작품명 (2레벨), 중등/고등: 출판사 > 학기 > 대단원 > 소단원 (4레벨)
- [2026-03-10] CategoryTree 컴포넌트를 단어 관리/시험지 생성에서 공유 → 단일 선택(onSelect) / 다중 선택(onToggle+multiSelect) 모드 지원

- [2026-04-16] concept_sheets Stored XSS 대응으로 `isomorphic-dompurify` 기반 화이트리스트 sanitize 를 다층 방어 (저장 경로 + exam-transform 세 함수 entry) 로 적용. CSP 는 [next.config.ts](next.config.ts) 의 정적 `headers()` 로 부여 — prod 에서도 Next App Router 부트스트랩 inline script 때문에 `script-src 'unsafe-inline'` 은 유지하되 `object-src 'none'`, `frame-ancestors 'none'`, `connect-src` 화이트리스트(`*.supabase.co`, NaverWorks) 로 유출 경로를 차단. DOMPurify 가 1차 방어, CSP 가 safety net 역할. RLS 는 학원 협업 모델을 위해 `authenticated` 공유를 유지. 향후 개선 후보: (1) `editor_html` → JSONB (TipTap `getJSON`), (2) nonce 기반 CSP, (3) concept_sheets 쓰기를 서버 라우트로 이전해 감사/rate limit 적용

- [2026-06-16] 카테고리 단일 출처화(방향 A). 단어지(`words`/`exams`)는 `categories` 를 **id 로 참조**해 마스터 이름 변경이 자동 반영되지만, 개념지(`concept_sheets`)는 같은 `categories` 트리에서 고르되 텍스트(`publisher`/`unit`/`subunit`)를 **복사 저장**해 rename 이 반영되지 않는 비대칭이 있었다. 완전 정규화(concept_sheets→categories FK) 대신, 위험이 낮은 **rename 트리거 동기화 확장**을 선택 — `sync_publisher_name`/`sync_major_chapter_name`/`sync_sub_chapter_name` 가 categories 와 함께 concept_sheets 도 갱신한다([sql/07_migration_sync_concept_sheets.sql](sql/07_migration_sync_concept_sheets.sql)). 향후 무결성이 더 필요하면 FK 정규화(B)로 승격 가능

- [2026-06-16] SQL 파일을 **적용 순서대로 번호(01~12) 접두사**를 붙여 정리했다(`sql/01_schema.sql` … `sql/12_fix_audit_log_insert_policy.sql`). 번호가 곧 신규 부트스트랩 적용 순서이며, 의존성 기반으로 결정됨(테이블 생성 → 감사/공유 → 도메인 RLS → categories 유니크 → exam_words 잠금 → 감사 함수 패치). 과거/대체된 마이그레이션(`00_apply_2026-05-26_security`, `migration_retake*`, `migration_enforce_user_id`, `migration_exam_rpc`)은 `sql/archive/` 로 이동해 이력만 보존(정의가 포인터 주석으로 무력화돼 신규 적용 대상 아님). 새 마이그레이션을 추가할 땐 다음 번호를 붙이고, 다른 SQL 파일을 참조하는 주석/문서 링크는 번호 포함 경로로 쓸 것
- [2026-06-16] **(위 항목 정정) `migration_enforce_user_id` 는 archive 에 두면 안 되는 *실행 대상* 트리거였다** — user_id(NOT NULL) 를 채우는 유일 경로라 archive 에만 있으면 신규 환경 생성이 전부 깨진다. 그래서 `sql/13_migration_enforce_user_id.sql` 로 승격했고 **신규 부트스트랩 범위는 01~13** 이다(`sql/archive/migration_enforce_user_id.sql` 은 SUPERSEDED 헤더로 무력화). 13 은 `CREATE OR REPLACE` + `DROP TRIGGER IF EXISTS` 라 멱등 — 기존 운영 DB(이미 트리거 보유)에 재적용해도 안전. archive 의 나머지(`00_apply...`, `migration_retake*`, `migration_exam_rpc`)는 여전히 포인터 무력화된 신규 적용 비대상

- [2026-08-15] **인쇄를 '측정 기반 명시적 페이지네이션'으로 전환** — 모든 인쇄 문서(시험지·답안지·객관식·단어장·개념지 5종)가 브라우저 자동 분할을 버리고 **JS 가 블록 높이를 실측해 고정 크기 A4 낱장 N 장에 배정**하는 방식으로 바뀌었다([src/lib/print/](src/lib/print/), [src/hooks/useA4Pagination.ts](src/hooks/useA4Pagination.ts), [src/components/print/](src/components/print/)). A4 를 96dpi px 로 못 박아(210mm=793.7px, 297mm=1122.52px) `@page { margin: 0 }` + 낱장 `break-after: page` 로 인쇄하므로 **화면 미리보기와 인쇄물이 1:1** 이다. 낱장 높이가 고정이고 본문이 `flex:1` 이라 푸터는 마지막 페이지에서도 바닥에 붙는다(페이지 번호 `n / N` 추가). 1페이지는 전체 헤더, 2페이지부터는 `CompactPageHeader` 가 반복된다. ⚠️ **되돌리지 말 것**: (1) `table + thead/tfoot` 자동 반복 — tfoot 은 '페이지 하단'이 아니라 '내용이 끝나는 자리'에 붙어 마지막 페이지 푸터가 중간에 뜬다(5회 이상 재발한 원인), (2) `position: fixed` 푸터 — 과거 시도 후 revert(d52c6e6→eae221b), (3) 인쇄 시 CSS multicol(`columns: 2`) — `column-fill: balance` 가 페이지 경계에서 콘텐츠를 유실시킨다. 2단은 엔진이 컬럼별로 블록을 배정해 해결한다. 같은 저자의 검증된 선례는 ara-system `app/r/omr/[token]/_sections/printCss.ts`(고정 px A4 면 + 시트별 page-break)
- [2026-08-15] **개념지 카테고리 출처를 단어지와 통일**했다. 이전엔 세 화면이 서로 다른 소스를 썼다 — 단어 관리/시험지 생성은 `categories` 테이블, 개념지 **편집기**는 마스터 3테이블 조합(`getAllSchoolLevelCategories`), 개념지 **목록**은 저장된 `concept_sheets` 텍스트 합성. 편집기가 `schools`/`school_materials` 를 아예 조회하지 않아 **외부지문 노드가 트리에 나오지 않았고**, 소단원이 있는 대단원은 "대단원 단독" 행을 만들지 않아 단어 등록에서는 되는 선택(소단원은 선택 사항)이 개념지에서는 불가능했다. `getAllSelectableCategories()` ([src/lib/category-master/aggregate.ts](src/lib/category-master/aggregate.ts)) 가 **마스터 중등/고등 전개 ∪ 마스터 외부지문 전개 ∪ `categories` 테이블** 을 자연키로 dedupe 해 단일 출처가 된다(중복 시 `categories` 행 우선 — 실제 UUID 를 가진 쪽). "단어가 없는 빈 카테고리도 선택 가능"이라는 기존 계약은 마스터 전개가 계속 포함되므로 유지된다. 개념지 목록 트리는 저장 텍스트 합성을 그대로 두되 key 에 `year`/`school_name` 을 포함시켰다(빼면 학교·년도가 다른 개념지가 한 노드로 뭉친다). 조회 실패도 더 이상 삼키지 않는다 — 예전엔 RLS/네트워크 실패가 "카테고리가 없습니다" 한 줄로만 보였다

- [2026-08-15] **외부지문 및 프린트에 년도·학년 도입**([sql/15_migration_external_year_grade.sql](sql/15_migration_external_year_grade.sql)). 계층이 `학교 > 프린트` → **`학교 > 년도 > 학년 > 프린트`** 가 됐다. 년도/학년은 `school_materials` 에 붙고(`UNIQUE(name, school_id, year, grade)` — 같은 이름 프린트를 해마다 따로 둘 수 있다), `categories`/`concept_sheets` 에도 복제된다. 타입은 INTEGER 가 아니라 **TEXT** 이고 **빈 문자열이 "미지정"** 이다 — 기존 컬럼(`grade`/`semester`)과 표기를 맞추고 자연키 유니크 인덱스의 `NULLS NOT DISTINCT` 의미를 흔들지 않기 위해서다. UI 표시값 `'미지정'` ↔ 저장값 `''` 변환은 [src/lib/external-category.ts](src/lib/external-category.ts) 의 `toStoredValue`/`toOptionValue` **한 곳에서만** 한다. 년도 Select 옵션은 롤링 윈도(내년~4년 전) **∪ 데이터에 실제로 존재하는 년도** — 윈도만 쓰면 오래된 년도의 프린트가 목록에서 영영 안 보인다. 부수 효과로 `ensureCategoryId` 가 외부지문 `grade` 를 `''` 로 강제하던 것이 사라져, `levelGradeToDivision` 이 제대로 판정되고 ara-system 이 외부지문을 전부 중등부로 등록하던 문제가 해소된다

- [2026-08-15] **ara-system public 스키마 읽기 전용 연동 도입** — 시험지 생성 페이지에 "내신 시험범위 불러오기" 카드(`src/components/exam/NaesinScopeLoader.tsx`)를 추가. ara-system 수업 > 내신 관리가 저장한 `public.school_exam_scopes`(+ `public.schools`, `public.curriculum_textbooks`)를 `supabase.schema('public')` 체이닝(`src/lib/supabase-public.ts` `publicDb()`)으로 직접 읽어, 학교/학년/학년도/시험 선택 → 저장된 단원 키를 `src/lib/naesin-scope/match.ts`(순수 매처)로 `exam.categories`에 텍스트 매칭해 자동 체크한다. **public 스키마는 읽기 전용 — 이 클라이언트로 쓰기 금지**(원본 관리는 ara-system). 매칭은 제목 문자열 기반이라(대단원/"대단원 > 소단원" 키, 공백 정규화) 미매칭 단원은 반드시 UI에 표면화한다(조용한 유실 금지, unmatchedUnits).

- [2026-08-30] **ara-system 이 `school_exam_scopes.scope` 의 의미를 바꿨다**(그쪽 mig458) — 예전엔 체크한 단원으로 자동 조립된 '시험범위 전체 문구'였지만, 이제 **프린트·부교재·외부지문만** 적는 칸이다(교과서 범위의 진실원은 `units`). 자동 선택은 원래부터 `units` 로만 하므로 매칭 동작은 그대로고, 화면 라벨만 '범위' → '프린트·외부지문' 으로 바꿨다(`NaesinScopeLoader.tsx`). 이 값을 다시 '전체 범위'로 취급하지 말 것 — 단원 문구는 여기 오지 않는다.

- [2026-09-03] **개념지 단 수를 '글자 수'에서 '글자 수 + 표 열 수'로 바꿨다**([src/lib/print/sheet-columns.ts](src/lib/print/sheet-columns.ts)). 300자 초과면 무조건 2단이었는데, 표가 있는 개념지는 거의 항상 300자를 넘어 **열 3~5개짜리 표가 폭 ≈328px 칸에 밀려 들어가** 잘렸다. 이제 `maxTableColumns` 가 3 이상이면 시트 전체를 1단(≈680px)으로 되돌린다. **혼합 폭(본문 2단 + 표만 전체 폭)은 일부러 안 했다** — 5종 문서가 공용하는 인쇄 엔진(`paginate`/`A4Document`)에 블록별 폭 개념을 새로 넣어야 해서 범위·위험 대비 이득이 작다. 단 수는 저장하지 않는 파생값이라 표를 지우면 자동으로 2단으로 돌아온다

## Gotchas
- [2026-09-03] **개념지 표는 '가로는 CSS, 세로는 분할기'가 각각 책임진다 — 한쪽만 고치면 증상이 남는다.** 가로: 자동 표 레이아웃에서 표 폭의 하한은 셀 min-content 합이라 `width:100%` 로는 못 줄인다. 셀에 **`overflow-wrap: anywhere`**(`break-word` 는 min-content 계산에 반영되지 않아 효과 없다)를 주고, 1·2단계 박스 묶음 래퍼([src/lib/exam-transform.ts](src/lib/exam-transform.ts) 의 `BLANK_RUN_CLASS`)의 `white-space: nowrap` 을 **표 셀 안에서만** `normal` 로 푼다(본문 `<p>` 에서는 한 단어의 박스가 갈리면 안 되므로 nowrap 유지). 인접 inline-block 박스 사이 줄바꿈은 nowrap 만 풀면 브라우저가 알아서 준다 — `<wbr>`/ZWSP 를 넣지 말 것(`textContent` 가 오염돼 제목 행 판정이 틀어진다). 세로: 넘치면 `.a4-sheet__body { overflow: hidden }` 이 **조용히 잘라낸다** — 인쇄물에서만 보이는 증상이라 화면만 보고 판단하지 말 것
- [2026-09-03] **`splitTableByRows` 의 `hasRowSpan` 전체 포기(bail-out)를 되살리지 말 것.** 예전엔 rowspan 셀이 하나라도 있으면 표를 안 쪼개고 `transform: scale` 로 축소해 깨알 표가 됐다(편집기에 '셀 병합'이 있어 흔한 표다). 지금은 [src/lib/print/table-row-plan.ts](src/lib/print/table-row-plan.ts) 의 `legalCutFlags` 가 **'이 행 앞에서 잘라도 되는가'** 를 계산해 병합 묶음 경계에서만 자른다 — 비합법 지점에서 끊으면 다음 조각에 병합 셀이 없어 **나머지 셀이 앞 열로 밀린다**. 묶음 하나가 용량보다 크면 그 조각만 용량을 넘겨 내보내고 엔진이 축소한다
- [2026-09-03] **조각 표의 제목 행 판정은 규칙이 세 겹이고, 코덱스 리뷰 4라운드로 다듬은 것이다 — 단순화하려다 되돌리지 말 것.** [split-html-blocks.ts](src/lib/print/split-html-blocks.ts) 의 `detectHeaderRows`.
  - **(1) 명시 제목 vs 추측**: `<th>` 전체거나 `<thead>` 안이면 작성자가 명시한 제목(`isExplicitHeaderRow`)이고, '비지 않은 셀이 전부 `<strong>`' 은 추측이다. 편집기가 `withHeaderRow: false` 로 표를 넣어 제목이 보통 `<td><strong>` 이라 추측이 꼭 필요하다. **다음 행으로 이어 가는 것은 명시 제목일 때만** — 이 규칙 하나가 (a) 굵은 데이터 행이 제목으로 승격되는 것과 (b) 제목 셀이 rowspan 으로 뻗은 첫 데이터 행이 제목 묶음에 끌려오는 것을 동시에 막는다. 이어가기를 무조건 허용하면 실측으로 `["구분뜻/가/나2", "구분뜻/가/다3", …]` 처럼 **데이터 행이 매 페이지 반복**된다
  - **(2) 합법 지점으로 후퇴**: 제목 묶음의 끝은 합법 절단점이어야 반복할 수 있다. 그래서 합법 지점으로 끝나는 마지막 후보만 `best` 로 확정하고, 더 가져가려다 실패하면 거기로 후퇴한다. `legalCut[count] ? count : 0` 처럼 **마지막 count 하나만 보면 앞서 확보한 합법 제목까지 통째로 버린다**(2행 th 제목의 둘째 행이 본문까지 뻗을 때 제목이 0 이 됐다)
  - **(3) 빈 텍스트 ≠ 빈 셀**: 2단계 박스는 빈 span, 3단계 밑줄은 `&nbsp;` 뿐이고 `stripSpaces` 의 `\s` 가 **NBSP 까지 지운다**. 그래서 개념어로만 이뤄진 제목 행이 '빈 행' 으로 오판된다. `countBlankMarks` 로 `.eb-blank-run`/`.eb-stage3-blank` 개수를 세고, `isStrongOnly` 는 텍스트와 표시 개수를 **따로** 비교한다(이어 붙여 비교하면 굵은 조각이 여럿일 때 텍스트-표시 순서가 어긋나 굵은 제목을 놓친다). 1단계는 초성 글자가 남아 무관하다
- [2026-09-03] **`legalCutFlags` 는 rowspan 을 행 그룹(`thead`/`tbody`)으로 클램프하지 않는다 — 일부러 그렇다.** HTML 규격상 rowspan 은 행 그룹 끝에서 끝나고 `rowspan="0"` 은 '그룹 끝까지' 지만, `buildChunk` 가 모든 행을 **단일 `<tbody>` 로 평탄화**하므로 절단 합법성만 그룹으로 좁히면 조각에서는 그 셀이 더 멀리 뻗어 **열이 밀린다**(합법성과 출력이 어긋난다). 지금은 뻗은 대로 인정하고 `rowspan="0"` 은 표 끝까지로 본다 — 보수적이라 최악이 '분할 못 해 축소 인쇄' 이고 절대 열이 밀리지 않는다. TipTap 은 `<thead>` 를 만들지 않고 단일 tbody 만 내보내 실제 콘텐츠에선 그룹이 하나뿐이라 클램프가 no-op 이기도 하다. 제대로 하려면 조각에 행 그룹을 보존하고 `rowspan="0"` 을 유한값으로 바꾸는 것까지 **같이** 해야 한다
- [2026-09-03] **`splitTableByRows` 는 쪼갤 수 없으면 입력 문자열을 `[tableHtml]` 그대로 돌려줘야 한다 — 그게 재분할 루프의 종료 조건이다.** [useConceptSheetBlocks](src/hooks/useConceptSheetBlocks.ts) 는 조각 수 > 1 일 때만 state 를 갱신하므로(`changed`), 억지로 조각 2개를 만들면 측정할 때마다 상태가 갱신돼 렌더 루프가 된다. `MAX_SPLIT_PASSES = 2` 는 그 위의 안전망일 뿐 진짜 가드가 아니다
- [2026-09-03] **조각 표는 각자 독립된 표라 auto 레이아웃이면 페이지마다 열 폭이 달라진다.** 그래서 측정 단계에서 '모든 셀이 colspan 1 이고 셀 수가 열 수와 같은 첫 행'의 셀 폭을 재([table-measure.ts](src/lib/print/table-measure.ts) 의 `measureColumnWidths`) 조각에 퍼센트 `<colgroup>` + `table-layout: fixed` 로 박는다. 기준 행이 없으면(모든 행에 병합 셀) colWidths 없이 auto 로 둔다. **이 `<colgroup>`/`<col>` 은 sanitize 화이트리스트에 없지만 문제없다** — 분할은 렌더 직전 단계라 `sanitizeConceptHTML` 을 다시 거치지 않는다. 반대로 편집기가 저장한 `colwidth` 는 `getHTML()` 이 colgroup 으로 직렬화하지 않고 sanitize 도 `col` 을 지우므로 **인쇄에 전혀 반영되지 않는다**(옛 colgroup 분기는 사실상 죽은 코드였다)
- [2026-08-30] **SQL 파일마다 대상 스키마가 다르다 — 실행 전에 어느 프로젝트에 붙었는지 확인할 것.** `sql/01~14` 는 `public` 을 대상으로 쓰였고(`SET search_path = public, pg_temp` 또는 무자격), **`sql/15`·`sql/16` 만 `exam`** 을 대상으로 한다. 리포에 `CREATE SCHEMA exam` 은 없다 — `exam` 스키마는 ara-system 의 마이그레이션 254(`exam-schema-from-araexam.sql`)가 만들었고, 앱은 [src/lib/supabase.ts](src/lib/supabase.ts) 의 `db: { schema: 'exam' }` 로 **그 공유 프로젝트**를 본다. 따라서 옛 standalone ara-exam 프로젝트(테이블이 `public` 에 있는 쪽)의 SQL Editor 에서 15/16 을 돌리면 조용히 어긋난다 — `SET search_path` 는 없는 스키마를 **에러 없이 건너뛰므로** 무자격 객체가 전부 `public` 을 향한다. 실제로 `normalize_category_name` 이 `public` 에 생성됐고, `public.categories` 에 `year` 가 없어 `42703` 이 났다. 이제 15/16 첫머리의 `DO $guard$` 블록이 `exam` 부재 시 명확한 메시지로 중단시킨다
- [2026-08-30] **Supabase SQL Editor 에서 파일 머리의 `SET search_path` 는 뒤따르는 문에 적용된다고 믿으면 안 된다.** 문(statement)별로 다른 백엔드에 갈 수 있어, sql/16 의 무자격 `CREATE OR REPLACE FUNCTION normalize_category_name(...)` 이 **`public` 에 생성된 사례가 실제로 있었다**(`pg_proc` 조회 결과 `exam` 은 없고 `public` 만). ara-system 의 public 스키마를 오염시키는 경로다(다행히 동명 함수가 없어 덮어쓴 피해는 없었다). **DDL 은 반드시 스키마를 명시**할 것 — `CREATE ... FUNCTION exam.normalize_category_name`, `COMMENT ON FUNCTION exam....`. DO 블록 안은 블록 첫머리의 `SET LOCAL search_path = exam, public` 이 있어 안전하지만, 블록 **밖** 최상위 문은 각자 자격을 갖춰야 한다. 확인: [sql/diagnose_category_state.sql](sql/diagnose_category_state.sql) 의 0번 쿼리
- [2026-08-30] **sql/16(중복 병합)은 sql/15(year 추가)보다 먼저 적용한다.** 닭-달걀이 있다 — sql/15 는 `categories` 에 `year` 를 추가하면서 `idx_categories_natural_key` 를 재생성하는데, 표기 변형으로 갈라진 **중복 행이 남아 있으면 유니크 인덱스 생성이 실패**한다. 편집기가 파일 전체를 한 트랜잭션으로 묶으면 앞의 `ADD COLUMN` 까지 롤백되어 `year` 없는 상태로 되돌아가고, 그 상태에서 sql/16 을 돌리면 `42703 column "year" does not exist` 가 난다(실제 발생). 그래서 sql/16 은 **pre-15 스키마에서도 돌아가도록** 만들었다 — `categories.year`, `school_materials.year/grade`, `concept_sheets.school_name` 은 `information_schema` 로 존재를 확인해 없으면 파티션 키/SET 절에서 빼고 `EXECUTE format()` 으로 조립한다(pre-15 데이터는 그 값이 아예 없으니 그룹 결과가 동일하다). 권장 순서 **16 → 15 → (16 재실행은 no-op)**. 상태 확인은 [sql/diagnose_category_state.sql](sql/diagnose_category_state.sql)(읽기 전용)
- [2026-08-30] 카테고리 이름 정규화는 **쓰기 경로만으로는 증상이 사라지지 않는다**. `normalizeCategoryName` 은 새로 저장하는 값만 고치므로, 이미 저장된 변형은 [sql/16_migration_normalize_category_names.sql](sql/16_migration_normalize_category_names.sql) 을 실행해야 합쳐진다. 트리를 만드는 읽기 경로 6곳(`buildCategoryTree` 호출처)은 전부 **DB 원시 문자열로 `groupBy`** 하므로 마이그레이션 전에는 계속 갈라져 보인다
  - **개념지 목록만은 앱에서 자가 치유한다** — 필터가 UUID 가 아니라 **값 비교**라, 트리 키와 필터를 같은 정규화 키([src/lib/concept-category.ts](src/lib/concept-category.ts) 의 `conceptCategoryKey`)로 맞추면 표기가 달라도 한 노드로 합쳐지고 **양쪽 표기의 개념지가 모두 보인다**. 트리만 합치고 필터는 원시 비교로 두면 합쳐진 노드를 눌렀을 때 한쪽이 조용히 사라지므로 **둘은 반드시 같은 키 함수를 써야 한다**
  - ⚠️ **`categories` 기반 트리(단어 관리·시험지 생성·시험 기록·단어 이동)에는 같은 수법을 쓰면 안 된다** — 선택이 `category.id`(실제 UUID) 기준이라, 표시만 합치면 대표 UUID 한 쪽의 단어만 필터에 걸리고 나머지 행의 단어가 가려진다(CHANGELOG 0.1.11 의 "표시만 합치면 조용히 가려진다"). 그쪽은 sql/16 의 **실제 행 병합**이 유일한 해법이다
- [2026-08-22] 카테고리 이름(출판사·대단원·소단원·학교·프린트명)은 **반드시 `normalizeCategoryName`** ([src/lib/category-name.ts](src/lib/category-name.ts)) 을 거쳐 저장할 것. 트리 노드는 이름 문자열 완전 일치로 묶이는데([src/lib/category-tree.ts](src/lib/category-tree.ts) 의 `groupBy`), DB 제약(`publishers UNIQUE(name, level)`, `idx_categories_natural_key`)이 전부 **바이트 비교**라 눈에 똑같은 `천재(정호웅)` / `천재 (정호웅)` 이 둘 다 저장되고 폴더가 두 개로 갈라진다. 규칙: 폭 없는 문자(U+200B/U+FEFF) 제거 → NFC → 전각 괄호`（）`→ASCII → 공백류 축약·trim → 괄호 주변 공백 제거. **폭 없는 문자 제거가 NFC 보다 먼저**여야 멱등이다(`ᄀ<ZWSP>ᅡ` 는 NFC 를 먼저 돌리면 ZWSP 를 뗀 뒤에도 자모가 분리된 채 남는다). 이 규칙은 [sql/16_migration_normalize_category_names.sql](sql/16_migration_normalize_category_names.sql) 의 `normalize_category_name()` 과 **1:1 미러**다 — 한쪽만 바꾸면 앱이 저장한 값과 DB 가 병합한 값이 갈라져 중복이 다시 생긴다. 새 이름 필드를 추가하면 쓰기 경로에 정규화를 넣을 것(마스터 CRUD 5개 / `ensureCategoryId` / 개념지 저장 payload)
- [2026-08-22] 중복 `categories` 를 병합할 때 `words` 의 `UNIQUE(category_id, word)` 선처리는 **"dup vs canonical" 만 비교하면 안 된다**(sql/09 의 원래 형태). 한 그룹에 dup 이 둘 이상이고 그 둘이 canonical 에 없는 같은 단어를 갖고 있으면, repoint 에서 둘 다 canonical 로 옮겨가 유니크 제약이 터지고 마이그레이션 전체가 롤백된다. sql/16 처럼 **canonical + 모든 dup 을 한 묶음**으로 보고 `(canonical_id, word)` 당 한 행만 남겨야 한다. 표기 변형은 몇 달에 걸쳐 쌓이므로 3개 이상 묶이는 그룹이 기본이다
- [2026-08-22] sql/16 은 **categories/concept_sheets 를 마스터보다 먼저** 정규화한다. 순서를 뒤집으면 마스터 rename 이 `sync_*_name` 트리거를 발화시키고, 그 `UPDATE categories SET publisher = NEW.name WHERE publisher = OLD.name` 이 이미 존재하는 정규형 행과 `idx_categories_natural_key` 충돌을 일으켜 블록 전체가 롤백된다. 먼저 정규화해 두면 트리거 WHERE 가 0행을 잡는 no-op 이 된다. 또한 `NULL school_name → ''` 를 병합보다 **먼저** 하면 안 된다 — 인덱스가 `NULLS NOT DISTINCT` 라 NULL 행과 '' 행이 공존할 때 충돌한다(sql/09 에선 인덱스 생성 전이라 무해했다)
- [2026-08-16] 외부지문 개념지를 ara-system 성적에 등록할 때 **`publisher` 슬롯에 학교명**을 보낸다([sync-concept-to-grades/route.ts](src/app/api/sync-concept-to-grades/route.ts)). 외부지문은 출판사가 항상 빈 값이라 그대로 두면 학교가 무엇이든 전부 **'기타' 그룹 한 곳**에 뭉친다. 수신부 `register_concept_exam`(ara-system mig257)에서 `p_publisher` 는 그룹 폴더명, `p_grade + ' ' + p_semester` 는 시리즈 폴더명으로 쓰이는 **표시용 문자열**일 뿐이고 학교급 라우팅은 별도 `p_division` 이 담당하므로 슬롯 재사용이 안전하다. **년도는 시리즈에 넣지 않는다** — ara-system 이 회차 라벨(`YY-NN`)을 연도별로 다시 세므로(mig343) 교과서 시리즈도 년도 없이 해마다 재사용한다. ⚠️ 이 매핑을 나중에 바꾸면 시리즈 코드(`md5(pub_key|series_name)`)가 달라져 **이미 등록된 회차가 다른 폴더로 이동하고 `round_number` 가 재계산**된다. 도입 시점에 외부지문 개념지가 0건이라 지금 형태로 고정한 것
- [2026-08-15] `categories` 자연키 유니크 인덱스에 **`year` 가 포함**된다(`level, year, grade, publisher, semester, chapter, sub_chapter, school_name`). `ensureCategoryId` 의 `upsert({ onConflict })` 는 이 목록과 **글자 그대로** 일치해야 하므로 [src/lib/words-save.ts](src/lib/words-save.ts) 의 `CATEGORY_NATURAL_KEY` 와 [sql/15_migration_external_year_grade.sql](sql/15_migration_external_year_grade.sql)·[sql/01_schema.sql](sql/01_schema.sql) 미러를 항상 같이 바꿀 것. **sql/15 를 앱 배포보다 먼저 적용**해야 한다 — 순서가 뒤바뀌면 upsert 가 실패해 단어 저장이 전부 막힌다. 신규 부트스트랩 범위는 이제 **01~16**
- [2026-08-15] 외부지문 rename 동기화(`sync_school_material_name`)는 `year`/`grade` 로 좁혀야 한다. 없으면 2026 중2 프린트 이름을 바꿀 때 다른 년도·학년의 동명 카테고리까지 함께 바뀐다(년도·학년 도입 전에는 구분 자체가 없어 무해했다). 앱 레벨 fallback([src/lib/category-master/school-materials.ts](src/lib/category-master/school-materials.ts))도 같은 `.eq()` 체인을 가져야 한다
- [2026-08-15] 마스터 rename 의 **앱 레벨 fallback 은 `categories` 와 `concept_sheets` 를 둘 다** 갱신해야 한다. 예전엔 `categories` 만 갱신해서, DB 트리거가 안 깔린 환경에서는 단어지만 새 이름이 되고 개념지는 옛 이름으로 남았다 — 단어지가 멀쩡해 보여 트리거 누락을 눈치챌 수 없는 형태였다(CHANGELOG 0.1.2 에서 한 번 고쳤던 증상의 재발 경로). 컬럼명 대응 주의: `chapter`↔`unit`, `sub_chapter`↔`subunit`
- [2026-08-15] 개념지 저장 검증은 **level 인지형**이어야 한다. 외부지문은 `publisher` 가 항상 빈 값이라, `grade` + `publisher` 를 무조건 요구하면 외부지문을 고를 수 있게 해도 저장이 막힌다([src/hooks/useConceptSheetEditor.ts](src/hooks/useConceptSheetEditor.ts) 의 `missingCategory`). 함께 `unit` 도 필수로 넣었다 — 예전엔 UI 라벨은 `unit` 유무로 판단하는데 검증은 `grade`/`publisher` 만 봐서 `unit=''` 저장이 통과했고, 인쇄 제목이 `"2026  국어 "` 처럼 공백만 남았다([ExamSheetRenderer.tsx](src/components/exam-builder/ExamSheetRenderer.tsx) 의 `filter(Boolean)` 이 템플릿 리터럴 앞부분을 못 걸렀다)
- [2026-08-15] 헤더([src/components/layout/Header.tsx](src/components/layout/Header.tsx))의 데스크톱 임계값은 `md:` 가 아니라 **`lg:`** 이고 브랜드 텍스트는 **`xl:` 부터**만 보인다. 관리자 계정은 메뉴가 7개(≈724px)라 로고·로그아웃까지 더하면 `lg`(콘텐츠 960px)에 겨우 들어간다. `flex-wrap` 이 없어 폭이 모자라면 flex 아이템이 줄바꿈되는 게 아니라 **각 아이템 내부 텍스트가 접혀** `h-16` 을 뚫고 헤더가 2줄이 된다 — 메뉴를 추가하려면 이 여유를 먼저 계산할 것. 로그인 이메일은 데스크톱에서 제거했고 모바일 메뉴에만 남아 있다
- [2026-08-15] 인쇄 문서에서 **측정과 렌더가 반드시 같은 폭·같은 래퍼**를 써야 한다. `A4Document` 는 숨김 컨테이너(`.a4-measure`)에 블록을 컬럼 폭으로 렌더해 높이를 재고 같은 값으로 낱장에 배치한다 — 낱장 쪽에 padding/width 를 덧붙이면 줄바꿈이 달라져 페이지 수가 어긋난다. 낱장 크기는 `src/lib/print/constants.ts` 가 단일 출처이고 `A4Sheet` 가 인라인 style 로 적용하므로 **CSS 에 px 를 복사하지 말 것**. 측정 컨테이너는 `visibility: hidden`(`display:none` 이면 높이가 0). 인쇄 대화상자에서 `.a4-measure` 가 `display:none` 이 되면 높이가 0 으로 읽히는데, 훅이 `footerHeight <= 0` 이면 기존 배치를 유지하도록 방어한다. 줄무늬는 `nth-child` 대신 인덱스 기반 클래스(`q-row--band`/`wb-row--band`/`mc-answer-grid--band`, 표는 `tr[data-row-even]`)를 쓴다 — 페이지·조각이 갈리면 nth-child 가 리셋되기 때문
- [2026-03-09] `@supabase/auth-helpers-nextjs`는 deprecated됨. 현재 직접 `@supabase/supabase-js` 사용 중
- [2026-03-09] exam_words 테이블은 단어 스냅샷이므로 원본 단어를 수정해도 기존 시험지에는 영향 없음
- [2026-04-14] `audit_log` 에는 INSERT 정책을 만들지 말 것. SECURITY DEFINER 트리거(postgres 소유, BYPASSRLS)가 RLS 를 우회하여 쓰기를 수행하므로 정책은 불필요하며, 어떤 열린 INSERT 정책이든 authenticated 클라이언트에게 직접 쓰기를 허용해 감사 로그 오염 경로가 된다 (과거 `"System can insert audit_log"` 정책 사례 참고)
- [2026-04-15] SECURITY DEFINER 함수는 반드시 `SET search_path = public, pg_temp` 를 지정할 것. 지정하지 않으면 호출 세션의 search_path 조작으로 함수 본문의 무자격 객체 참조(`audit_log` 등)가 엉뚱한 스키마로 해석되어 감사 로그 우회/오염이 가능해진다. `pg_temp` 는 반드시 마지막에 두어 임시 객체 섀도잉을 차단한다 (감사 트리거 함수 9개 참고 — [sql/11_fix_audit_functions_search_path.sql](sql/11_fix_audit_functions_search_path.sql))
- [2026-04-15] `exams` / `categories` / `concept_sheets` 의 `user_id` 는 BEFORE INSERT 트리거 `enforce_user_id_from_auth` 가 `auth.uid()` 로 강제 채우고, BEFORE UPDATE 트리거 `lock_user_id_on_update` 가 변경을 무효화한다. 클라이언트에서 `user_id` 를 보내지 말 것 — 보내도 무시되며, 이전엔 클라이언트가 임의 UUID 로 생성자 위조가 가능했다. RLS 는 여전히 `authenticated` 만 체크하는 공유 정책이므로 attribution 은 감사/필터용 메타로만 의미를 가진다. RPC `create_exam_with_words` 시그니처에서도 `p_user_id` 가 제거됨. `ensureCategoryId` 는 더 이상 `userId` 를 받지 않으며 매칭에서도 제외해 학원 내 동일 단원이 사용자별로 중복 생성되지 않는다. **[2026-06-16 정정] 이 두 트리거의 정식 정의는 [sql/13_migration_enforce_user_id.sql](sql/13_migration_enforce_user_id.sql) 다** — 그동안 정의가 `sql/archive/migration_enforce_user_id.sql` 에만 있어 번호 마이그레이션(01~12)만 적용한 신규 환경에서는 트리거가 없어 `user_id`(NOT NULL) 가 채워지지 않아 모든 생성이 깨지고 보안 전제도 빠지는 문제가 있었다. 신규 부트스트랩 범위는 이제 01~13 이다(13 은 멱등이라 기존 운영 DB 에 재적용해도 안전)
- [2026-04-15] 재시험 차수(`exams.retake_number`) 는 클라이언트에서 계산하지 말 것 — 두 사용자가 동시에 누르면 같은 `(parent_exam_id, retake_number)` 가 만들어진다. `create_exam_with_words` RPC 가 `p_parent_exam_id IS NOT NULL` 일 때 `pg_advisory_xact_lock(hashtext(parent::text))` 으로 직렬화 후 `MAX(retake_number)+1` 을 계산하고, 제목 접미사 `(재시험 N차)` 도 서버가 `format()` 으로 조립한다. 따라서 재시험 호출에서는 (a) `p_title` 에 **원본 제목만** 넘기고, (b) `p_retake_number` 를 보내지 말고, (c) 토스트/UI 는 RPC 반환 후 새 행을 다시 조회해 서버 차수를 사용해야 한다. 최후 안전망으로 `idx_exams_parent_retake_unique` (`(parent_exam_id, retake_number) WHERE parent_exam_id IS NOT NULL`) 부분 유일 인덱스가 RPC 우회 INSERT 까지 차단한다 — [sql/archive/migration_retake_atomic.sql](sql/archive/migration_retake_atomic.sql) 참조
- [2026-04-22] 객관식 시험 선지 셔플에 glibc LCG `(s * 1103515245 + 12345) & 0x7fffffff` 를 직접 쓰지 말 것. 하위 비트 랜덤성이 나빠 `% 5` 같은 작은 modulo 에서 정답이 4·5번으로만 쏠렸다(실측 16/20, 4/20). 추가로 시드를 UUID char code 합으로 계산하면 값 범위가 2300~2900 에 몰려 편향이 증폭된다. `src/lib/exam-choices.ts` 의 **mulberry32 + FNV-1a** 조합을 사용할 것 — 1000회×20문항 시뮬레이션에서 각 위치 ~20% 균등. [MultipleChoiceView.tsx](src/components/exam/MultipleChoiceView.tsx), [MultipleChoiceAnswerView.tsx](src/components/exam/MultipleChoiceAnswerView.tsx) 는 반드시 이 공유 모듈의 `generateChoices` / `getCorrectLabel` 을 써야 시험지와 답안지 매핑이 일치한다 — 셔플 로직을 한쪽만 바꾸면 답지가 틀어진다
- [2026-05-26] 배열 셔플에 `arr.sort(() => Math.random() - 0.5)` 를 쓰지 말 것 — 비교 함수가 비일관적이라 permutation 분포가 치우친다. 문제 순서 셔플(비결정)에는 [src/lib/shuffle.ts](src/lib/shuffle.ts) 의 `shuffle` (Fisher-Yates) 를, 시험지/답안지가 동일해야 하는 결정론적 셔플에는 `exam-choices.ts` 의 `seededShuffle` 를 쓴다
- [2026-05-26] `exam_words` 는 더 이상 클라이언트가 직접 INSERT/UPDATE/DELETE 할 수 없다. RLS 를 SELECT 전용으로 잠갔고(이전엔 `FOR ALL` 공유라 누구나 남의 시험지 단어를 변조/삭제 가능했고 감사도 없었다), 유일한 쓰기 경로인 `create_exam_with_words` 는 **SECURITY DEFINER** 로 바꿔 잠긴 RLS 를 우회해 INSERT 한다(`auth.uid()` 는 DEFINER 에서도 요청 JWT 를 읽어 attribution 유지). **DEFINER 라 테이블 RLS(도메인 조건)를 우회하므로 함수 첫머리에서 `public.is_allowed_domain()` 을 직접 검사**한다. RPC 는 `total_questions`/`pass_count`/`word_ids` 를 서버에서 재계산하고, **신규 생성**(`p_parent_exam_id IS NULL`)은 word·meaning 을 canonical `words` 에서 재조립 + 전 word_id 실재 검증해 내용 위조를 막는다. [2026-06-17] **`category_ids` 도 클라이언트 입력(`p_category_ids`)을 버리고 실제 포함 단어들의 `words.category_id`(NOT NULL) DISTINCT 집합으로 서버 재계산**해 출처/필터 라벨 위조를 차단한다(01_schema.sql 미러 + sql/10 둘 다 갱신 — 재적용 필요). **재시험**(`p_parent_exam_id IS NOT NULL`)은 클라이언트 입력(p_words/p_category_ids/메타)을 전혀 신뢰하지 않고 **서버가 부모 exam·exam_words 를 직접 읽어 재조립**(서버 셔플 순서)한다 — 직접 RPC 호출로 가짜 "재시험 N차" 를 만드는 것을 차단. 부모 스냅샷 복사라 삭제된 단어도 보존된다. RPC 클라이언트 호출 계약(원본 제목만, p_retake_number 미전달)은 그대로 — [sql/10_migration_lock_exam_words.sql](sql/10_migration_lock_exam_words.sql). DEFINER 가 RLS 를 우회하려면 함수 owner 가 테이블 owner/BYPASSRLS 여야 하므로 반드시 postgres 로 적용할 것
- [2026-05-26] `create_exam_with_words` 의 정식 정의는 [sql/10_migration_lock_exam_words.sql](sql/10_migration_lock_exam_words.sql) **한 곳**에서만 관리한다(+ 01_schema.sql 미러). 과거 `archive/migration_enforce_user_id.sql` / `archive/migration_retake_atomic.sql` / `archive/migration_exam_rpc.sql` 이 각자 함수를 재정의하고 `03_shared_exams_audit_log.sql` 이 `exam_words FOR ALL` 정책을 재생성해, 실행 순서에 따라 advisory lock·DEFINER·검증·쓰기잠금·도메인조건이 사라지는 퇴행이 있었다(전부 정의/정책을 제거하고 포인터 주석으로 대체함). 정책 소유권: 01_schema.sql(기준) + 10_migration_lock_exam_words.sql(exam_words SELECT 전용) + 08_migration_domain_restriction.sql(도메인). SQL 적용 순서: [2026-06-16] **파일명 번호(01~12) 순서대로 적용한다** — 번호가 곧 적용 순서다. `10_migration_lock_exam_words.sql` 이 마지막(exam_words 잠금·canonical RPC·도메인 가드 최종 승자)이고 `11`/`12` 는 감사 함수 패치다. `sql/archive/` 의 파일들(`00_apply...`, `migration_retake*`, `migration_enforce_user_id`, `migration_exam_rpc`)은 과거/대체된 마이그레이션으로 **신규 적용 대상이 아니다**(정의가 포인터 주석으로 무력화됨, 이력 보존용). 클라이언트 코드보다 `09_migration_categories_unique.sql`(upsert onConflict 의존)·`08_migration_domain_restriction.sql` 을 먼저 적용할 것. `01_schema.sql` 은 도메인 조건·categories 유니크 인덱스·is_allowed_domain 까지 포함한 **핵심 테이블(words/exams/exam_words/categories + 마스터)** 의 완전한 기준 상태다. 단, [2026-06-16 수정] `concept_sheets` 와 `audit_log` 테이블 DDL 은 01_schema.sql 에 없으므로(각각 [sql/02_create_concept_sheets.sql](sql/02_create_concept_sheets.sql), [sql/03_shared_exams_audit_log.sql](sql/03_shared_exams_audit_log.sql) 에만 존재) **01_schema.sql 단독으로는 신규 환경을 완전히 부트스트랩하지 못한다**. 신규 부트스트랩은 `sql/` 의 **번호 순서(01→12)대로 전부 적용**한다(05_words_audit·06_words_concurrency·07_migration_sync_concept_sheets·11·12 포함). 01_schema.sql 의 rename-sync 트리거가 `concept_sheets` 를 UPDATE 하지만, plpgsql 본문은 런타임에만 검증되므로 테이블이 나중에 생성돼도 트리거 생성 자체는 실패하지 않는다
- [2026-05-26] 도메인 제한(@araeducation.co.kr)은 RLS 헬퍼 `public.is_allowed_domain()` 으로 데이터 계층에서 강제한다([sql/08_migration_domain_restriction.sql](sql/08_migration_domain_restriction.sql)). 세션이 localStorage 에 저장되어(@supabase/ssr 미사용) 서버 미들웨어로 세션을 못 읽기 때문. 모든 공유 테이블 정책의 USING/WITH CHECK 에 `AND public.is_allowed_domain()` 가 붙어 있으니 새 테이블/정책 추가 시 함께 넣을 것. 클라이언트 가드(auth-context)와 OAuth 콜백 검사는 보조(UX)이며 권위는 RLS 다. 도메인 문자열은 [src/lib/constants.ts](src/lib/constants.ts) 의 `ALLOWED_EMAIL_DOMAIN` / `isAllowedEmailDomain` 로 통일
- [2026-05-26] `categories` 는 자연키(`level, grade, publisher, semester, chapter, sub_chapter, school_name`)에 유니크 인덱스 `idx_categories_natural_key`(NULLS NOT DISTINCT)가 있다. `ensureCategoryId` 는 SELECT→INSERT 대신 `upsert({ onConflict: ... })` 단일 호출로 동시 저장 중복을 막는다 — onConflict 컬럼 목록(`CATEGORY_NATURAL_KEY`)은 인덱스와 정확히 일치해야 한다. 인덱스 없이 코드만 배포하면 upsert 가 실패하므로 [sql/09_migration_categories_unique.sql](sql/09_migration_categories_unique.sql) 를 먼저 적용할 것
- [2026-06-16] 마스터 이름 rename 동기화 트리거(`sync_publisher_name`/`sync_major_chapter_name`/`sync_sub_chapter_name`)는 `categories` 와 `concept_sheets` 를 **둘 다** 갱신해야 한다. concept_sheets 는 컬럼명이 다르다: categories `chapter`↔concept_sheets `unit`, `sub_chapter`↔`subunit`(publisher/level/grade/semester 는 동일). 한쪽만 갱신하면 단어지와 개념지에 같은 출판사가 두 표기로 갈라진다. concept_sheets 는 자연키 유니크 제약이 없어 같은 표기로 수렴해도 에러 없이 행이 합쳐져 보인다(categories 는 유니크 인덱스가 있어 두 출판사를 같은 이름으로 통일하면 충돌 가능 — 그쪽은 [sql/09_migration_categories_unique.sql](sql/09_migration_categories_unique.sql) 의 병합으로 처리). 외부지문(schools/school_materials) 트리거는 concept_sheets 대상 아님(중등/고등만). 정식 정의는 01_schema.sql + [sql/07_migration_sync_concept_sheets.sql](sql/07_migration_sync_concept_sheets.sql) 미러
- [2026-06-21] `exams` 도 직접 INSERT/UPDATE 를 막았다(이전엔 `FOR ALL` 공유라 누구나 `create_exam_with_words` RPC 를 우회해 `supabase.from('exams').insert(...)` 로 exam_words 와 매칭 안 되는 가짜 시험지·메타데이터 위조 INSERT, 또는 남의 시험지 제목/합격선/차수를 UPDATE 변조할 수 있었다 — 감사 트리거는 남지만 변조 자체는 못 막았다). 정책을 **SELECT/DELETE 전용**으로 바꾸고, 생성은 오직 SECURITY DEFINER `create_exam_with_words` 로만 한다(DEFINER owner=postgres 라 RLS 우회 INSERT, INSERT 정책 불필요). 삭제는 클라이언트 직접 + `audit_exam_delete` 감사 유지, 수정(UPDATE)은 앱 경로가 없어 기본 deny(향후 편집 기능은 전용 DEFINER RPC 로 추가). 정식 정의: [sql/14_migration_lock_exams_writes.sql](sql/14_migration_lock_exams_writes.sql) + 01_schema.sql·08_migration_domain_restriction.sql 미러(셋 다 SELECT/DELETE — 한 곳만 바꾸면 적용 순서상 `FOR ALL` 부활 위험). **신규 부트스트랩 범위는 이제 01~14**. exam_words 잠금(sql/10)과 같은 결의 구멍이었다. 클라이언트는 exams 를 SELECT/DELETE + RPC 로만 쓰므로 기존 앱과 호환(직접 INSERT/UPDATE 코드 없음)
- [2026-06-21] `create_exam_with_words` **신규 생성** 분기에 검증 3종 추가 — (1) **중복 word_id 차단**(`cardinality(v_word_ids) <> DISTINCT count`; exam_words 에 `(exam_id, word_id)` 유니크 제약이 없어 직접 RPC 호출로 같은 단어를 5번 넣으면 객관식 선지가 5개 미만으로 무너졌다), (2) **표시 문자열 distinct ≥ 5**(`COUNT(DISTINCT words.word)`; [exam-choices.ts](src/lib/exam-choices.ts) 가 `word` 문자열로 선지 중복을 제거하므로 서로 다른 word_id 라도 표기가 같으면 선지 부족), (3) **order_index 서버 canonicalize** — 클라이언트 `order_index` 를 버리고 `jsonb_array_elements(p_words) WITH ORDINALITY` 의 배열 위치(`ord-1`)를 `v_word_ids` 정렬과 `exam_words.order_index` 양쪽에 쓴다(음수/중복/희소 order_index 로 출제 순서를 망가뜨리는 우회 차단). [sql/10_migration_lock_exam_words.sql](sql/10_migration_lock_exam_words.sql) + 01_schema.sql 미러 — **재적용 필요**
- [2026-06-21] OAuth redirect_uri·콜백 리다이렉트 origin 을 Host 헤더가 아니라 환경변수 **`APP_ORIGIN`** 으로 고정한다([src/lib/app-origin.ts](src/lib/app-origin.ts) 의 `resolveAppOrigin`). Host 조작으로 redirect_uri 가 오염되거나 매직링크 `token_hash` 가 공격자 호스트로 새는 것을 막는다. **프로덕션 fail-closed**: `APP_ORIGIN` 미설정/오설정(스킴 누락 등)이면 throw → 두 OAuth 라우트(`naver-works/route.ts`, `callback/route.ts`)가 제어된 500 반환(내부 설정명 비노출, try/catch 로 감쌈). 따라서 **배포 환경에 `APP_ORIGIN` 을 반드시 설정**해야 로그인이 동작한다(로컬은 미설정 시 요청 origin 폴백). [docs/env.example](docs/env.example) 참고
- [2026-06-21] CSP `style-src`/`font-src` 에 `https://cdn.jsdelivr.net` 을 허용한다([next.config.ts](next.config.ts)). [globals.css](src/app/globals.css) 가 Pretendard/GmarketSans 폰트 스타일시트를 jsdelivr 에서 `@import` 하고 그 시트가 같은 CDN 의 woff2 를 불러오는데, `'self'` 만 두면 프로덕션에서 폰트가 차단된다. 폰트 import 호스트를 바꾸면 CSP 도 같이 갱신할 것
- [2026-06-21] `concept_sheets` 저장은 공유 테이블이라 last-write-wins 였다 → `useConceptSheetEditor` 가 로드 시 `updated_at` 을 기억하고 저장 시 `.eq('updated_at', loadedUpdatedAt)` 로 **낙관적 동시성 제어**한다(0행 갱신=충돌이면 새로고침 안내). 저장 성공 시 반환된 `updated_at` 으로 버전을 갱신해 연속 저장이 가능하다. `updated_at` 은 `concept_sheets_updated_at` 트리거가 자동 갱신([sql/02_create_concept_sheets.sql](sql/02_create_concept_sheets.sql))