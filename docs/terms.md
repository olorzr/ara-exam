# 도메인 용어 정의

## 카테고리 (Category)
- 정의: 단어를 분류하는 계층 구조 (중등/고등 > 학년 > 출판사 > 대단원 > 소단원)
- 코드에서의 사용: `Category` 타입, `categories` 테이블
- 관련 파일: `src/types/index.ts`, `sql/01_schema.sql`

## 단어 (Word)
- 정의: 학생이 학습할 개별 어휘 항목 (단어 + 뜻)
- 코드에서의 사용: `Word` 타입, `words` 테이블
- 관련 파일: `src/types/index.ts`, `sql/01_schema.sql`

## 시험지 (Exam)
- 정의: 카테고리에서 선택한 단어로 생성된 주관식 시험 문서
- 코드에서의 사용: `Exam` 타입, `exams` 테이블
- 관련 파일: `src/types/index.ts`, `sql/01_schema.sql`

## 시험지 단어 (ExamWord)
- 정의: 시험지 생성 시점의 단어 스냅샷 (원본 수정과 무관하게 보존)
- 코드에서의 사용: `ExamWord` 타입, `exam_words` 테이블
- 관련 파일: `src/types/index.ts`, `sql/01_schema.sql`

## 합격선 (Pass Percentage)
- 정의: 시험 통과에 필요한 최소 정답률 (기본값 80%)
- 코드에서의 사용: `pass_percentage`, `pass_count`, `DEFAULT_PASS_PERCENTAGE`
- 관련 파일: `src/lib/constants.ts`, `src/app/(main)/exam/create/page.tsx`

## 외부지문 및 프린트 (External Level)
- 정의: 교과서 외 학교별 특이 지문/프린트물의 단어를 관리하는 별도 카테고리
- 코드에서의 사용: `EXTERNAL_LEVEL` 상수, `CategoryLevel` 타입
- 관련 파일: `src/lib/constants.ts`, `src/types/index.ts`

## 카테고리 레벨 (CategoryLevel)
- 정의: 최상위 분류 ('중등' | '고등' | '외부지문 및 프린트')
- 코드에서의 사용: `CategoryLevel` 타입
- 관련 파일: `src/types/index.ts`

## 내신 시험범위 (Naesin Scope)
- 정의: ara-system 수업 > 내신 관리가 (학교×학년×학년도×학기×중간/기말) 단위로 저장한 시험범위·교과서·단원 체크·시험 기간. 이 앱은 읽기 전용으로 연동해 시험지 생성 시 해당 범위의 단어 카테고리를 자동 선택한다
- 코드에서의 사용: `ScopeSlotRow`, `fetchScopeSlot`, `matchScopeToCategories`, `publicDb()` (public 스키마 읽기 전용 — 쓰기 금지)
- 관련 파일: `src/lib/naesin-scope/`, `src/lib/supabase-public.ts`, `src/components/exam/NaesinScopeLoader.tsx`
