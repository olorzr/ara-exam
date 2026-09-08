import { describe, it, expect } from 'vitest';
import {
  ANSWER_KEY_MAX_IMAGES, answerKeyBatchCount, answerKeyFileKind, answerKeyImageCount,
  answerKeyStoragePlan, answerKeySummary, pickAnswerKeyFiles, type AnswerKeyInput,
} from './answer-key-input';

const ID = '0f9c2b1a-1111-4222-8333-444455556666';

function file(name: string, type: string): File {
  return new File(['x'], name, { type });
}

const PDF = file('answer.pdf', 'application/pdf');
const JPG = file('1.jpg', 'image/jpeg');
const PNG = file('2.png', 'image/png');

describe('answerKeyFileKind', () => {
  it('MIME 으로 판단한다', () => {
    expect(answerKeyFileKind(PDF)).toBe('pdf');
    expect(answerKeyFileKind(JPG)).toBe('image');
    expect(answerKeyFileKind(PNG)).toBe('image');
  });

  it('MIME 이 비어도 확장자로 판단한다 — 어떤 기기는 type 을 안 준다', () => {
    expect(answerKeyFileKind(file('답지.PDF', ''))).toBe('pdf');
    expect(answerKeyFileKind(file('IMG_0001.JPEG', ''))).toBe('image');
  });

  it('지원하지 않는 형식은 null', () => {
    expect(answerKeyFileKind(file('a.hwp', 'application/x-hwp'))).toBeNull();
  });
});

describe('pickAnswerKeyFiles', () => {
  it('PDF 하나면 pdf', () => {
    expect(pickAnswerKeyFiles([PDF])).toEqual({ ok: true, kind: 'pdf', file: PDF });
  });

  it('사진 여러 장이면 images (PNG 도 받는다)', () => {
    const picked = pickAnswerKeyFiles([JPG, PNG]);
    expect(picked).toEqual({ ok: true, kind: 'images', files: [JPG, PNG] });
  });

  it('PDF 와 사진을 섞으면 오류 — 읽는 순서를 정할 수 없다', () => {
    const picked = pickAnswerKeyFiles([PDF, JPG]);
    expect(picked.ok).toBe(false);
  });

  it('PDF 두 개면 오류', () => {
    expect(pickAnswerKeyFiles([PDF, file('b.pdf', 'application/pdf')]).ok).toBe(false);
  });

  it('사진이 상한을 넘으면 오류', () => {
    const many = Array.from({ length: ANSWER_KEY_MAX_IMAGES + 1 }, (_, i) => file(`${i}.jpg`, 'image/jpeg'));
    expect(pickAnswerKeyFiles(many).ok).toBe(false);
  });

  it('지원하지 않는 형식이 섞이면 오류', () => {
    expect(pickAnswerKeyFiles([JPG, file('a.hwp', '')]).ok).toBe(false);
  });

  it('빈 목록은 오류', () => {
    expect(pickAnswerKeyFiles([]).ok).toBe(false);
  });
});

describe('answerKeyStoragePlan', () => {
  it('PDF 는 1.pdf 하나', () => {
    expect(answerKeyStoragePlan(ID, { kind: 'pdf', file: PDF, pageCount: 3 })).toEqual([
      { path: `sources/${ID}/answer-key/1.pdf`, contentType: 'application/pdf' },
    ]);
  });

  it('사진은 고른 순서대로 1..n.jpg 이고 PNG 도 image/jpeg 로 올린다 — 버킷이 PNG 를 안 받는다', () => {
    expect(answerKeyStoragePlan(ID, { kind: 'images', files: [JPG, PNG] })).toEqual([
      { path: `sources/${ID}/answer-key/1.jpg`, contentType: 'image/jpeg' },
      { path: `sources/${ID}/answer-key/2.jpg`, contentType: 'image/jpeg' },
    ]);
  });
});

describe('answerKeyImageCount · answerKeyBatchCount', () => {
  const photos: AnswerKeyInput = {
    kind: 'images',
    files: Array.from({ length: 6 }, (_, i) => file(`${i}.jpg`, 'image/jpeg')),
  };

  it('PDF 는 쪽 수, 사진은 장수를 센다', () => {
    expect(answerKeyImageCount({ kind: 'pdf', file: PDF, pageCount: 3 })).toBe(3);
    expect(answerKeyImageCount(photos)).toBe(6);
    expect(answerKeyImageCount(null)).toBe(0);
  });

  it('원본 정답표 7쪽 + 사진 6장이면 2 + 2 묶음이다', () => {
    expect(answerKeyBatchCount([1, 2, 3, 4, 5, 6, 7], photos)).toBe(4);
  });

  it('답지가 없으면 원본 정답표 묶음만 센다', () => {
    expect(answerKeyBatchCount([1, 2], null)).toBe(1);
    expect(answerKeyBatchCount([], null)).toBe(0);
  });
});

describe('answerKeySummary', () => {
  it('종류에 맞는 단위로 적는다', () => {
    expect(answerKeySummary({ kind: 'pdf', file: PDF, pageCount: 3 })).toBe('답지 PDF 3쪽');
    expect(answerKeySummary({ kind: 'images', files: [JPG, PNG] })).toBe('답지 사진 2장');
    expect(answerKeySummary(null)).toBe('');
  });
});
