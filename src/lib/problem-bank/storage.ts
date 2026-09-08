import { supabase } from '@/lib/supabase';
import { PROBLEM_BANK_BUCKET } from './storage-paths';

/**
 * 기출 문제 은행 Storage 접근.
 *
 * 버킷은 **비공개**다. 읽기는 서명 URL 로만 하고 그 URL 을 DB 에 저장하지 않는다
 * (만료된다). DB 에는 경로만 두고 화면이 열 때마다 서명한다.
 *
 * ⚠️ 업로드는 항상 `upsert: false` 다. `true` 로 올리면 storage-api 가 UPDATE 권한까지
 *    요구하는데 우리 정책에는 UPDATE 가 없어 **전량 조용히 실패**한다
 *    (ara-system 의 exam-papers 버킷이 그렇게 1년 가까이 죽어 있었다).
 *    바꿔 올릴 일이 있으면 지우고 새로 올린다.
 */

/** 서명 URL 유효 시간(초). 검수·인쇄 한 세션을 덮을 만큼만 */
const SIGN_TTL_SECONDS = 60 * 60;

/**
 * 파일 하나를 올린다.
 * @param path - 버킷 기준 경로 (storage-paths 의 함수로 만들 것)
 * @param body - 올릴 내용
 * @param contentType - MIME (버킷 화이트리스트에 있어야 한다)
 * @throws 업로드 실패 시
 */
export async function uploadProblemFile(
  path: string,
  body: Blob | File | ArrayBuffer,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(PROBLEM_BANK_BUCKET)
    .upload(path, body, { contentType, upsert: false });
  if (error) throw error;
}

/**
 * 이미 있는 자리에 다시 올린다(검수에서 영역을 고쳐 다시 자를 때).
 * UPDATE 정책이 없으므로 **지우고 새로 올린다**.
 * @param path - 버킷 기준 경로
 * @param body - 올릴 내용
 * @param contentType - MIME
 */
export async function replaceProblemFile(
  path: string,
  body: Blob | File | ArrayBuffer,
  contentType: string,
): Promise<void> {
  await supabase.storage.from(PROBLEM_BANK_BUCKET).remove([path]);
  await uploadProblemFile(path, body, contentType);
}

/**
 * 경로 하나의 서명 URL.
 * @param path - 버킷 기준 경로
 * @returns URL. 실패하면 null (이미지가 안 보일 뿐 화면은 살아 있어야 한다)
 */
export async function signProblemFile(path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(PROBLEM_BANK_BUCKET)
    .createSignedUrl(path, SIGN_TTL_SECONDS);
  return error ? null : data?.signedUrl ?? null;
}

/**
 * 여러 경로를 한 번에 서명한다. 인쇄 화면은 수십 장을 쓰므로 반드시 묶어서 부른다.
 * @param paths - 버킷 기준 경로들
 * @returns 경로 → URL 맵 (실패한 경로는 빠진다)
 */
export async function signProblemFiles(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return out;

  const { data, error } = await supabase.storage
    .from(PROBLEM_BANK_BUCKET)
    .createSignedUrls(unique, SIGN_TTL_SECONDS);
  if (error || !data) return out;

  for (const row of data) {
    if (row.signedUrl && row.path) out.set(row.path, row.signedUrl);
  }
  return out;
}

/**
 * 파일들을 지운다. 실패해도 throw 하지 않는다 —
 * 고아 객체가 남는 것보다 화면이 멈추는 쪽이 나쁘다.
 * @param paths - 버킷 기준 경로들
 */
export async function removeProblemFiles(paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;
  await supabase.storage.from(PROBLEM_BANK_BUCKET).remove(unique);
}
