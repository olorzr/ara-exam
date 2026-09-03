# Changelog

## [0.1.15] - 2026-09-04
### Changed
- **넓은 표가 있어도 개념관리지 시트를 2단으로 되돌렸다.** 0.1.13 이 "열 3개 이상 표가 있으면 시트 전체를 1단" 으로 강제한 건 열 폭을 못 맞춰 넓은 표가 2단 칸(≈328px)에서 깨지던 시절의 임시 조치였다. 0.1.14 의 열 폭 맞춤이 칸 폭에 맞춰 주므로 근거가 사라졌고, 1단은 페이지 수만 늘린다. 단 수는 다시 **글자 수(300자 초과 → 2단)** 로 정한다([src/lib/print/sheet-columns.ts](src/lib/print/sheet-columns.ts)). 예외 하나 — `blockquote`/`li` **래퍼 안에 든** 넓은 표는 열 폭 맞춤도 행 분할도 손대지 못하므로(`rootTable` 가드) 그런 표가 있을 때만 1단으로 되돌린다(`maxWrappedTableColumns`). 코덱스 리뷰가 잡은 회귀
- **긴 열 하한을 칸 폭에 상대적으로** — `min(96px, 칸 폭 × 1/5)`([src/lib/print/table-col-fit.ts](src/lib/print/table-col-fit.ts) 의 `longColumnFloor`). 절대값 96px 은 2단 칸에서 긴 열이 둘만 돼도 실현이 안 되어 전부 비례로 떨어졌고 짧은 열이 다시 한 글자로 눌렸다(실측 `45/45/45/300/400` → `18/18/18/117/156`). 이제 `47/47/47/80/107`. 1단(≈680px)에서는 96 그대로라 동작이 같다
  - 하한을 균등 몫(칸 폭 / 열 수)까지 올리는 건 시도했다가 뺐다 — 짧은 열 보호가 실패한 표(2단계 박스 4열)에서 하한이 폭을 다 먹어 긴 열이 짧은 열과 같은 폭으로 눌렸다(`46/46/62/174` → `82×4`). WebKit 렌더 비교로 잡았다

## [0.1.14] - 2026-09-04
### Changed
- **개념관리지 표의 열 폭을 인쇄 직전에 자동으로 맞춘다.** 0.1.13 이 표 잘림을 막으려고 넣은 `overflow-wrap: anywhere` 는 셀의 min-content 를 한 글자로 무너뜨린다. 그래서 자동 표 레이아웃이 긴 글 열에 폭을 몰아주고 `구분`·`갈래` 같은 **2~3글자 열을 한 글자 폭으로 눌러** 행이 세로로 길어졌다(1·2단계는 28px 박스가 한 줄에 하나씩 쌓였다)
  - 배치 직전에 표 클론을 `width: max-content` 프로브에 담아 열별 max-content 폭을 재고([src/lib/print/table-measure.ts](src/lib/print/table-measure.ts) 의 `measureMaxContentWidths`), **짧은 열은 실측 폭 그대로 보호**하고 긴 열들이 남은 폭을 max-content 비례로 나눈다([src/lib/print/table-col-fit.ts](src/lib/print/table-col-fit.ts) 의 `fitColumnWidths`). 결과는 퍼센트 `<colgroup>` + `table-layout: fixed` 로 박는다. 열마다 하한(96px)이 있어 긴 열이 실처럼 좁아지지 않는다
  - 실측 폭에 **여유 2px** 를 얹는다 — 딱 맞게 주면 퍼센트 환산·테두리 겹침(border-collapse)에서 1픽셀 미만이 깎여 마지막 글자가 접힌다(WebKit 실측으로 확인한 회귀)
  - 폰트가 늦게 오면 글자 폭이 달라지므로, 폴백 폰트로 맞췄을 때만 웹폰트 적용 후 한 번 더 맞춘다. `overflow-wrap: anywhere` 는 맞춤이 실패한 표를 위한 안전망으로 남는다
  - 편집기에서 드래그한 열 폭(`colwidth`)은 여전히 인쇄에 반영하지 않는다 — 편집기 폭과 인쇄 폭이 달라 px 를 옮길 수 없다
