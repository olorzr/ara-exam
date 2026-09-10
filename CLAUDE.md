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
- [2026-09-04] 표 재분할은 한 패스에 **표 하나**만 쪼갠다(상한 32). 표가 많은 개념지는 그만큼 재측정이 돈다 — 렌더가 몇 프레임 늦을 뿐 내용에는 영향이 없다. 페이지 끝에 걸린 조각이 측정 오차로 다시 밀리면 **1행짜리 조각(+반복된 제목 행)** 이 남을 수 있다(내용 유실 없음, 외관 문제)

## Architecture Decisions
- [2026-09-10] **기출 업로드의 파일 순서는 안내로만 지킨다 — 자동 정렬·재정렬 UI 를 넣지 말 것.** OCR 은 올라온 순서를 그대로 믿는다(문제 쪽은 `problemPages` 오름차순, 답지 사진은 [answer-key-input.ts](src/lib/problem-ocr/answer-key-input.ts) `answerKeyStoragePlan` 의 배열 인덱스가 곧 문항 번호). 쪽의 **진짜 순서는 내용에만 있어서**, 알아내려면 이미지를 모델에 한 번 더 보내야 하고 그게 곧 토큰이다 — 얻는 것에 비해 값이 크다고 보고 안 한다. **파일명 자연 정렬(`naturalCompare`)은 공짜지만 그것도 답이 아니다**: 카톡으로 받은 사진·스캐너 기본 이름에는 순서가 안 담겨 있어 무력하면서, 선생님이 일부러 고른 순서를 뒤집는다. 그래서 **파일 고르는 자리마다 안내를 붙이고**([SourceFilePickers.tsx](src/components/problem-ocr/SourceFilePickers.tsx) 두 칸 · [PdfPageSelect.tsx](src/components/problem-ocr/PdfPageSelect.tsx) · [업로드 페이지](src/app/(main)/problems/upload/page.tsx) 맨 위와 읽기 직전), 고른 답지 사진에는 **번호를 붙여 보여 준다** — 예전 `truncate` 한 줄은 세 장만 넘어도 뒤가 잘려 뒤바뀐 순서를 눈치챌 방법이 없었다. **읽기 시작을 막는 확인창은 만들지 않았다**: 앱은 순서가 맞는지 알 방법이 없어(알려면 OCR) 못 지킬 확인이 되고 클릭만 늘린다
- [2026-09-09] **기출 문제 은행 — 문법 분류 축**([sql/21_problem_bank_grammar.sql](sql/21_problem_bank_grammar.sql), [grammar-tree.ts](src/lib/problem-bank/grammar-tree.ts)). 되돌리지 말아야 할 판단들:
  - **이 축만 저장 모양이 다르다.** `area_path`·`unit_path` 는 `TEXT[]` 하나가 **경로 하나**라 문항에 한 개만 붙지만, 수능 문법 문항은 개념 두셋을 걸친다. 그래서 `grammar_paths` 는 경로를 `' > '` 로 이어 붙인 **문자열을 원소로** 담는다(`{"단어 > 품사 > 명사","문장 > 문법 요소 > 피동 표현"}`). 그 결과 **상위 검색이 `contains`(@>)가 아니라 `overlaps`(&&)** 다 — `@>` 는 "준 것을 전부 가진 행"이라 잎을 여럿 넘기면 **전부 태깅된 문항만** 나온다. `filters.ts` 의 `toProblemQuery` 가 `grammarPathsUnder` 로 잎을 펴서 넘기고 `queries.ts` 가 `&&` 를 건다 — 한쪽만 바꾸면 상위 검색이 0건이 된다
  - **조상을 함께 저장하지 않는다.** `{'단어','단어 > 품사','단어 > 품사 > 명사'}` 로 펴 두면 `@>` 한 번으로 상위 검색이 되지만, 마스터를 고치는 순간 **저장된 조상만 낡아** 검색이 어긋난다. 저장은 사람이 고른 잎뿐이고, 펴는 일은 늘 손안에 있는 마스터가 그때그때 한다
  - **마스터는 DB 가 아니라 코드 상수다**(`GRAMMAR_TREE`). 수능 문법 체계는 교재 목차대로 고정이라 관리 화면·마스터 표를 두지 않았다. 덕분에 이 축에는 **트리를 못 읽어 검증을 건너뛰는 fail-soft 경로가 없다**(area/unit 과 다른 점 — 그쪽은 `longestKnownPrefix` 가 빈 트리를 통과시킨다). 항목을 고치려면 그 파일을 고쳐 배포한다
  - **선언 순서가 곧 화면 순서다.** 이름순으로 정렬하지 말 것 — 9품사(명사·대명사·수사…)나 음운 변동은 학교문법이 가르치는 순서가 따로 있고 선생님이 그 순서로 찾는다. 필터 선택지도 `GRAMMAR_ORDER`(목차 순서)로 정렬한다
  - **깊이가 가지마다 다르다.** 담화·어문 규정은 2단에서 끝나고 나머지는 3단이다. `AreaPathPicker` 는 `optionsAt` 이 비면 그 칸을 안 그려서 UI 가 알아서 처리한다 — 그래서 **DB CHECK 는 경로 길이가 아니라 태그 개수**(`cardinality <= 5`)를 건다
  - **`passages` 에는 넣지 않았다.** 문법 문항은 지문에 딸리지 않는 단독 문항이고 〈보기〉는 지문이 아니라 발문 안 상자다. 축을 하나만 두어 패싯·필터·병합이 전부 절반이다
  - **일괄 태깅은 RPC 한 번이고 합집합이다**(`exam.add_grammar_paths`). PostgREST 로는 배열 append 를 못 해서 행마다 읽고-합치고-쓰면 한 쪽에 60왕복이고 그 사이 남이 붙인 태그를 덮어쓴다. 덧붙이기만 하므로 **낙관적 동시성 조건이 필요 없다**. ⚠️ 합칠 때 **기존 태그를 앞에 두고 새 것을 뒤에 붙인 다음 상한까지 자른다** — 정렬해서 자르면 이미 5개인 문항에서 기존 태그가 밀려 사라져 붙이려던 것이 **지우는 일**이 된다. 이미 다 붙어 있는 행은 `IS DISTINCT FROM` 으로 건너뛴다(헛되이 `updated_at` 을 올리면 그 문항을 열어 둔 탭의 저장이 까닭 없이 충돌로 튕긴다)
  - **OCR 병합에서 이 축만 합집합**이다([merge-fill.ts](src/lib/problem-ocr/merge-fill.ts) 의 `fillGaps`). 나머지는 '비어 있을 때만 채운다' 지만 문법 태그는 서로 배타적이지 않고, 겹쳐 읽은 묶음이 각각 다른 개념을 알아볼 수 있다 — 빈 칸 규칙을 그대로 쓰면 나중 묶음이 본 개념이 통째로 버려진다
  - **모델에게 받는 모양과 저장 모양이 다르다.** JSON 스키마는 **마디 배열의 배열**(`[['단어','품사','명사']]`)이다 — 마디를 하나씩 내야 트리와 대조할 수 있다. `parse.ts` 가 그것을 경로 문자열로 접으므로 **`OcrItem.grammar_paths` 는 `string[]`**(접은 뒤)이고 스키마 객체는 `string[][]` 다. 둘을 같게 맞추려다 되돌리지 말 것
  - **문법 문항이 아니어도 칸을 막지는 않는다.** `isGrammarArea` 는 **접어 둘지**만 정하고 '+ 문법 분류 추가' 로 늘 열 수 있다 — 닫아 걸면 영역을 아직 안 고른 문항은 영영 분류할 수 없다(검수에서 교과서를 고칠 수 있게 만든 것과 같은 근거). 펼침은 **렌더에서 파생**한다(`opened || suggested || value.length > 0`) — 효과로 setState 하면 `set-state-in-effect` 에 걸리고, 영역을 문법으로 바꾸는 순간 칸이 따라 열려야 한다
  - ⚠️ **문법 영역 이름은 운영 마스터를 직접 보고 맞춘다**(`GRAMMAR_AREA_NAMES`). ara-system 마이그 335 의 **시드에는 `중등 국어 > 문법` 이 있지만 운영 마스터는 다르다** — 2022 개정 교육과정으로 바뀌어 중등·고등이 `화법과 언어 > 언어` 이고 `문법` 대영역은 초등에만 남아 있다. 시드 파일만 보고 판정 목록을 짜면 **이미 올라와 있는 문법 문항 전부에서 칸이 안 열린다**(실제로 그렇게 배포됐다가 실데이터를 보고 고쳤다). 마스터는 ara-system 이 소유하고 따로 갱신되므로 `public.exam_area_nodes` 를 조회해 확인할 것
  - **문법 트리는 OCR 프롬프트에 늘 실린다**(2,180자 ≈ 전체 프롬프트의 37%). 출처가 문법 시험지인지는 읽기 **전에** 알 수 없고, 이미지 3장이 훨씬 크므로 감당할 값으로 봤다
  - ⚠️ **마이그레이션 번호는 21 이다.** 같은 날 `sql/20_problem_bank_works.sql`(작품 축)이 먼저 들어갔다 — 번호가 곧 신규 부트스트랩 적용 순서라 겹치면 안 된다. 새 파일을 만들기 전에 `ls sql/` 로 최대 번호를 **다시** 확인할 것

