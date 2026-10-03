/**
 * 원본 쪽을 눈으로 대조한 2026-10-03 업로드 8개 시험의 지문.
 * 이 지문들은 원문의 실제 상자를 본문 HTML에 기록했으므로, 앱의 기본 바깥 틀을 더하지 않는다.
 * 다른 기존 시험의 표시 방식은 바꾸지 않기 위해 ID로 범위를 고정한다.
 */
const SOURCE_ACCURATE_PASSAGE_IDS = new Set([
  // 2023-m2-f
  '1d58d606-4f29-5025-8047-b4e9a6c17289',
  '973daf99-5541-5def-aadf-55ac08a19bc2',
  // 2024-gwanghui-m3-final
  '1f7254ff-07d2-561e-bc71-6b0653c34021',
  'b1347466-0cdc-5fef-881d-74a211cee3d6',
  '78c94748-93e2-5aed-99f0-b3f35b6bf71f',
  '9a76e7b3-52fb-5162-94d5-2bf6611f6215',
  '3e969628-0756-591e-a82f-877476cf321d',
  'c2482142-a433-583b-8d0e-9fed27fc63e4',
  // 2024-gwanghui-m3-mid
  '72925caa-8912-5004-9e3f-5f4cd0ad165b',
  'dd24aa1e-17e9-5205-a6c3-2501c84f3ccd',
  // 2025-m3-f
  'b307f9fa-1260-5a3f-9acc-5554ed05c658',
  'b99d7aee-9d42-57d7-934f-5f4c693f0552',
  '845ab5a6-800a-5a54-8cfa-70c18e0b002e',
  // 2026-m2-f
  '3fde2851-e331-5ba7-9e5e-1e65be402e5a',
  '4548e248-f3e8-54cb-8153-6c2b012d287f',
  '6239c884-ef02-5678-a55a-882d25962bdf',
  // 2026-m3-f
  '11996d8c-f7c0-5212-a290-cb96574c1d38',
  'f7d714b0-8850-5777-855b-0eb086fb504b',
  '7a0c6e9e-8a43-58a5-ba98-41b218a7c5e4',
  '0b12d1bd-a13f-5568-9a6d-5da7419400d5',
  '1d01b568-cc2d-532b-801c-3b33819e707a',
  '511fe6ad-3faf-556d-afd5-b766dfbd0585',
  // 2026-m2-mid
  'af1bcef3-691c-4c50-8384-b2e022303af7',
  '198d2d0e-cfbf-42e9-8abe-fa7177faf717',
  '86bf9c5d-7d8e-4809-b857-a17cb0b094b7',
  'f1932222-aaf6-46e6-9a0f-d20f02a17049',
  '209814ac-c118-47c4-aa5e-f63e99813155',
  // 2026-m3-mid
  '4537c73f-b858-4c33-83bd-14d546ac9f74',
  '4d9888d7-27d5-4905-9fea-473c67139aa1',
  '5c93f83f-3b29-4235-a659-1bdb591dbbe9',
  '3123eb97-1160-493f-9bfe-22d46985f28b',
  'e5d54110-7b71-4d66-97c9-93720edb13d9',
  '19f083c4-fdaa-4f1e-9eff-311b161da518',
]);

export function hasSourceAccuratePassageLayout(id: string): boolean {
  return SOURCE_ACCURATE_PASSAGE_IDS.has(id);
}

/** 원본의 (가) 표시가 CSS 말머리가 아니라 문단 안 실제 글자인가. */
export function hasLiteralPassageLabels(html: string): boolean {
  return /<p>\s*\([가-차]\)/.test(html);
}