- **긴 표가 페이지에 남은 자리를 채우고 다음 장으로 이어진다.** 예전엔 남은 자리에 안 들어가면 표를 통째로 다음 장으로 넘겨(서문 아래로 반 장이 비었다) **빈 한 장에도 안 들어갈 때만** 쪼갰다
  - `paginate` 가 `splittable` 블록마다 `splitRequests`(그 자리의 남은 높이 + 뒤 조각 용량)를 돌려주고, 훅이 **문서 순서상 실제로 쪼개진 첫 하나만** 반영한다 — 앞 표를 쪼개면 뒤 표의 남은 자리가 달라져 뒤 요청은 이미 낡은 값이다. 한 패스에 표 하나, 재측정 후 다음 표
  - 앞 조각에 본문이 2행도 못 들어가거나 병합 묶음이 남은 자리를 넘기면 **새 장에서 시작**한다(페이지 바닥에 고아 행 한 줄만 남는 것을 막는다)
  - 재분할 상한을 2 → 32 로 올렸다(표 개수만큼 패스가 돈다). 진짜 종료 조건은 그대로 "쪼갤 수 없으면 입력을 그대로 돌려준다"
### Fixed
- 조각 표가 원본 표의 `<colgroup>` 을 그대로 복제한다 — 열 폭 맞춤 결과가 페이지가 갈려도 유지되고, 실측한 행 높이가 조각에서도 맞는다

## [0.1.13] - 2026-09-03
### Fixed
- **개념관리지 1·2단계 시트에서 표가 깨지고 잘리던 문제** (동아 중1 2학기 1-2단원 등). 원인이 가로·세로 두 갈래였다
  - **가로(주범)** — 본문이 300자를 넘으면 시트가 자동 2단이 되는데(칸 폭 ≈328px), 1·2단계는 개념어 한 글자가 28px 박스로 바뀌고 박스 묶음 래퍼가 `white-space: nowrap` 이라 셀 안에서 줄바꿈이 안 됐다. 자동 표 레이아웃은 셀 min-content 합 아래로 못 줄어들어 표가 칸을 뚫고 나갔고, `.a4-sheet__body { overflow: hidden }` 이 오른쪽을 **조용히 잘라냈다**. 개념지 탭보다 1·2단계가 심했던 이유가 이것이다
    - 표 셀에 `overflow-wrap: anywhere` 를 주고(min-content 계산에 반영되는 건 `break-word` 가 아니라 `anywhere` 뿐이다), 박스 묶음 래퍼를 클래스(`eb-blank-run`)로 바꿔 **표 셀 안에서만** 줄바꿈을 허용했다(본문 `<p>` 에서는 한 단어의 박스가 갈리지 않게 nowrap 유지)
    - **열 3개 이상인 표가 하나라도 있으면 시트 전체를 1단(≈680px)으로 되돌린다** ([src/lib/print/sheet-columns.ts](src/lib/print/sheet-columns.ts)). 넓은 표는 줄바꿈을 허용해도 2단 칸에서는 읽기 어렵다
  - **세로 ①** — `splitTableByRows` 가 rowspan 셀이 **하나라도** 있으면 분할을 포기하고 표 전체를 `transform: scale` 로 축소했다(축소 하한이 없어 깨알 표). 편집기에 '셀 병합'이 있어 흔한 표다
    - [src/lib/print/table-row-plan.ts](src/lib/print/table-row-plan.ts) 의 `legalCutFlags` 가 '이 행 앞에서 잘라도 되는가'를 계산해 **병합 묶음 경계에서만** 자르도록 바꿨다. 묶음 하나가 한 장보다 크면 그 조각만 축소한다
  - **세로 ②** — 조각마다 제목 행을 반복하는 조건이 '첫 행이 전부 `<th>`' 였는데, 편집기는 표를 헤더 행 없이 넣어(`withHeaderRow: false`) 제목이 보통 `<td><strong>` 이다. 그래서 2페이지부터 제목 행이 없었다. 굵은 글씨만 있는 행도 제목으로 보고(최대 2행, 병합 제목 포함) 반복한다
  - **조각 열 폭 고정** — 조각은 각자 독립된 표라 페이지마다 열 폭이 달라 보였다. 측정 단계에서 기준 행의 셀 폭을 재 퍼센트 `<colgroup>` + `table-layout: fixed` 로 박는다
  - 표가 블록 루트가 아닐 때(`<blockquote><table>`) 래퍼와 형제 내용이 사라지던 잠재 버그도 함께 막았다(루트 가드)
  - **제목 행 판정 보강** (코덱스 리뷰 4라운드) — 세 가지를 더 고쳤다. ① 개념어로만 이뤄진 굵은 제목 행이 2·3단계 변환 뒤 텍스트가 사라져 '빈 행' 으로 오판되던 것(`countBlankMarks`), ② `묶음명(colspan) + 열 이름` 2행 `<th>` 제목의 둘째 행이 본문으로 밀려 2페이지부터 열 이름이 빠지던 것(`isExplicitHeaderRow`), ③ 제목 셀이 rowspan 으로 뻗은 첫 데이터 행이 제목으로 승격돼 매 페이지 반복되던 것. 이어가기를 **명시 제목(`th`/`thead`)일 때로 한정**하는 규칙 하나로 ②③ 을 동시에 해결했고, 제목을 더 가져가려다 실패하면 마지막 합법 지점으로 후퇴한다