- [2026-09-09] **기출 문제 은행 4차 — 상세 창·경고 위치·작품 축**([sql/20_problem_bank_works.sql](sql/20_problem_bank_works.sql)). 되돌리지 말아야 할 판단들:
  - **경고의 `ref` → 행 id 변환은 병합(merge.ts)이 한다.** 파서는 id 를 모르고(id 는 병합이 만든다) 병합이 끝나면 `ref` 가 사라진다 — 그 사이의 `refToId` 가 유일한 접점이다. ⚠️ 변환은 그 묶음의 **지문·문항 두 루프를 마친 뒤**에 해야 한다. 예전 자리(루프 앞)에서 풀면 표가 비어 있어 모든 경고가 쪽 대상으로 떨어진다. 겹쳐 읽어 이미 담은 문항도 `refToId` 에 넣어야 두 번째 묶음의 경고가 길을 잃지 않는다
  - **버려진 항목의 경고에는 `ref` 를 싣지 않는다**(보내지 않은 쪽·중복 항목). 행이 안 생기므로 가리킬 카드가 없고, 억지로 살아남은 항목을 짚으면 엉뚱한 카드를 지목한다 — 쪽만 알린다
  - **경고 중복 판정은 메시지가 아니라 `warningKey`(메시지+대상)** 다. 메시지로만 거르면 '선지를 읽지 못했어요' 가 첫 문항에서만 남고 나머지 문항은 표시가 사라진다
  - 단계별 상한(`OCR_MAX_WARNINGS` 20)과 **최종 상한**(`OCR_MAX_MERGED_WARNINGS` 60)이 다르다. 경고가 항목마다 붙게 되어 20 이면 30문항 시험지에서 뒤쪽이 잘린다. 병합 뒤에 붙는 경고(정답표·크롭·그림 지문)는 각자 상한을 안 거치므로 **저장 직전 run.ts 에서 한 번** `capWarnings` 한다
  - `OcrMeta.warnings` 는 `(string | {message,targets})[]` 다. **문자열을 지우지 말 것** — 이미 저장된 출처의 경고가 전부 문자열이라 객체만 받으면 옛 출처의 경고가 화면에서 통째로 사라진다
  - **읽기 전용 렌더는 인쇄 스코프 `.pb-sheet` 를 재사용한다**(`.pb-sheet--screen` 은 글자 크기만 덮는다). `data-box` 선택자 목록이 이미 인쇄·편집기 두 벌이라 세 번째 사본을 만들면 어느 한 벌만 고쳐져 화면과 인쇄가 조용히 갈라진다. 반대로 `renderPaperBlocks` 재사용은 **안 된다** — 번호를 자리 순서로 다시 매기고(7번이 01 로 나온다) 머리글을 합성한다
  - **드래그 손잡이는 `onClick` 도 막아야 한다.** `useListDrag` 의 `preventDefault` 는 호환 mouse 이벤트만 막고, `setPointerCapture` 때문에 pointerup 대상이 손잡이라 **끌기를 끝낼 때마다** click 이 카드로 번져 상세 창이 열린다. 카드 열기는 `window.getSelection()` 이 비어 있을 때만 — 글자를 긁어 읽던 사람이 창에 갇히면 안 된다
  - **작품 축은 `problems.work_title` 하나다**(인덱스·`search_text` 가 이미 여기 있다). 지문 제목과의 동기화는 **DB 트리거**가 맡는다 — OCR 저장·검수 수정·직접 SQL 어느 길로 와도 규칙이 같아야 한다. 앱에서만 맞추면 경로마다 어긋난다
  - **작품명 채우기 트리거는 `aa_` 로 시작해야 한다**(`aa_fill_work_title_problems`). 트리거는 알파벳 순으로 도는데 `problems_search_text` 가 `work_title` 을 검색 평문에 넣으므로, 뒤에 두면 물려받은 작품명이 **검색에서 조용히 빠진다**(sql/17 의 `aa_enforce_user_id` 와 같은 규약)
  - **지문 제목 변경은 딸린 문항의 `updated_at` 을 올린다**(트리거 → `update_updated_at`). `useProblemReview.savePassage` 가 제목이 바뀐 경우에만 문항을 다시 읽고 `reloadSeq` 를 올린다 — `removePassage` 와 같은 이유다. 안 하면 그 문항의 다음 저장이 **아무도 안 고쳤는데 충돌**로 튕긴다. ⚠️ 카드 key 에 `updated_at` 을 섞어 "바뀐 카드만" 다시 마운트하는 안은 버렸다 — `toggleRenderMode` 가 `render_mode` 만 저장해도 그 카드가 다시 마운트돼 치던 발문이 사라진다
  - **되돌림 백필**(문항 작품명 → 지문 제목)은 sql/20 에 한 번만 있다. 옛 프롬프트가 title 을 설명하지 않아 운영 데이터의 지문 제목이 **전부 비어 있었다**(2026-09-09: 지문 12건 전부 `''`, 문항 9건이 '동백꽃'). 안 하면 작품 트리가 '지은이 미입력' 한 폴더가 되고 묶음 머리가 '제목 없는 지문' 이 된다. **문항들이 한 작품으로 일치할 때만** 올린다 — (가)(나) 지문에서 하나를 고르면 거짓이 된다
  - **작품명 정규화는 앱 `normalizeWorkTitle` ↔ DB `exam.normalize_work_title` 1:1 거울**이다(`category-name.ts` ↔ sql/16 과 같은 계약). 감싸는 기호(「」『』〈〉""'')만 **양끝에서** 벗긴다 — 안쪽 기호는 '봄봄 · 「동백꽃」' 처럼 뜻이 있다. ⚠️ OCR 저장(`save.ts`)은 모델 값을 그대로 넣으므로 **파서 단계 정규화가 필수**다
  - **세 트리는 서로의 축을 비운다**(교과서·학교 기출·작품). 남기면 '상현중 기출 ∩ 동백꽃' 이 조용히 0건이 되는데 화면에 이유가 없다(학교마다 실리는 작품이 다르다). 작품명은 자유 텍스트라 `UNSPECIFIED_AXIS` 를 쓰지 않는다
  - **작품으로 볼 때만 목록을 지문별로 묶는다.** 그때만 정렬도 `source_id → passage_id → page_no → number` 로 바뀐다. ⚠️ 남은 한계: 한 쪽이 60개라 문항이 많은 지문은 두 쪽에 걸쳐 머리가 두 번 나온다
  - **이미지로 출제하는 문항은 상세 창에서도 이미지가 본문이다.** 글만 보여 주면 그림이
    통째로 빠진 문항을 보고 문제지에 담게 된다(프롬프트가 "옮길 수 있는 글자만" 적게 했다)
  - **'지문을 못 읽었다' 와 '지문이 없다' 를 가른다**(`passageId` 는 있는데 `passage` 가 null).
    못 읽은 것을 '지문 없는 문항' 이라고 적으면 거짓말이 된다(코덱스 리뷰 4R)
  - ⚠️ **남은 한계**: 작품명 저장 뒤 문항을 다시 읽는 **한 왕복 동안** 그 지문의 문항 카드를
    계속 칠 수 있고, 그때 친 내용은 사라진다. 지문 삭제·교과서 변경과 같은 성질의 창이라
    같은 수준으로 두었다(카드를 걷어 내는 처리는 조회 실패 때 오히려 입력을 잃게 만들어 되돌렸다)
  - ⚠️ **(가)(나) 복합 지문은 작품명 하나로 묶인다.** 프롬프트가 ' · ' 로 이어 적게 하지만 트리에서는 한 작품처럼 보인다. 문항별로 다른 작품을 적어 두면 트리거가 보존한다

