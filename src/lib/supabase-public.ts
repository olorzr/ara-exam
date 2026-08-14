import { supabase } from '@/lib/supabase';

/**
 * ara-system 공유 DB의 public 스키마 접근 (읽기 전용).
 *
 * 학교(schools)·내신 시험범위(school_exam_scopes)·교과서(curriculum_textbooks)는
 * ara-system(public 스키마)이 단일 원본이다. 이 클라이언트로는 절대 쓰기
 * (insert/update/delete/rpc)를 하지 말 것 — 원본 데이터 관리는 ara-system 화면에서만 한다.
 */
export const publicDb = () => supabase.schema('public');