## [0.1.12] - 2026-08-30
### Fixed
- **개념 관리 트리에 `천재(정호웅)` 이 여전히 두 개로 보이던 문제** — 0.1.11 의 정규화는 **쓰기 경로에만** 걸려 있어 새로 저장하는 값만 고쳤고, 이미 저장된 행은 sql/16 을 실행해야 합쳐졌다. 그런데 개념지 목록 트리는 `concept_sheets` 의 **저장 텍스트를 원시 문자열 그대로 `groupBy`** 하므로, 마이그레이션 전에는 화면이 계속 갈라져 보였다
  - 트리 키와 목록 필터를 같은 정규화 키로 통일했다([src/lib/concept-category.ts](src/lib/concept-category.ts) 의 `conceptCategoryKey` / `conceptSheetToCategory`) → **마이그레이션 없이도 한 노드로 합쳐진다**. 개념지 필터는 UUID 가 아니라 값 비교라 이 방식이 안전하다 — 트리와 필터가 같은 키를 쓰므로 **양쪽 표기로 저장된 개념지가 모두 보인다**(표시만 합쳐 한쪽을 가리는 방식이 아니다). sql/16 적용 후에는 값이 이미 정규형이라 no-op
  - ⚠️ **단어 관리·시험지 생성·시험 기록 트리는 여전히 sql/16 이 필요하다** — 그쪽은 선택이 실제 UUID 기준이라 표시만 합치면 한쪽 행의 단어가 조용히 가려진다
- **sql/16 이 `42703 column "year" does not exist` 로 실패하던 문제** — sql/15 가 `categories.year` 를 추가하면서 재생성하는 유니크 인덱스가 **바로 그 중복 행 때문에** 실패하고, 한 트랜잭션이라 `ADD COLUMN` 까지 롤백되어 `year` 없는 상태가 됐다. 중복을 지우려면 sql/16 이 필요한데 sql/16 은 `year` 를 요구하는 닭-달걀이었다
  - sql/16 을 **pre-15 스키마에서도 실행되도록** 고쳤다 — `categories.year` / `school_materials.year·grade` / `concept_sheets.school_name` 의 존재를 확인해 없으면 키에서 빼고 `EXECUTE format()` 으로 조립한다. 권장 순서는 **16 → 15**
  - 상태 진단용 읽기 전용 스크립트 추가 ([sql/diagnose_category_state.sql](sql/diagnose_category_state.sql)) — 스키마 단계와 표기 변형(hex)을 한 번에 확인한다