- [2026-09-08] **기출 문제 은행 3차 — 선택 삭제·학교 기출 트리·별도 답지**([sql/19_problem_bank_answer_key.sql](sql/19_problem_bank_answer_key.sql)). 되돌리지 말아야 할 판단들:
  - **선택 삭제는 Storage 를 건드리지 않는다.** `removeProblemFiles` 를 부르고 싶어지지만, 이미 만든 문제지가 `render_mode:'image'` 항목의 `image_path` 를 스냅샷에 들고 있어 파일을 지우면 **인쇄물에서 그 문항만 빈칸**이 된다([problem-paper/blocks.ts](src/lib/problem-paper/blocks.ts)). 단건 삭제도 같은 이유로 파일을 남긴다 — 고아 파일은 감수한 값이다
  - **선택은 "지금 보이는 행"과 늘 교집합을 낸다**([selection.ts](src/lib/problem-bank/selection.ts)). 아카이브는 60개씩 쪽을 나누므로 선택한 채 쪽을 넘기면 화면에 없는 id 가 남는다. 효과로 비우면 `set-state-in-effect` 에 걸리므로 **렌더에서 파생**하고, 조건을 바꾸는 길(트리·필터바·페이저)은 전부 페이지의 `patch` 래퍼를 지나 선택을 비운다
  - **두 트리는 서로의 축을 비운다.** 교과서 단원 트리와 학교 기출 트리는 탭으로 갈린 **대안 경로**다. 조건을 남기면 '상현중 기출 ∩ 천재 3단원' 이 조용히 0건이 되는데 화면에 이유가 없다(학교마다 교과서가 다르다). 일부러 겹치려면 위쪽 필터 줄에서 고른다
  - **학교 기출 트리는 패싯으로 만든다** — `public.schools` 마스터를 그리면 문항이 하나도 없는 학교가 잔뜩 나온다(영역 필터와 같은 규약). 노드 키는 `JSON.stringify` 로 만든다: 학교 이름은 자유 텍스트라 `'|'` 구분자를 쓰면 이름에 그 글자가 든 순간 키가 섞인다
  - **별도 답지는 `sources/{id}/answer-key/` 에 둔다.** `pages/{n}.jpg` 와 같은 자리에 넣으면 답지 3장이 원본 1~3쪽을 덮어써 **검수 화면의 원본 대조가 통째로 망가진다**. 같은 이유로 답지 쪽을 `ocr_meta.pages` 에 넣지 않는다(그 배열이 검수 화면의 쪽 탭이다)
  - **답지 사진은 늘 다시 인코딩한다**([imageToJpeg.ts](src/lib/pdf/imageToJpeg.ts)). 버킷이 `application/pdf`·`image/jpeg` 만 받아 PNG 는 그대로 올리면 거부되고, 휴대폰 사진은 4000px·5MB 라 예산을 넘으며, `<img>` 로 그려야 EXIF 회전이 반영된다(누운 정답표는 모델이 못 읽는다). Storage 로 갈 Blob 은 반드시 `canvas.toBlob` — data URL → `fetch()` 는 CSP `connect-src` 가 막는다
  - **PDF 안 정답표와 별도 답지는 묶음을 섞지 않는다**([run-answer-key.ts](src/lib/problem-ocr/run-answer-key.ts)). 서로 다른 문서라 섞으면 "보낸 이미지는 N쪽" 안내가 거짓이 되고, 순서가 곧 번호인 정답표에서 순서가 엉킨다. 답지 PDF 는 문서를 한 번 더 여므로 `finally` 에서 반드시 `destroy` 한다
  - `insertSource` 는 **답지가 있을 때만** `answer_key_paths` 를 보낸다. 늘 보내면 마이그레이션이 늦은 순간 답지 없는 업로드까지 PGRST204 로 죽는다
  - **필터에서 `''` 는 '전체'라 '미지정만'을 따로 표시해야 한다**(`UNSPECIFIED_AXIS = '__none__'`, [filters.ts](src/lib/problem-bank/filters.ts)). 빈 값을 그대로 실으면 학교 기출 트리의 '미지정' 잎이 **그 축 전체**를 불러온다(코덱스 리뷰 2R). 그래서 `toProblemQuery` 는 빈 값을 **빼고** 센티널만 `''` 조건으로 바꾸며, `queries.ts` 는 참거짓이 아니라 **`!== undefined`** 로 조건 유무를 가른다 — 되돌리면 '미지정만' 이 조용히 사라진다. 셀렉트에도 같은 값의 '미지정' 칸이 있어야 화면과 조건이 어긋나지 않는다
  - ⚠️ **남겨 둔 한계**: 삭제 요청이 도는 동안 아카이브를 떠났다가 **돌아와서** 그 목록 조회가 DELETE 커밋보다 먼저 끝나면, 새 화면에 지운 문항이 잠깐 남는다. 옛 화면은 이미 언마운트돼 새 화면에 알릴 길이 없다. 고치려면 컴포넌트 수명 밖의 무효화 통로(모듈 수준 버스)가 필요한데, 데이터는 멀쩡하고 다음 조회에서 저절로 사라지는 표시 문제라 그 복잡도를 들이지 않았다(코덱스 리뷰 4R)
  - **필터 칸은 조건이 걸려 있으면 반드시 보이고, 걸린 값은 반드시 선택지에 있어야 한다**([ProblemFilterBar.tsx](src/components/problem-bank/ProblemFilterBar.tsx) 의 `showAxis`·`withValue`). 패싯은 **문항이 실제로 있는 값**만 모으므로, 선택지 유무로만 칸을 보이면 트리에서 고른 조건이 화면에서 사라지고(끌 수도 없다), 값이 목록에 없으면 셀렉트가 '전체'인 것처럼 비어 보인다(코덱스 리뷰 3R·4R)
  - **`aliveRef` 는 정리에서 false 로 두는 것만으로 부족하다** — 효과 본문에서 **true 로 되돌려야** 한다. StrictMode 는 마운트 → 언마운트 → 재마운트라, 안 되돌리면 재마운트 뒤 그 화면의 기능이 **조용히 통째로 죽는다**(선택 삭제가 확인창조차 안 뜨는 상태로 발견됨, 코덱스 리뷰 3R)
  - **지울 대상의 세대(`targetSeq`)는 조건·쪽·선택 **셋 다**에서 올린다.** 확인창 앞에 문제지 수를 묻는 왕복이 있어 그 틈에 체크를 바꾸면 확인창의 개수와 실제로 지울 문항이 어긋난다. 삭제 **뒤**의 쪽 보정에도 같은 검사가 필요하다 — 지우는 사이 필터가 바뀌면 옛 쪽 번호를 새 조건에 얹어 빈 목록을 띄운다(코덱스 리뷰 2R)
  - ⚠️ `updateSource` 는 `ocr_meta` 를 **통째로 덮어쓴다**. `answerKeyFiles` 를 성공·실패 두 분기 모두에 넣어야 검수 화면이 "답지를 안 올렸다"고 거짓말하지 않는다

