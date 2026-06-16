# Changelog

## [0.1.4] - 2026-06-16
### Security
- 개념지 편집기 로드(읽기) 경로에서도 `editor_html` 을 `sanitizeConceptHTML` 로 정화 — 저장 시점 정화만으로는 과거 오염 데이터·직접 DB/RPC 쓰기로 남은 페이로드가 편집기 `content` 주입 시 실행될 수 있었음(Stored XSS). `useConceptSheetEditor` 기존 개념지 로드에서 정화 후 `initialHTML`/`editorHTML` 설정 ([src/hooks/useConceptSheetEditor.ts](src/hooks/useConceptSheetEditor.ts))
- sanitizer 화이트리스트 강화 — `class` 속성 허용 제거(Tailwind 유틸리티 기반 `fixed inset-0` 전체화면 overlay·클릭 유도 UI 주입 차단), `ALLOW_DATA_ATTR: true → false` 로 임의 `data-*` 주입 차단(명시 화이트리스트만 통과). 회귀 테스트 2건 추가 ([src/lib/sanitize-html.ts](src/lib/sanitize-html.ts))
- `user_id` 강제 트리거(`enforce_user_id_from_auth`/`lock_user_id_on_update`)를 `sql/archive` 에서 정식 번호 마이그레이션 [sql/13_migration_enforce_user_id.sql](sql/13_migration_enforce_user_id.sql) 로 승격 — archive 에만 있어 번호(01~12)만 적용한 신규 환경은 트리거 부재로 `user_id`(NOT NULL) 가 안 채워져 모든 생성이 깨지고 "DB 가 attribution 강제"라는 보안 전제도 빠져 있었음. 멱등 마이그레이션이라 기존 DB 재적용 안전. 신규 부트스트랩 범위 01~13 으로 갱신
- `create_exam_with_words` 신규 생성 시 `category_ids` 를 클라이언트 입력 대신 **실제 포함 단어들의 canonical `words.category_id` 집합으로 서버 재계산** — 직접 RPC 호출로 시험 내용과 무관한 출처/필터 라벨을 위조하는 경로 차단(sql/10 + 01_schema.sql 미러). ⚠️ DB 에 두 파일 재적용 필요
- 네이버 웍스 콜백의 provider 표식을 `user_metadata` → **`app_metadata`(service-role 전용, 위조 불가)** 로 이동 ([src/app/api/auth/naver-works/callback/route.ts](src/app/api/auth/naver-works/callback/route.ts)). 다른 provider 우회 차단의 1차 방어선은 Supabase 대시보드에서 불필요 provider 비활성화 + RLS 도메인 제한(미적용 — 운영자 조치 필요)
### Fixed
- 객관식 5지선다에서 같은 표시 문자열(`word`)을 가진 단어가 여러 행(다중 카테고리)에 있을 때 정답과 똑같이 보이는 오답·중복 오답이 섞여 문항이 모호해지던 문제 — `generateChoices` 가 `word` 기준으로 방해지 중복을 제거(결정론 유지, 시험지/답안지 일치). 테스트 추가 ([src/lib/exam-choices.ts](src/lib/exam-choices.ts))
- 시험지 보기·단어장 인쇄·대시보드 로더가 네트워크 예외(throw) 시 `setLoading(false)` 가 실행되지 않아 스피너가 무한 정지하던 문제 — `try/catch/finally` 로 감싸 실패 시 not-found/초기값 처리
### Changed
- 재시험 생성의 죽은 클라이언트 셔플 제거 — 서버 RPC(`create_exam_with_words`)가 부모 `exam_words` 를 `ORDER BY random()` 로 재셔플하므로 클라이언트 `shuffle(originalWords)` 결과는 무시되던 코드였음. 셔플 단일 출처를 서버로 명확화 ([src/hooks/useExamHistory.ts](src/hooks/useExamHistory.ts))
- `exam/builder/page.tsx`(307줄, 300줄 규칙 초과)를 `useConceptList` 훅 + `ConceptSheetCard` 컴포넌트로 분리 — 조회/필터/삭제/페이지네이션 책임 분리, 모든 파일 300줄 이하
### Performance
- 시험 이력 조회의 과다 조회(over-fetch) 축소 — `select('*')` 가 목록에 쓰지 않는 무거운 `word_ids`(시험당 수백 UUID 배열)까지 가져오던 것을 목록/필터에 필요한 컬럼만 조회하도록 변경 ([src/hooks/useExamHistory.ts](src/hooks/useExamHistory.ts))
### Docs
- 코덱스 리뷰 중 즉시 적용하지 않은 아키텍처 항목(세션 쿠키화 #4, CSP nonce #3, 객관식 선지 DB 스냅샷 #6, 진짜 서버 페이지네이션 #11)의 설계를 [docs/security-roadmap.md](docs/security-roadmap.md) 로 정리

## [0.1.3] - 2026-06-16
### Security
- exam_words SELECT RLS 정책에서 도메인 가드(`public.is_allowed_domain()`)가 빠지던 퇴행 수정 — 적용 순서상 마지막인 `10_migration_lock_exam_words.sql`(및 번들 `archive/00_apply_2026-05-26_security.sql`)이 도메인 조건 없이 정책을 재생성해, 앞선 `08_migration_domain_restriction.sql`의 제한을 덮어쓰고 있었음
- `04_shared_concept_sheets_audit.sql`이 도메인 가드 없는 concept_sheets 공유 정책을 재생성하던 드리프트 위험 제거 — 정책 정의를 삭제하고 포인터 주석으로 대체(정책 소유권은 01_schema.sql + 02_create_concept_sheets.sql + 08_migration_domain_restriction.sql)
### Fixed
- 카테고리 드롭다운(출판사/대단원/소단원/학교/프린트)에서 선택값이 한글 이름 대신 UUID 로 표시되던 문제 — base-ui Select 는 `items`(value→label) 매핑이 없으면 팝업을 열기 전까지 선택된 value(UUID)를 그대로 표시한다. `CategoryForm` 의 id 기반 Select 5개에 `items` 를 전달해 항상 한글 이름이 보이도록 수정
- 네이버 웍스 OAuth 콜백의 네트워크/SDK 예외가 500 또는 unhandled rejection 으로 새던 문제 — 서버 콜백 try/catch, 클라이언트 콜백 `.catch()` 추가
- 시험 이력 날짜 필터가 UTC 변환으로 KST 자정 부근에서 하루 어긋나던 off-by-one — 로컬 날짜 비교(`toLocalDateString`)로 수정
- 카테고리 필터 변경/초기화 시 선택이 유지되어 숨겨진 시험지가 일괄삭제될 수 있던 문제 — 필터 변경 시 선택 초기화
- 잘못된/삭제된 categoryId 로 단어장 인쇄 페이지 진입 시 스피너가 멈추지 않던 문제 — not-found 상태 추가
- 감사 로그 조회 실패가 "로그 없음"과 구분되지 않던 문제 — 에러 토스트 및 전용 에러 상태 표시
- 카테고리(출판사/대단원/소단원/학교/프린트) 삭제 실패 시에도 성공 토스트가 뜨던 문제 — `error` 확인 후 성공 처리
### Performance
- 개념지 목록이 무거운 `editor_html` 본문까지 전량 조회하던 문제 — 목록/트리에 필요한 컬럼만 조회(`editor_html` 제외, `ConceptSheetListItem` 타입)하고 카드에 "더 보기" 페이지네이션(24개 단위) 적용
- 시험 이력이 모든 스레드를 한 번에 렌더링하던 문제 — "더 보기" 렌더 페이지네이션(30개 단위) 적용, 전체선택은 화면에 보이는 항목 기준으로 동작
### Changed
- SQL 파일을 적용 순서대로 번호(01~12) 접두사로 정리 — 번호가 곧 신규 부트스트랩 순서. 과거/대체된 마이그레이션(`00_apply...`, `migration_retake*`, `migration_enforce_user_id`, `migration_exam_rpc`)은 `sql/archive/` 로 이동(이력 보존). 파일 간 참조 주석·문서 링크도 새 경로로 갱신
### Docs
- `01_schema.sql` 단독 부트스트랩 가능 주장 정정 — concept_sheets/audit_log DDL 은 별도 파일에 있어 신규 부트스트랩 권장 순서를 CLAUDE.md 에 명시

## [0.1.2] - 2026-06-16
### Fixed
- 출판사/대단원/소단원 이름을 마스터에서 바꿔도 개념지(concept_sheets)는 옛 표기로 남아 단어지와 같은 출판사가 두 표기로 갈라져 보이던 문제 — rename 동기화 트리거(`sync_publisher_name`/`sync_major_chapter_name`/`sync_sub_chapter_name`)에 concept_sheets 갱신을 추가해 단어지·개념지가 한 번의 이름 변경으로 함께 따라오도록 함 (sql/07_migration_sync_concept_sheets.sql)
- 기존 개념지의 출판사 공백 표기 변형(`비상 (박현숙)`/`천재 (정호웅)`) 일회성 정리

## [0.1.1] - 2026-04-16
### Security
- concept_sheets.editor_html 의 Stored XSS 취약점 수정 — `isomorphic-dompurify` 화이트리스트 sanitize 를 저장 경로(`handleSave`) 와 렌더 변환 경로(`exam-transform` 3개 함수) 양쪽에 적용해 다층 방어 구성
- `next.config.ts` 에 Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy 추가 — `object-src 'none'` / `frame-ancestors 'none'` / `connect-src` 화이트리스트로 외부 유출 경로 차단
### Added
- `src/lib/sanitize-html.ts` + 테스트 10건 (`<script>`, `onerror`, `javascript:` 제거 및 TipTap 합법 마크업 보존 검증)

## [0.1.0] - 2026-03-09
### Added
- 프로젝트 초기 설정 (Next.js 16, Tailwind CSS v4, Shadcn UI)
- Supabase Auth 기반 로그인/회원가입
- 단어 관리 (카테고리 체계: 중등/고등/외부지문)
- 개별 단어 입력 및 CSV 대량 업로드
- 임시 저장 및 불러오기 (localStorage)
- 시험지 생성 (카테고리 선택, 합격선 자동 계산, 셔플)
- 시험지/답안지/단어장 3종 보기
- A4 인쇄 최적화 (Print CSS)
- 시험 이력 대시보드
- Supabase RLS 보안 정책