- **마이그레이션이 엉뚱한 Supabase 프로젝트에 적용되던 문제** — `sql/15`·`sql/16` 은 `exam` 스키마를 대상으로 하는데(`sql/01~14` 는 `public`), `exam` 이 없는 DB 에서 실행해도 `SET search_path` 가 **에러 없이 그 스키마를 건너뛰어** 무자격 객체가 전부 `public` 으로 갔다. 그 결과 `normalize_category_name` 이 ara-system 의 `public` 스키마에 생성되고, `public.categories` 에 `year` 가 없어 `42703` 이 났다
  - 15/16 첫머리에 `exam` 스키마 존재를 확인하는 `DO $guard$` 가드 추가 — 없으면 "다른 프로젝트에 연결됐을 가능성" 을 알리며 즉시 중단한다
  - 코덱스 리뷰가 잡은 결함 2건 반영 — (1) `CREATE OR REPLACE FUNCTION` / `COMMENT ON FUNCTION` 을 `exam.` 으로 명시(무자격이면 public 오염), (2) 자연키를 `join('|')` → `JSON.stringify` 로 변경(이름에 `|` 가 섞이면 서로 다른 카테고리가 같은 키가 됐다)

## [0.1.11] - 2026-08-22
### Fixed
- **같은 출판사가 트리에 두 번 나오던 문제** (`천재(정호웅)` 등) — 카테고리 트리는 이름 문자열 완전 일치로 노드를 묶는데([category-tree.ts](src/lib/category-tree.ts) 의 `groupBy`), 눈에는 똑같지만 바이트가 다른 표기가 섞여 있어 폴더가 갈라졌다. 원인이 되는 변형은 괄호 앞뒤 공백, 붙여넣기로 들어온 NBSP·폭 없는 문자(U+200B/U+FEFF), 한글 IME 의 전각 괄호`（）`, 자모 분리(NFD) 다. `publishers` 의 `UNIQUE(name, level)` 도 `categories` 의 자연키 유니크 인덱스도 **바이트 비교**라 이 변형들을 막지 못했다
  - **표준 정규화 규칙 도입** — [src/lib/category-name.ts](src/lib/category-name.ts) 의 `normalizeCategoryName` 이 출판사·대단원·소단원·학교·프린트명 **모든 쓰기 경로**(마스터 CRUD 5개, `ensureCategoryId`, 개념지 저장)에서 표기를 통일한다. 표준 표기는 `천재(정호웅)` — 괄호 주변 공백 없음
  - **기존 데이터 일괄 정리** — [sql/16_migration_normalize_category_names.sql](sql/16_migration_normalize_category_names.sql) 이 `categories`(단어·시험지 참조를 canonical 로 이관 후 중복 행 병합) → `concept_sheets` → 마스터 5테이블 순으로 병합·정규화한다. 화면에서만 합치지 않고 **데이터를 실제로 병합**한다 — 표시만 합치면 한쪽 행에 붙은 단어가 조용히 가려진다
  - CHANGELOG 0.1.2 에서 `concept_sheets` 만 일회성으로 정리한 적이 있으나, 마스터·`categories` 는 대상이 아니었고 쓰기 경로 방어도 없어 재발했다. 이번엔 양쪽을 함께 막는다
  - ⚠️ **sql/16 을 앱 배포보다 먼저 적용**할 것. 신규 부트스트랩 범위는 이제 **01~16**

### Changed
- **`useConceptSheetEditor` 분리 (315줄 → 210줄)** — 300줄 제한을 넘긴 데다 상태·로딩·저장·마킹·성적연동이 한 파일에 섞여 있었다. 역할별로 갈랐다(동작 변경 없음, 훅 반환 형태 동일)
  - [src/lib/concept-sheet-form.ts](src/lib/concept-sheet-form.ts) — 자동 제목 생성·카테고리 검증·저장 payload 조립. 순수 함수라 테스트로 고정했다([concept-sheet-form.test.ts](src/lib/concept-sheet-form.test.ts), 15케이스). 특히 **외부지문은 출판사가 항상 빈 값**이라 검증이 level 인지형이어야 하는 규칙이 이제 테스트로 박혀 있다
  - [src/hooks/useConceptMarkActions.ts](src/hooks/useConceptMarkActions.ts) — 마킹 붙이기/떼기 4종(편집기 문서 조작 전담)
  - [src/lib/concept-grade-sync.ts](src/lib/concept-grade-sync.ts) — ara-system 성적 등록 fire-and-forget 브릿지