- [2026-09-08] **기출 문제 은행 2차 — 학교 마스터·교과서 단원·서식**([sql/18_problem_bank_units.sql](sql/18_problem_bank_units.sql)). 되돌리지 말아야 할 판단들:
  - **학교급(중등/고등)은 저장하지 않는다.** 업로드 폼에서 학교·학년 선택지를 좁히는 데만 쓰고 DB 에서는 `grade`('중2') 접두사로 되찾는다(`levelFromGrade`). ara-system 마이그 420 과 같은 근거 — 저장하면 '중1인데 고등' 같은 어긋난 행을 CHECK 로 또 막아야 한다
  - 학교의 원본은 **관리자시스템 `public.schools`** 다(중등 15·고등 5, mig375 로 authenticated SELECT 열려 있다). 이 앱의 `exam.schools` 는 외부지문·프린트용 이름 마스터라 기출과 무관하다 — **두 표를 헷갈리지 말 것**. `problem_sources.school_id` 는 **FK 가 아니다**(학교가 지워져도 기출은 남아야 한다). 표시·필터·문제지 스냅샷은 계속 `school_name` 을 쓴다
  - **교과서 단원의 정본은 이 앱의 카테고리 관리**(`exam.publishers › major_chapters › sub_chapters`)다. 관리자시스템의 '교과서' 탭(`public.curriculum_textbooks`)은 그것을 매일 밤 복사한 사본이라 정본이 아니다(운영 데이터의 47권이 전부 `source_app='ara-exam'`)
  - `unit_path` 는 `area_path` 와 같은 **이름 경로 스냅샷**이다(최대 2단, 마스터 id 가 아니다). 마스터 전개 카테고리는 실제 UUID 가 없고(`master-major-…` 합성 id), 개념지도 텍스트 복사 방식이라 같은 규약을 따른다. ⚠️ **남은 빈 구멍**: 카테고리 관리에서 단원 이름을 바꾸면 이미 태깅된 `unit_path` 는 따라가지 않는다. 필요해지면 `sync_major_chapter_name`/`sync_sub_chapter_name` 트리거를 `problems.unit_path[1]`/`[2]` 까지 넓히는 것이 정공법이다
  - (2026-09-08 3차 보정) 아카이브 필터에 **학기 축이 생겼다**(`ProblemFilters.semester`, 주소 `sem`). 학교 기출 트리가 쓴다 — 다만 교과서 단원 트리는 여전히 학기를 걸지 않는다(저장되는 것이 단원 **이름**이라 두 학기에 같은 이름이 등록돼 있으면 결과가 같은 편이 맞다)
  - **구역 상자는 `data-box` 하나로 간다.** 값의 종류가 곧 인쇄 모양이다(보기·자료·조건 → 〈보기〉 테두리, 가~마 → (가) 머리글, A~E → [A] 세로선). 괄호는 CSS 가 붙이므로 값에는 넣지 않는다. 허용 목록([src/lib/box-labels.ts](src/lib/box-labels.ts))을 넓히면 **인쇄·편집기 CSS 선택자 목록도 같이** 넓혀야 한다(값별로 나열한다 — `attr()` 로 종류를 가를 수 없다)
  - **`data-box` 값 정규화는 정화보다 먼저**다. 정화 훅은 허용 밖 값을 `keepAttr=false` 로 지워 되돌릴 수 없다 — 실제로 첫 OCR 에서 모델이 낸 `data-box="(가)"` 가 통째로 사라져 (가)(나) 지문 구분이 없어졌다. `normalizeBoxAttributes` 를 파서에서 `sanitizeProblemHTML` **앞에** 부른다
  - **배점은 읽지도 보여 주지도 않는다.** OCR 스키마·프롬프트·정답표에서 뺐고 화면·인쇄에서도 지웠다. 단 `problems.score` 컬럼과 `PaperSettings.showScore` 키는 **남긴다** — RPC 가 저장할 때마다 그 키를 화이트리스트로 다시 조립하고 이미 만든 문제지에 값이 들어 있다. 문제지 머리의 '점수란'(`ExamPrintHeader showScoreRow`)은 배점이 아니라 채점자가 쓰는 칸이라 그대로 둔다
  - **TipTap 3.x 두 가지**: ① `@tiptap/react` 는 `shouldRerenderOnTransaction` 이 기본 false 라 툴바에서 `editor.isActive()`·`getAttributes()` 를 직접 읽으면 커서를 옮겨도 갱신되지 않는다 → `useEditorState` 로 구독한다. ② StarterKit 3.x 는 `underline`·`hardBreak`·`horizontalRule`·`trailingNode` 를 이미 포함하므로 `@tiptap/extension-underline` 을 따로 등록하면 확장이 두 벌이 된다
  - **교과서를 바꾸면 이미 붙은 단원 태그는 지운다**(검수 화면에서 물어보고, `exam.set_source_textbook` RPC 가 **한 트랜잭션**으로 처리한다 — UPDATE 세 번으로 나누면 중간 실패 때 '태그만 사라지고 교과서는 그대로' 가 되어 손으로 붙인 분류를 잃는다. **지울지 말지는 DB 가 판단한다**: 앱이 미리 센 개수로 정하면 그 사이 다른 탭이 붙인 태그가 새 교과서 아래 남는다). 바꾼 뒤에는 본문을 다시 읽고 카드도 다시 마운트한다(카드가 단원·발문을 지역 state 로 들고 있어 옛 값이 되살아난다). 남겨 두면 아카이브가 '새 교과서 + 옛 단원' 으로 묶여 아무도 못 찾는다. 아카이브 트리에서 **학기는 필터 축이 아니다** — 저장하는 값이 단원 이름이라 1·2학기에 같은 이름이 등록된 교과서(운영 데이터 2건)는 두 폴더가 같은 결과를 낸다
  - **원문의 빈 줄은 빈 문단 `<p></p>`** 로 담고 인쇄 CSS 가 `p:empty::before` 로 한 줄 높이를 준다. `:empty` 는 공백 한 칸만 있어도 안 맞으므로 모양 통일은 파서(`normalizeBlankParagraphs`)가 한다. 반대로 `trailingNode` 가 표·상자 뒤에 **자동으로** 붙이는 빈 문단은 인쇄에서 걷어낸다(`html-trim.ts`) — 가운데 빈 줄은 원문이므로 남긴다
