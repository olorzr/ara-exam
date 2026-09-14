// 카테고리 마스터 데이터 CRUD. 엔티티별 파일을 모아 재노출한다.
// (publishers · major_chapters · sub_chapters · schools · school_materials + 집계)
// ⚠️ schools 만 예외다 — 학교의 원본은 관리자시스템 public.schools 이고 여기 exam.schools 는
//    그 거울이라 CRUD 가 아니라 조회 + ensureSchoolMirror 뿐이다(sql/27).
export * from './publishers';
export * from './major-chapters';
export * from './sub-chapters';
export * from './schools';
export * from './school-options';
export * from './school-materials';
export * from './aggregate';