## [0.1.10] - 2026-08-16
### Fixed
- **외부지문 개념지가 ara-system 성적의 '기타' 폴더로 뭉치던 문제** — 외부지문은 출판사가 빈 값이라 학교가 무엇이든 한 폴더에 쌓였다. 이제 학교명을 그룹 폴더로 보내 `개념 시험 > 학교명 > 학년` 으로 정리된다 ([sync-concept-to-grades](src/app/api/sync-concept-to-grades/route.ts))

### Removed
- 폐기된 교육과정 export 라우트(`src/app/api/export/curriculum`) 삭제. Supabase 프로젝트 통합 후 ara-system 이 같은 DB 의 `exam` 스키마를 직접 읽으므로(HTTP pull 폐기) 호출되지 않는 죽은 코드였다

### Changed
- `package.json` 프로젝트명을 `ara-word` → `ara-exam` 으로 정정

## [0.1.9] - 2026-08-15
### Added
- **외부지문 및 프린트에 년도·학년** — 카테고리 계층이 `학교 > 프린트` → **`학교 > 년도 > 학년 > 프린트/작품명`** 이 됐다. 같은 이름의 프린트를 학년도별로 따로 둘 수 있다. 카테고리 관리·단어 등록 양쪽에서 년도/학년을 고른다 ([ExternalCategoryTab.tsx](src/components/words/ExternalCategoryTab.tsx), [CategoryForm.tsx](src/components/words/CategoryForm.tsx), [category-tree.ts](src/lib/category-tree.ts))
  - **기존 프린트는 그대로 보존**된다 — 년도·학년이 `미지정` 인 항목으로 뜨고, 필요할 때 하나씩 정리하면 된다
  - 년도 선택지는 올해 기준 롤링 윈도(내년~4년 전)에 **데이터에 실제로 있는 년도를 합집합**으로 더한다(오래된 년도의 프린트가 목록에서 사라지지 않게)
  - ⚠️ **[sql/15_migration_external_year_grade.sql](sql/15_migration_external_year_grade.sql) 을 앱 배포보다 먼저 적용**해야 한다. `categories` 자연키 유니크 인덱스가 바뀌므로 순서가 뒤바뀌면 단어 저장이 전부 실패한다
- **개념지에서 외부지문 및 프린트 선택 가능** — `concept_sheets` 에 `school_name`/`year` 를 추가하고 저장 검증을 level 인지형으로 바꿨다. 외부지문은 `publisher` 가 빈 값이라 예전 검증(`grade` + `publisher` 필수)으로는 저장 자체가 막혔다