- [2026-09-08] **기출 문제 은행 도입**([sql/17_problem_bank.sql](sql/17_problem_bank.sql)). 표 5개(`problem_sources`/`passages`/`problems`/`problem_papers`/`problem_paper_items`)와 RPC `exam.create_problem_paper`. 굵직한 결정들:
  - **DB 헬퍼는 `public` 이 아니라 `exam` 스키마에 있다**(ara-system mig254 가 만들었다) — `exam.is_allowed_domain()`, `exam.enforce_user_id_from_auth()`, `exam.update_updated_at()`, `exam.audit_log`. sql/01~14 의 `public.is_allowed_domain()` 표기는 **옛 standalone 프로젝트 기준이라 지금은 틀리다**. 새 마이그레이션은 `exam.` 헬퍼를 쓰고 guard 블록에서 존재를 확인한다
  - 아카이브 3표는 `concept_sheets` 처럼 **공유 FOR ALL**(선생님들이 함께 검수한다). 문제지는 `exams` 처럼 **SELECT/DELETE 만 + RPC 한 곳**으로 잠갔다 — 본문이 스냅샷이라 직접 INSERT 를 허용하면 위조가 된다
  - **`passages`·`problems` 의 INSERT 는 감사하지 않는다.** OCR 한 번이 수백 행이라 본문 HTML 째로 `audit_log` 에 복사하면 표가 폭발한다. "언제 누가 무엇을 읽었나"는 `problem_sources.ocr_meta` + 그 행의 UPDATE 감사로 남는다. 사람이 하는 수정·삭제는 전부 감사한다
  - **`UNIQUE(source_id, number)` 를 두지 않았다.** 문제집·프린트는 절마다 번호가 1부터 다시 시작하고, PostgREST 일괄 INSERT 는 원자적이라 중복 하나에 OCR 결과 전체가 실패한다. 중복 정리는 클라이언트 병합이 맡는다
  - Storage 버킷 `exam-problem-bank`(비공개). **UPDATE 정책을 일부러 만들지 않았다** — 있으면 클라이언트가 `upsert:true` 로 되돌아가도 통과해 버리는데, 그 조합은 ara-system `exam-papers` 버킷을 1년 가까이 조용히 죽여 놨던 형태다. 바꿔 올릴 땐 지우고 새로 올린다(`replaceProblemFile`)
- [2026-09-10] **맥 지원 — 설치는 터미널 한 줄, 실행은 LaunchAgent**. 되돌리지 말아야 할 판단들:
  - **Safari 로는 못 쓴다.** WebKit 은 https 문서의 `ws://127.0.0.1` 을 mixed content 로 **동기 차단**한다(실측: 프로덕션 페이지에서 0ms onerror, 같은 문서의 `wss://` 는 차단 지점을 통과, 같은 주소가 http 문서에서는 열림). 127.0.0.1 을 예외로 두는 것은 **Chromium 뿐**이라, [codex/README.md](src/lib/ai/codex/README.md)·[localNetworkAccess.ts](src/lib/ai/localNetworkAccess.ts) 의 "mixed content 가 아니다" 주석은 Chrome 기준으로 읽어야 한다. 권한도 브릿지 실행도 이걸 풀지 못하므로 `hintKind` 가 **다른 어떤 판정보다 먼저** `browser_unsupported` 를 낸다 — 순서를 내리면 이미 브릿지를 켠 선생님에게 "브릿지를 켜세요" 가 나가 원인을 영영 못 찾는다
  - **선생님이 터미널에 붙여넣는 것은 한 줄뿐이다.** 그 스크립트가 codex 설치(`npm install -g --prefix ~/.ara-ai/npm` — 전역은 root 소유라 sudo 가 필요해서 홈에 깐다)와 `codex login` 까지 한다. ⚠️ 그래서 **맥에는 `codex login` 을 치라고 안내하면 안 된다** — 선생님 셸 PATH 에 `codex` 가 없어 command not found 다. 맥의 복구 경로는 언제나 **설치 명령 재실행**이다
  - **설치 스크립트(`install-mac.sh`)도 ara-system 이 호스팅한다.** 브릿지와 같은 이유다 — 선생님 PC 에 한 벌만 깔리고, 여기서 다시 배포하면 포트 8899 를 두고 프로세스가 다툰다. 이 앱은 [macInstaller.ts](src/lib/ai/macInstaller.ts) 로 **명령 문자열만** 만든다
  - **OS 자동 감지는 어느 탭을 먼저 펼칠지만 정한다** — 탭을 없애지 말 것. 선생님이 다른 선생님 컴퓨터에 깔아 주려고 이 화면을 여는 경우가 실제로 있다
  - 맥 안내에서 **'다시 내려받기'·'바탕화면 아이콘' 어휘를 쓰지 말 것**. 맥은 받는 파일이 없고 배경에서 도는지라 찾을 수 없는 물건을 찾게 만든다. [ConnectionHint.test.tsx](src/components/ai/ConnectionHint.test.tsx) 가 고정한다
- [2026-09-08] **AI 는 서버가 아니라 선생님 PC 에서 돈다**(ara-system 의 코덱스 브릿지를 이식). 학원 서버는 `AI_OCR_BETA` 플래그만 판정하고 `/api/ai/status` 로 알려 줄 뿐 AI 를 호출하지 않는다 — 그래서 토큰 비용이 0 이고 `auth.json` 이 선생님 PC 를 벗어나지 않는다. 대신 **컴퓨터마다 설치가 필요**하고 브릿지가 안 떠 있으면 못 쓴다. 자세한 프로토콜 함정은 [src/lib/ai/codex/README.md](src/lib/ai/codex/README.md)
  - **브릿지는 두 앱이 한 벌을 공유한다.** 원본은 ara-system `public/ara-ai/bridge.cjs` 이고 거기 `ALLOWED_ORIGINS` 에 이 앱 주소가 들어 있어야 한다(v2 부터). 여기서 파일을 다시 호스팅하면 포트 8899 를 두고 프로세스 둘이 다툰다
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

