import { describe, it, expect } from 'vitest';
import { printScanFolder, printScanPagePath, printScanPdfPath } from './storage-paths';

const ID = '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0';

describe('printScanPdfPath / printScanPagePath', () => {
  it('스캔 폴더 아래 고정 영문 이름으로 만든다', () => {
    expect(printScanFolder(ID)).toBe(`print-scans/${ID}`);
    expect(printScanPdfPath(ID)).toBe(`print-scans/${ID}/original.pdf`);
    expect(printScanPagePath(ID, 3)).toBe(`print-scans/${ID}/pages/3.jpg`);
  });

  it('기출 경로(sources/…)와 섞이지 않는다', () => {
    expect(printScanPdfPath(ID).startsWith('print-scans/')).toBe(true);
  });

  it('한글·공백이 섞인 id 는 거부한다 — Storage 가 ASCII 키만 받는다', () => {
    expect(() => printScanPdfPath('상현중 프린트')).toThrow();
    expect(() => printScanPdfPath('a/b')).toThrow();
    expect(() => printScanPdfPath('')).toThrow();
  });

  it('판 꼬리표를 주면 다른 파일이 된다 — 옛 원본을 지우지 않고 새로 올리기 위해서다', () => {
    expect(printScanPagePath(ID, 3, 'm9x1')).toBe(`print-scans/${ID}/pages/3-m9x1.jpg`);
    // 꼬리표가 달라도 같은 쪽을 가리킨다(옛 파일은 그대로 남는다)
    expect(printScanPagePath(ID, 3, 'm9x1')).not.toBe(printScanPagePath(ID, 3));
  });

  it('꼬리표의 기호는 걷어낸다 — Storage 키에 그대로 들어간다', () => {
    expect(printScanPagePath(ID, 1, 'a/b 2')).toBe(`print-scans/${ID}/pages/1-ab2.jpg`);
  });

  it('쪽 번호는 1 이상 정수여야 한다', () => {
    expect(() => printScanPagePath(ID, 0)).toThrow();
    expect(() => printScanPagePath(ID, 1.5)).toThrow();
    expect(() => printScanPagePath(ID, -2)).toThrow();
  });
});