### Fixed
- **헤더 메뉴가 2줄로 접히던 문제** — 데스크톱 이메일 표시를 없애고(모바일 메뉴에는 유지) 브랜드명을 `아라국어논술` 로 줄였다. 데스크톱 내비 임계값을 `md:`→`lg:`, 브랜드 텍스트는 `xl:` 부터 표시. 관리자 계정(메뉴 7개)에서도 한 줄에 들어간다 ([Header.tsx](src/components/layout/Header.tsx))
- **개념지에서만 카테고리가 다르게 동작하던 문제** — 개념지 편집기가 마스터 3테이블 조합을 따로 읽어 `schools`/`school_materials` 를 아예 조회하지 않았고(외부지문이 트리에 없었다), 소단원이 있는 대단원은 "대단원 단독" 행을 만들지 않아 단어 등록에서는 되는 선택이 개념지에서는 불가능했다. `getAllSelectableCategories()` 로 출처를 단어지와 통일했다 ([aggregate.ts](src/lib/category-master/aggregate.ts))
- 개념지 편집기에서 **외부지문 카테고리가 경고 없이 '중등'으로 강등**되던 삼항식 제거 ([ExamCategoryBar.tsx](src/components/exam-builder/ExamCategoryBar.tsx))
- 기존 개념지를 열면 **트리에 현재 카테고리가 선택돼 보인다**(개념지는 id 가 아니라 텍스트를 저장하므로 자연키로 대조). 카테고리 **검색 중에는 트리를 펼친 상태**로 표시 — 기본 접힘(depth<2) 때문에 매칭된 단원이 3단계 아래에 숨어 "검색이 안 먹는다"로 보였다
- 카테고리 **조회 실패를 더 이상 삼키지 않는다**. RLS/네트워크 오류가 "카테고리가 없습니다" 한 줄로만 보였다. 행 상한(5,000)을 넘으면 조용히 자르지 않고 에러를 낸다
- 마스터 이름 변경의 **앱 레벨 fallback 이 `concept_sheets` 를 빼먹던 문제** — `categories` 만 갱신해서, DB 트리거가 없는 환경에서는 단어지만 새 이름이 되고 개념지는 옛 이름으로 갈라졌다(단어지가 멀쩡해 보여 눈치채기 어려웠다)
- 개념지 **인쇄 제목이 `"2026  국어 "` 처럼 공백만 남던 버그** — `filter(Boolean)` 앞 원소가 템플릿 리터럴이라 항상 truthy 였다. 외부지문 제목 분기도 추가 ([ExamSheetRenderer.tsx](src/components/exam-builder/ExamSheetRenderer.tsx))
- 외부지문 단어의 **학년이 항상 빈 값으로 저장**되던 문제(`ensureCategoryId`) — 그 탓에 `levelGradeToDivision` 이 판정 불가가 되어 ara-system 이 외부지문을 전부 중등부로 등록했다

### Changed
- 프린트/작품명 rename 동기화가 `year`/`grade` 로 좁혀진다 — 없으면 다른 년도·학년의 동명 카테고리까지 함께 바뀐다
- 햄버거 버튼에 `type`/`aria-label`/`aria-expanded` 추가

## [0.1.8] - 2026-08-15
### Changed
- **인쇄물 A4 전면 재설계 — 2페이지 이상에서 헤더·푸터가 깨지던 문제 해결.** 시험지·답안지·객관식·단어장·개념지 5종이 모두 브라우저 자동 분할 대신 **실측 기반 A4 낱장 배치**를 쓴다([src/lib/print/](src/lib/print/), [src/components/print/](src/components/print/)). 페이지마다 딱 A4 한 장이 나오고, 푸터는 **마지막 페이지에서도 종이 아래에 고정**된다
- **푸터에 페이지 번호 `n / N` 추가**, **2페이지부터 컴팩트 헤더(제목 + 로고) 반복** — 이전에는 빈 여백만 반복됐다
- 화면 미리보기가 인쇄물과 1:1로 같아졌다(이전에는 화면 210mm / 인쇄 180mm 로 폭이 달라 줄바꿈·페이지 수가 어긋남). 미리보기는 회색 바탕 위 낱장 스택으로 표시
- 개념지의 긴 표는 페이지를 넘길 때 **행 단위로 잘려 이어진다**(헤더 행 반복). 더 쪼갤 수 없는 블록은 잘라내지 않고 한 장에 축소해 담는다
- '전체 출력' 탭의 시트 5장이 각각 새 페이지에서 시작한다(이전에는 이어 붙어 헤더가 페이지 중간에서 시작)

### Removed
- 구 인쇄 CSS 정리: `.exam-print-table`/`thead` 스페이서/`tfoot` 반복, `.exam-print-wrap`, CSS multicol 2단(`.exam-q-grid--dual`/`.mc-q-grid`/`.sheet-body--dual`), `.wb-grid--dual`, 제거된 PDF 기능 잔재(`.eb-sheet-pdf-page`), 미사용 `.eb-section-break`