- [2026-09-04] **(아래 2026-09-03 항목을 뒤집음) 개념지 단 수는 다시 글자 수만 본다.** 열 폭 맞춤(0.1.14)이 넓은 표를 2단 칸에 맞춰 주므로 1단 강제의 근거가 사라졌고, 사용자가 페이지 수를 우선했다("2단이어야 A4 용지가 줄어"). **예외: 래퍼(`blockquote`/`li`) 안의 표는 맞춤도 분할도 못 하므로**(`rootTable` 가드) 그런 넓은 표(3열 이상)가 있을 때만 1단으로 되돌린다(`maxWrappedTableColumns` — 루트 표는 세지 않는다). 코덱스가 잡은 회귀다. 열이 아주 많은 루트 표(7열 이상)가 2단 칸에서 읽기 어려우면 같은 함수에 루트 표 열 수 조건을 다시 넣으면 된다
- [2026-09-03] **(2026-09-04 에 뒤집음) 개념지 단 수를 '글자 수'에서 '글자 수 + 표 열 수'로 바꿨다**([src/lib/print/sheet-columns.ts](src/lib/print/sheet-columns.ts)). 300자 초과면 무조건 2단이었는데, 표가 있는 개념지는 거의 항상 300자를 넘어 **열 3~5개짜리 표가 폭 ≈328px 칸에 밀려 들어가** 잘렸다. 이제 `maxTableColumns` 가 3 이상이면 시트 전체를 1단(≈680px)으로 되돌린다. **혼합 폭(본문 2단 + 표만 전체 폭)은 일부러 안 했다** — 5종 문서가 공용하는 인쇄 엔진(`paginate`/`A4Document`)에 블록별 폭 개념을 새로 넣어야 해서 범위·위험 대비 이득이 작다. 단 수는 저장하지 않는 파생값이라 표를 지우면 자동으로 2단으로 돌아온다

## Gotchas
- [2026-09-08] **`isomorphic-dompurify` 는 인스턴스가 하나뿐이라 `addHook` 이 전역이다.** 문항용 정화를 별도 모듈에서 훅으로 추가하면 개념지 정화에도 그 훅이 발화한다. 그래서 훅은 [sanitize-profile.ts](src/lib/sanitize-profile.ts) 에 **한 번만** 걸고 문서 종류별 차이는 활성 프로필로 바꾼다(`withProfile`). 프로필은 `finally` 로 반드시 되돌린다 — 예외가 나도 다음 호출이 남의 규칙을 물려받으면 안 된다. 새 정화 프로필을 추가할 땐 여기에 얹을 것
- [2026-09-08] **OCR 묶음은 3쪽·겹침 1이다**([problem-ocr/constants.ts](src/lib/problem-ocr/constants.ts)). 정답표 읽기의 5쪽보다 잘게 자른 이유는 국어 지문 전사가 **출력 토큰**을 훨씬 많이 쓰기 때문이고(지연을 지배하는 건 이미지 장수가 아니다), 겹치는 이유는 **쪽 경계를 넘는 지문**이다 — 겹치지 않으면 어느 묶음도 그 지문을 통째로 못 봐서 반씩 잘린 지문 두 개가 남는다. 겹침을 0으로 되돌리지 말 것
- [2026-09-08] **병합 규칙이 지문과 문항에서 다르다**([merge.ts](src/lib/problem-ocr/merge.ts)). 지문은 **더 완전한(글이 긴) 쪽이 이기고**, 문항은 **먼저 온 쪽이 이기되 빈 칸만 나중 것이 채운다**. 지문에 first-wins 를 쓰면 겹침의 목적(잘린 지문을 온전히 본 묶음의 결과)이 사라진다. ⚠️ **정답(answer)과 유형(question_type)은 한 덩어리로** 옮긴다 — 유형이 바뀌면 `'1'` 이 선지 번호인지 답안 문자열인지가 달라진다
- [2026-09-08] **좌표는 x/y/w/h 로 받지 않는다.** 시각 모델의 가로 좌표는 부정확하고 국어 시험지는 거의 2단 조판이라, `{column, top, bottom}`(단 번호 + 세로 비율)만 받아 단 폭 전체를 여유 있게 잘라낸다([crop.ts](src/lib/problem-ocr/crop.ts)). 네 숫자로 되돌리면 크롭이 글자를 자른다
- [2026-09-08] **문제지의 지문 묶음 연속성은 앱과 DB 가 따로 검사한다.** 같은 지문의 문항이 흩어지면 인쇄에서 지문이 여러 번 나오고 머리글 범위가 거짓말을 한다. 앱만 검사하면 RPC 직접 호출로 뚫리고, DB 만 검사하면 사람이 어디를 고쳐야 할지 모른다. `isContiguous`([compose.ts](src/lib/problem-paper/compose.ts))와 RPC 의 gaps-and-islands 검사를 **같이** 유지할 것
- [2026-09-08] **문제지 인쇄에서 지문은 문단 단위 블록으로 쪼갠다**([problem-paper/blocks.ts](src/lib/problem-paper/blocks.ts)). 인쇄 엔진의 블록은 쪼갤 수 없는 최소 단위라, 지문을 통째로 넣으면 한 쪽을 넘는 순간 `transform: scale()` 로 깨알같이 줄어든다. 상자 윤곽은 조각마다 좌우를 그리고 위·아래는 첫·마지막 조각만 그려서(`pb-passage-part--first/--last`) 단·쪽이 갈려도 하나로 보이게 한다
- [2026-09-08] **`pdfjs-dist` 는 `wasmUrl: '/pdfjs-wasm/'` 없이는 스캔본을 백지로 렌더한다**(JBIG2 디코딩). 자산은 `predev`/`prebuild` 훅([scripts/copy-pdfjs-wasm.js](scripts/copy-pdfjs-wasm.js))이 `node_modules` 에서 복사하고 git 에는 넣지 않는다. 끝 슬래시 필수
  - ⚠️ **파일만 있어서는 안 되고 CSP 도 열려 있어야 한다.** 프로덕션 `script-src` 에 `'wasm-unsafe-eval'` 이 없으면 워커의 `WebAssembly.instantiate` 가 막혀 **프로덕션에서만** 스캔본이 백지가 된다(개발 모드의 `'unsafe-eval'` 은 wasm 도 허용해서 드러나지 않는다). 이 권한은 wasm 컴파일만 열고 JS eval 은 열지 않는다 — [next.config.ts](next.config.ts)
- [2026-09-08] **'이미지로 출제' 에는 자동으로 못 푸는 한계가 둘 있다.** 자동으로 고를 수 없으니 **경고로 드러내고 사람이 정한다** — 조용히 한쪽을 고르면 인쇄물에서만 내용이 사라진다
  - 잘라 둔 이미지에는 **원본 시험지의 문항 번호가 그대로 찍혀 있다**(그래야 선지까지 안 잘린다). 문제지에서 자리가 바뀌면 이미지의 '17' 과 우리가 찍는 '01' 이 함께 보인다. `renumberedImageItems` 가 그런 문항을 찾아 문제지 화면에서 알린다
  - **여러 쪽에 걸친 그림 지문은 어느 쪽으로도 온전하지 않다** — 글만 쓰면 그림이 빠지고, 이미지로 쓰면 잘라 둔 시작 쪽만 나가 뒷부분이 사라진다. 그래서 자동 제안은 한 쪽짜리(`pageSpan === 1`)에만 하고 나머지는 검수 경고로 남긴다
