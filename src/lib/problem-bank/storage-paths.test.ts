import { describe, it, expect } from 'vitest';
import {
  PROBLEM_BANK_BUCKET,
  passageFigurePath,
  passageRegionPath,
  problemFigurePath,
  problemRegionPath,
  sourceAnswerKeyPath,
  sourceFolder,
  sourcePagePath,
  sourcePdfPath,
} from './storage-paths';

const ID = '0f9c2b1a-1111-4222-8333-444455556666';

describe('storage-paths', () => {
  it('버킷 이름이 ara-system 과 겹치지 않는다 — Storage 는 프로젝트 전역이다', () => {
    expect(PROBLEM_BANK_BUCKET).toBe('exam-problem-bank');
  });

  it('경로를 규약대로 만든다', () => {
    expect(sourcePdfPath(ID)).toBe(`sources/${ID}/original.pdf`);
    expect(sourcePagePath(ID, 3)).toBe(`sources/${ID}/pages/3.jpg`);
    expect(problemRegionPath(ID)).toBe(`problems/${ID}/region.jpg`);
    expect(passageRegionPath(ID)).toBe(`passages/${ID}/region.jpg`);
    expect(sourceFolder(ID)).toBe(`sources/${ID}`);
  });

  it('한글·공백이 섞인 id 를 막는다 — Storage 키 정규식이 ASCII 라 업로드가 거부된다', () => {
    expect(() => sourcePdfPath('상현중 기출')).toThrow();
    expect(() => problemRegionPath('문항1')).toThrow();
  });

  it('경로 탈출을 막는다', () => {
    expect(() => sourcePdfPath('../../etc')).toThrow();
    expect(() => sourceFolder('a/b')).toThrow();
  });

  it('빈 id 를 막는다', () => {
    expect(() => sourcePdfPath('')).toThrow();
  });

  it('쪽 번호가 1 미만이거나 정수가 아니면 막는다', () => {
    expect(() => sourcePagePath(ID, 0)).toThrow();
    expect(() => sourcePagePath(ID, 1.5)).toThrow();
  });

  it('답지 경로를 규약대로 만든다', () => {
    expect(sourceAnswerKeyPath(ID, 1, 'pdf')).toBe(`sources/${ID}/answer-key/1.pdf`);
    expect(sourceAnswerKeyPath(ID, 3, 'jpg')).toBe(`sources/${ID}/answer-key/3.jpg`);
  });

  it('답지 경로가 페이지 이미지와 겹치지 않는다 — 겹치면 원본 대조가 망가진다', () => {
    expect(sourceAnswerKeyPath(ID, 1, 'jpg')).not.toBe(sourcePagePath(ID, 1));
  });

  it('답지 번호가 1 미만이거나 정수가 아니면 막는다', () => {
    expect(() => sourceAnswerKeyPath(ID, 0, 'jpg')).toThrow();
    expect(() => sourceAnswerKeyPath(ID, 2.5, 'jpg')).toThrow();
  });
});

describe('figure paths', () => {
  it('문항·지문 그림은 서로 다른 가족을 쓴다', () => {
    expect(problemFigurePath(ID, 1)).toBe(`problems/${ID}/figure-1.jpg`);
    expect(passageFigurePath(ID, 2)).toBe(`passages/${ID}/figure-2.jpg`);
  });

  it('문항 영역 이미지와 겹치지 않는다 — 하나는 통째 출제용, 하나는 본문 안 그림이다', () => {
    expect(problemFigurePath(ID, 1)).not.toBe(problemRegionPath(ID));
  });

  it('순번이 범위를 벗어나면 막는다 — 경로에 그대로 들어가는 값이다', () => {
    expect(() => problemFigurePath(ID, 0)).toThrow();
    expect(() => problemFigurePath(ID, 10)).toThrow();
    expect(() => problemFigurePath(ID, 1.5)).toThrow();
  });
});