## [0.1.7] - 2026-08-15
### Changed
- **카테고리 관리를 최상위 메뉴로 분리** — 단어 관리 하위(`/words/categories`)에 숨어 있던 것을 `/categories` 로 올리고 헤더 내비게이션(`📂 카테고리 관리`)·대시보드 빠른 실행에 추가. 여기서 만든 출판사·대단원·소단원이 ara-system 내신 관리의 교과서 목차가 되므로 진입 경로를 드러냈다. 옛 경로는 `next.config.ts` 의 `redirects()` 로 이어준다(북마크 보호, permanent:false)
### Added
- **내신 시험범위 불러오기 — '시험 안 봄' 인지**: ara-system 이 슬롯 단위로 표시한 `no_exam`(mig379)을 읽어 "이 학교는 이 시험을 보지 않아요"로 안내하고 자동 선택을 막는다. ara-system 은 값 보존·잠금 방식이라 true 여도 범위·교과서가 남아 있으므로 **읽는 쪽이 먼저 판정해야 한다** ([fetch.ts](src/lib/naesin-scope/fetch.ts), [NaesinScopeLoader.tsx](src/components/exam/NaesinScopeLoader.tsx))
- **중1 자유학기제**: 중1 은 1학기 중간·기말이 없으므로 시험 선택지에서 제외(`slotOptionsForGrade`). 학년을 바꿔 선택이 무효가 되면 자동으로 비운다. ⚠️ ara-system `isSlotHiddenForGrade` 와 같은 규칙의 교차 저장소 복제라 바꿀 땐 양쪽 함께 ([types.ts](src/lib/naesin-scope/types.ts) + 테스트)

## [0.1.6] - 2026-07-17
### Added
- 학원 관리 시스템(ara-system) 성적 자동 등록 연동 — 시험 생성/재시험 직후 서버 라우트 [src/app/api/sync-to-grades/route.ts](src/app/api/sync-to-grades/route.ts) 가 `exams`+`exam_words` 스냅샷을 읽어 ara-system 인증 엔드포인트(`/api/integrations/vocab-exam`)로 전송 → 어휘 시리즈 회차로 멱등 등록됨(성적목록·어휘 대시보드 자동 노출). 채점은 ara-system 에서 그대로 ([exam/create/page.tsx](src/app/(main)/exam/create/page.tsx), [useExamHistory.ts](src/hooks/useExamHistory.ts))
- **재시험 연동** — 재시험은 부모 exam id + 차수를 함께 보내 ara-system 에서 원본 회차와 연결(retake_of)되고 '재시험 N차' 배지로 구분됨. 부모의 등록 시리즈/학교급을 상속하므로 원본 카테고리가 삭제돼도 올바른 학교급 유지
- **개념 시험 연동** — 개념지 저장 시 서버 라우트 [sync-concept-to-grades](src/app/api/sync-concept-to-grades/route.ts) 가 `concept_sheets` 의 개념 단어(marks)를 읽어 ara-system 개념 엔드포인트로 전송 → **3단계(초성/글자수/빈칸)** 시험으로 '개념 시험' 시리즈에 멱등 등록(각 단계 별도 채점). 마킹된 단어가 있을 때만. 학교급 매핑은 [grade-division.ts](src/lib/grade-division.ts) 로 공용화(단어 라우트와 공유)
- 공유 시크릿은 서버 env 에만 두어 브라우저 비노출. 클라이언트는 `keepalive` fetch 로 쏴 페이지 이동에도 요청이 취소되지 않게 함. 연동 실패는 시험 생성 UX 를 막지 않음(조용히 skip)
- 발신 라우트는 **로그인한 @araeducation.co.kr 사용자만** 호출 가능(Supabase 액세스 토큰 검증) — examId 만으로 아무나 다운스트림 등록을 트리거하지 못하게 함
- **학교급 라우팅**: 시험 카테고리 level/grade 로 학교급(중·고등부)을 도출해 ara-system 이 학교급별 어휘 시리즈에 꽂게 함(수기 채점의 학생 필터가 학교급 기준이라 필수). 단일 학교급으로 명확할 때만 전송하고, 외부지문 등 학교급 정보가 없거나 혼합이면 미상으로 두어 기본 중등부로 등록됨(필요 시 성적에서 수동 이동)
- ⚠️ **배포 시 env `ARA_SYSTEM_INTAKE_URL`·`ARA_SYSTEM_INTAKE_SECRET` 설정 필요**(둘 중 하나라도 비면 연동 skip). `ARA_SYSTEM_INTAKE_SECRET` 은 ara-system 의 `VOCAB_INTAKE_SECRET` 과 동일 값 ([docs/env.example](docs/env.example))