- [2026-09-08] **CSP `connect-src` 에 `ws://127.0.0.1:*` 이 있어야 브릿지에 붙는다**([next.config.ts](next.config.ts)). ara-system 은 CSP 가 아예 없어 겪지 않은 문제다. 127.0.0.1 은 potentially trustworthy 라 https 문서에서도 mixed content 가 아니고 `upgrade-insecure-requests` 도 loopback 은 면제하지만, **프로덕션 배포 후 DevTools 로 한 번 확인할 것** — 만약 wss 로 올라가면 핸드셰이크가 조용히 실패한다
- [2026-09-08] **`react-hooks/set-state-in-effect` 가 이 저장소에서는 에러다.** 효과 안에서 동기 setState 를 하면 lint 가 막는다. 쓰던 패턴의 대안: ① 로딩 플래그 → "무엇을 이미 불러왔는가"(`loadedKey`)를 기억하고 로딩을 파생, ② prop 이 바뀌면 폼 초기화 → 호출부에서 `key` 로 다시 마운트, ③ 유효하지 않은 선택값 되돌리기 → 렌더 단계에서 파생, ④ 비동기 조회 → `.then()` 안에서만 setState
- [2026-09-04] **표 열 폭은 인쇄 직전에 JS 가 정한다 — CSS 만으로는 표현할 수 없다.** `overflow-wrap: anywhere`(아래 2026-09-03 항목) 는 셀 min-content 를 한 글자로 무너뜨려, 자동 레이아웃이 긴 글 열에 폭을 몰아주고 2~3글자 열을 한 글자 폭으로 누른다. 그래서 [table-col-fit.ts](src/lib/print/table-col-fit.ts) 가 열 폭을 나눠 퍼센트 `<colgroup>` + `table-layout: fixed` 로 박는다. **되돌리면 안 되는 것들**
  - **프로브는 `width: max-content` 래퍼 + 표 `width: auto` 둘 다 필요하다** ([table-measure.ts](src/lib/print/table-measure.ts) 의 `measureMaxContentWidths`). 래퍼가 없으면 절대배치 shrink-to-fit 이 컨테이너 폭에 걸려 **접힌 폭**을 재고, 표의 `width` 를 안 되돌리면 이미 박힌 `fixed` + 100% 를 그대로 읽는다. 측정 컨테이너(`.a4-measure`)는 `visibility: hidden` 이라 레이아웃이 살아 있어 여기서 재는 게 맞다 — 시트와 같은 타이포그래피 스코프(`.eb-sheet-table .sheet-body`)여야 폭이 맞으므로 프로브도 `SHEET_BODY_CLASS` 를 쓴다
  - **실측 폭에 여유(`COLUMN_SLACK_PX` 2px)를 반드시 얹는다.** max-content 에 딱 맞게 주면 퍼센트 환산·`border-collapse` 겹침에서 1픽셀 미만이 깎여 **마지막 글자가 접힌다**. WebKit 렌더로 확인한 실제 회귀다(`구분` → `구/분`)
  - **긴 열 하한은 `min(96px, 칸 폭 × 1/5)`** (`longColumnFloor`) 이고, 짧은 열 보호가 그 하한을 못 지키면 **가장 넓은 보호 열부터 푼다**. 안 그러면 짧은 열이 폭을 다 먹고 긴 열이 실처럼 좁아진다. **하한을 절대값 96 으로 두지 말 것** — 2단 칸(≈328px)에서 긴 열이 둘만 돼도 실현이 안 되어 보호를 전부 풀고 비례로 떨어져 짧은 열이 다시 한 글자로 눌린다(`45/45/45/300/400` → `18/18/18/…`). **균등 몫(칸 폭/열 수)까지 올리지도 말 것** — 보호가 실패한 표에서 하한이 폭을 다 먹어 긴 열이 짧은 열과 같은 폭이 된다(2단계 박스 4열 `46/46/62/174` → `82×4`). 둘 다 WebKit 렌더 비교로 잡은 회귀다
  - **폰트 로딩 전에 맞췄으면 폰트가 온 뒤 한 번 더 맞춘다**(`useConceptSheetBlocks` 의 `fitRef`). 폴백 폰트가 좁으면 보호한 열이 실제 폰트에서 접힌다. 같은 본문을 폰트 적용 후 맞췄으면 다시 하지 않는다 — 이것이 재맞춤 루프의 종료 조건이다
  - 맞춤은 **분할 전 원본 블록에서 다시 시작**한다. 폭이 바뀌면 행 높이가 달라져 옛 조각은 못 쓴다
- [2026-09-04] **`paginate` 는 '남은 자리에 안 들어감'과 '한 장에도 안 들어감'을 다르게 다룬다.** 전자는 `splitRequests`(쪼개서 남은 자리를 채우라), 후자는 `oversized`(축소해서 담으라)다. 한 블록이 둘 다일 수 있다. 요청을 남긴 뒤에도 **배치는 예전 로직 그대로 계속**해야 한다 — 호출부가 안 쪼개도 레이아웃은 유효해야 하기 때문이다. 훅은 **첫 요청 하나만** 반영한다(앞 표를 쪼개면 뒤 표의 남은 자리가 달라진다). 조각을 붙일 때 `tableRowCount` 로 측정과 상태가 같은 블록인지 확인한다 — 어긋난 요청을 그대로 쓰면 엉뚱한 표가 쪼개진다
- [2026-09-03] **개념지 표는 '가로는 CSS, 세로는 분할기'가 각각 책임진다 — 한쪽만 고치면 증상이 남는다.** 가로: 자동 표 레이아웃에서 표 폭의 하한은 셀 min-content 합이라 `width:100%` 로는 못 줄인다. 셀에 **`overflow-wrap: anywhere`**(`break-word` 는 min-content 계산에 반영되지 않아 효과 없다)를 주고, 1·2단계 박스 묶음 래퍼([src/lib/exam-transform.ts](src/lib/exam-transform.ts) 의 `BLANK_RUN_CLASS`)의 `white-space: nowrap` 을 **표 셀 안에서만** `normal` 로 푼다(본문 `<p>` 에서는 한 단어의 박스가 갈리면 안 되므로 nowrap 유지). 인접 inline-block 박스 사이 줄바꿈은 nowrap 만 풀면 브라우저가 알아서 준다 — `<wbr>`/ZWSP 를 넣지 말 것(`textContent` 가 오염돼 제목 행 판정이 틀어진다). 세로: 넘치면 `.a4-sheet__body { overflow: hidden }` 이 **조용히 잘라낸다** — 인쇄물에서만 보이는 증상이라 화면만 보고 판단하지 말 것
- [2026-09-03] **`splitTableByRows` 의 `hasRowSpan` 전체 포기(bail-out)를 되살리지 말 것.** 예전엔 rowspan 셀이 하나라도 있으면 표를 안 쪼개고 `transform: scale` 로 축소해 깨알 표가 됐다(편집기에 '셀 병합'이 있어 흔한 표다). 지금은 [src/lib/print/table-row-plan.ts](src/lib/print/table-row-plan.ts) 의 `legalCutFlags` 가 **'이 행 앞에서 잘라도 되는가'** 를 계산해 병합 묶음 경계에서만 자른다 — 비합법 지점에서 끊으면 다음 조각에 병합 셀이 없어 **나머지 셀이 앞 열로 밀린다**. 묶음 하나가 용량보다 크면 그 조각만 용량을 넘겨 내보내고 엔진이 축소한다
- [2026-09-03] **조각 표의 제목 행 판정은 규칙이 세 겹이고, 코덱스 리뷰 4라운드로 다듬은 것이다 — 단순화하려다 되돌리지 말 것.** [split-html-blocks.ts](src/lib/print/split-html-blocks.ts) 의 `detectHeaderRows`.
  - **(1) 명시 제목 vs 추측**: `<th>` 전체거나 `<thead>` 안이면 작성자가 명시한 제목(`isExplicitHeaderRow`)이고, '비지 않은 셀이 전부 `<strong>`' 은 추측이다. 편집기가 `withHeaderRow: false` 로 표를 넣어 제목이 보통 `<td><strong>` 이라 추측이 꼭 필요하다. **다음 행으로 이어 가는 것은 명시 제목일 때만** — 이 규칙 하나가 (a) 굵은 데이터 행이 제목으로 승격되는 것과 (b) 제목 셀이 rowspan 으로 뻗은 첫 데이터 행이 제목 묶음에 끌려오는 것을 동시에 막는다. 이어가기를 무조건 허용하면 실측으로 `["구분뜻/가/나2", "구분뜻/가/다3", …]` 처럼 **데이터 행이 매 페이지 반복**된다
  - **(2) 합법 지점으로 후퇴**: 제목 묶음의 끝은 합법 절단점이어야 반복할 수 있다. 그래서 합법 지점으로 끝나는 마지막 후보만 `best` 로 확정하고, 더 가져가려다 실패하면 거기로 후퇴한다. `legalCut[count] ? count : 0` 처럼 **마지막 count 하나만 보면 앞서 확보한 합법 제목까지 통째로 버린다**(2행 th 제목의 둘째 행이 본문까지 뻗을 때 제목이 0 이 됐다)
  - **(3) 빈 텍스트 ≠ 빈 셀**: 2단계 박스는 빈 span, 3단계 밑줄은 `&nbsp;` 뿐이고 `stripSpaces` 의 `\s` 가 **NBSP 까지 지운다**. 그래서 개념어로만 이뤄진 제목 행이 '빈 행' 으로 오판된다. `countBlankMarks` 로 `.eb-blank-run`/`.eb-stage3-blank` 개수를 세고, `isStrongOnly` 는 텍스트와 표시 개수를 **따로** 비교한다(이어 붙여 비교하면 굵은 조각이 여럿일 때 텍스트-표시 순서가 어긋나 굵은 제목을 놓친다). 1단계는 초성 글자가 남아 무관하다
