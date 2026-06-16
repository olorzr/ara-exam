# Changelog

## [0.1.3] - 2026-06-16
### Security
- exam_words SELECT RLS 정책에서 도메인 가드(`public.is_allowed_domain()`)가 빠지던 퇴행 수정 — 적용 순서상 마지막인 `migration_lock_exam_words.sql`(및 번들 `00_apply_2026-05-26_security.sql`)이 도메인 조건 없이 정책을 재생성해, 앞선 `migration_domain_restriction.sql`의 제한을 덮어쓰고 있었음
- `shared_concept_sheets_audit.sql`이 도메인 가드 없는 concept_sheets 공유 정책을 재생성하던 드리프트 위험 제거 — 정책 정의를 삭제하고 포인터 주석으로 대체(정책 소유권은 schema.sql + create_concept_sheets.sql + migration_domain_restriction.sql)
### Fixed
- 네이버 웍스 OAuth 콜백의 네트워크/SDK 예외가 500 또는 unhandled rejection 으로 새던 문제 — 서버 콜백 try/catch, 클라이언트 콜백 `.catch()` 추가
- 시험 이력 날짜 필터가 UTC 변환으로 KST 자정 부근에서 하루 어긋나던 off-by-one — 로컬 날짜 비교(`toLocalDateString`)로 수정
- 카테고리 필터 변경/초기화 시 선택이 유지되어 숨겨진 시험지가 일괄삭제될 수 있던 문제 — 필터 변경 시 선택 초기화
- 잘못된/삭제된 categoryId 로 단어장 인쇄 페이지 진입 시 스피너가 멈추지 않던 문제 — not-found 상태 추가
- 감사 로그 조회 실패가 "로그 없음"과 구분되지 않던 문제 — 에러 토스트 및 전용 에러 상태 표시
- 카테고리(출판사/대단원/소단원/학교/프린트) 삭제 실패 시에도 성공 토스트가 뜨던 문제 — `error` 확인 후 성공 처리
### Performance
- 개념지 목록이 무거운 `editor_html` 본문까지 전량 조회하던 문제 — 목록/트리에 필요한 컬럼만 조회(`editor_html` 제외, `ConceptSheetListItem` 타입)하고 카드에 "더 보기" 페이지네이션(24개 단위) 적용
- 시험 이력이 모든 스레드를 한 번에 렌더링하던 문제 — "더 보기" 렌더 페이지네이션(30개 단위) 적용, 전체선택은 화면에 보이는 항목 기준으로 동작
### Docs
- `schema.sql` 단독 부트스트랩 가능 주장 정정 — concept_sheets/audit_log DDL 은 별도 파일에 있어 신규 부트스트랩 권장 순서를 CLAUDE.md 에 명시

## [0.1.2] - 2026-06-16
### Fixed
- 출판사/대단원/소단원 이름을 마스터에서 바꿔도 개념지(concept_sheets)는 옛 표기로 남아 단어지와 같은 출판사가 두 표기로 갈라져 보이던 문제 — rename 동기화 트리거(`sync_publisher_name`/`sync_major_chapter_name`/`sync_sub_chapter_name`)에 concept_sheets 갱신을 추가해 단어지·개념지가 한 번의 이름 변경으로 함께 따라오도록 함 (sql/migration_sync_concept_sheets.sql)
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