## [0.1.5] - 2026-06-21
### Security
- `exams` 직접 INSERT/UPDATE 차단 → **SELECT/DELETE 전용** 정책. 이전엔 `FOR ALL` 공유라 누구나 `create_exam_with_words` RPC 를 우회해 가짜 시험지·메타데이터(합격선·출처·차수) 위조 INSERT 또는 남의 시험지 UPDATE 변조가 가능했음. 생성/수정은 SECURITY DEFINER RPC 로만 ([sql/14_migration_lock_exams_writes.sql](sql/14_migration_lock_exams_writes.sql) + 01·08 미러). ⚠️ DB 적용: **sql/14 적용 + sql/10 재적용** 필요
- `create_exam_with_words` 신규 생성 검증 3종 — 중복 `word_id` 차단, 표시 문자열 `DISTINCT words.word ≥ 5` 강제(객관식 선지가 5개 미만으로 무너지는 우회 차단), `order_index` 를 클라이언트 입력 대신 `jsonb_array_elements ... WITH ORDINALITY` 배열 위치로 서버 canonicalize(출제 순서 조작 차단). sql/10 + 01_schema.sql 미러. ⚠️ DB 재적용 필요
- OAuth `redirect_uri`·콜백 origin 을 Host 헤더 대신 환경변수 **`APP_ORIGIN`** 으로 고정 — Host 조작으로 인한 redirect_uri 오염/매직링크 `token_hash` 유출 차단. 프로덕션 fail-closed(미설정·오설정 시 라우트 500) ([src/lib/app-origin.ts](src/lib/app-origin.ts), naver-works `route.ts`/`callback/route.ts`). ⚠️ **배포 시 `APP_ORIGIN` 환경변수 설정 필수** ([docs/env.example](docs/env.example))
- archive [sql/archive/00_apply_2026-05-26_security.sql](sql/archive/00_apply_2026-05-26_security.sql) 의 stale `create_exam_with_words` 정의(클라이언트 `p_category_ids` 신뢰)를 `/* */` 로 무력화 + `exams` `FOR ALL` 정책을 SELECT/DELETE 로 교체 — 실수로 재실행해도 쓰기 잠금이 풀리지 않도록(SUPERSEDED, 신규/기존은 번호 파일 01~14 적용)
### Fixed
- 개념지 저장 last-write-wins → `updated_at` 기반 **낙관적 동시성 제어**. 공유 테이블에서 두 사용자가 동시 편집 시 마지막 저장이 상대 변경을 통째로 덮어쓰던 문제 — 충돌 시 저장 거부 + 새로고침 안내 ([src/hooks/useConceptSheetEditor.ts](src/hooks/useConceptSheetEditor.ts))
- 단어 편집 저장 시 `trim()` 누락 보강 — 신규 입력은 trim 하면서 편집 경로는 원문 그대로 써 `"apple "` 등 공백 포함 중복어가 생겨 중복 체크·선지 dedupe 가 깨지던 문제. 빈값 검증 추가 ([src/hooks/useWordsManager.ts](src/hooks/useWordsManager.ts))
- 시험지 생성·재시험·개념지 저장/로드 async 핸들러를 `try/catch/finally` 로 보강 — Supabase 호출이 throw(네트워크 등) 시 `creating`/`retestingId`/`saving`/`loading` 상태가 `true` 로 고착돼 스피너가 무한 정지하던 문제 ([exam/create/page.tsx](src/app/(main)/exam/create/page.tsx), [useExamHistory.ts](src/hooks/useExamHistory.ts), [useConceptSheetEditor.ts](src/hooks/useConceptSheetEditor.ts))
- CSP `style-src`/`font-src` 에 `https://cdn.jsdelivr.net` 허용 — `globals.css` 가 jsdelivr 에서 Pretendard/GmarketSans 폰트를 `@import` 하는데 `'self'` 만 두면 프로덕션에서 폰트가 차단되던 문제 ([next.config.ts](next.config.ts))

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