- [2026-09-03] **`legalCutFlags` 는 rowspan 을 행 그룹(`thead`/`tbody`)으로 클램프하지 않는다 — 일부러 그렇다.** HTML 규격상 rowspan 은 행 그룹 끝에서 끝나고 `rowspan="0"` 은 '그룹 끝까지' 지만, `buildChunk` 가 모든 행을 **단일 `<tbody>` 로 평탄화**하므로 절단 합법성만 그룹으로 좁히면 조각에서는 그 셀이 더 멀리 뻗어 **열이 밀린다**(합법성과 출력이 어긋난다). 지금은 뻗은 대로 인정하고 `rowspan="0"` 은 표 끝까지로 본다 — 보수적이라 최악이 '분할 못 해 축소 인쇄' 이고 절대 열이 밀리지 않는다. TipTap 은 `<thead>` 를 만들지 않고 단일 tbody 만 내보내 실제 콘텐츠에선 그룹이 하나뿐이라 클램프가 no-op 이기도 하다. 제대로 하려면 조각에 행 그룹을 보존하고 `rowspan="0"` 을 유한값으로 바꾸는 것까지 **같이** 해야 한다
- [2026-09-03] **`splitTableByRows` 는 쪼갤 수 없으면 입력 문자열을 `[tableHtml]` 그대로 돌려줘야 한다 — 그게 재분할 루프의 종료 조건이다.** [useConceptSheetBlocks](src/hooks/useConceptSheetBlocks.ts) 는 조각 수 > 1 일 때만 state 를 갱신하므로(`changed`), 억지로 조각 2개를 만들면 측정할 때마다 상태가 갱신돼 렌더 루프가 된다. `MAX_SPLIT_PASSES = 2` 는 그 위의 안전망일 뿐 진짜 가드가 아니다
- [2026-09-04] **조각 표의 열 폭은 원본의 `<colgroup>` 복제가 1순위다**(실측 셀 폭은 맞춤이 실패한 표의 대비책). 열 폭 맞춤이 원본에 박아 둔 colgroup 을 그대로 물려받아야 조각의 열 폭·행 높이가 원본과 같다. 순서를 뒤집으면 실측 폭이 이겨 조각마다 폭이 미세하게 달라진다. 아래 2026-09-03 항목의 "편집기 colwidth 는 인쇄에 반영되지 않는다"는 지금도 그대로다 — 여기서 말하는 colgroup 은 **인쇄 엔진이 스스로 만든 것**이다
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
- [2026-09-08] **(위 2026-08-15 헤더 항목은 무효)** 상단 가로 헤더는 좌측 사이드바로 대체됐고 `Header.tsx` 는 삭제됐다([src/components/layout/AppShell.tsx](src/components/layout/AppShell.tsx) + [Sidebar.tsx](src/components/layout/Sidebar.tsx)). 메뉴가 세로로 쌓이므로 더 이상 '메뉴를 추가하면 헤더가 2줄이 된다' 는 제약이 없다. **본문 위에 남는 상단 바 높이는 CSS 변수 `--app-topbar-h` 가 단일 출처**다([globals.css](src/app/globals.css) — `lg` 이상 0px, 그 미만 56px). sticky 툴바 오프셋과 개념지 편집기의 `100vh` 계산이 전부 이 변수를 쓰니 **`top-16` / `64px` 을 다시 하드코딩하지 말 것** — 데스크톱에선 위에 아무것도 없어 그만큼 빈 띠가 생기고, 모바일에선 상단 바에 가린다. 사이드바·모바일 상단 바는 `data-no-print` 라 인쇄에서 빠진다.
  - 메뉴 활성 판정은 [nav-items.ts](src/components/layout/nav-items.ts) 의 `isNavItemActive` 하나뿐이다. **세그먼트 경계**로 비교하므로(`/words` 가 `/wordsomething` 을 잡지 않는다) 새 메뉴를 추가할 때 순수 `startsWith` 로 되돌리지 말 것. 목록에서만 들어가는 경로(`/exam/view`·`/exam/create` → `단어 시험지`)는 `extraPrefixes` 로 부모 메뉴에 붙인다 — [2026-09-08] 시험지 생성은 메뉴 항목을 없애고 `/exam/history` 화면의 버튼으로만 들어가게 했으므로, 생성 화면의 활성 표시도 목록 항목이 대신한다
- [2026-08-15] ~~헤더의 데스크톱 임계값은 `md:` 가 아니라 `lg:`~~ (2026-09-08 사이드바 전환으로 무효 — 위 항목 참고). 헤더([src/components/layout/Header.tsx](src/components/layout/Header.tsx))의 데스크톱 임계값은 `md:` 가 아니라 **`lg:`** 이고 브랜드 텍스트는 **`xl:` 부터**만 보인다. 관리자 계정은 메뉴가 7개(≈724px)라 로고·로그아웃까지 더하면 `lg`(콘텐츠 960px)에 겨우 들어간다. `flex-wrap` 이 없어 폭이 모자라면 flex 아이템이 줄바꿈되는 게 아니라 **각 아이템 내부 텍스트가 접혀** `h-16` 을 뚫고 헤더가 2줄이 된다 — 메뉴를 추가하려면 이 여유를 먼저 계산할 것. 로그인 이메일은 데스크톱에서 제거했고 모바일 메뉴에만 남아 있다
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