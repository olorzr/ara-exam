'use client';

import { useEffect, useRef, useState } from 'react';
import { openPdfSource, pdfPagePreview, type OpenPdf } from '@/lib/pdf/pdfPages';

/**
 * 고른 쪽 하나를 **크게** 그려 준다 (썸네일로는 무슨 쪽인지 분간이 안 될 때).
 *
 * 두 가지가 규약이다:
 *  ① **문서를 한 번만 연다.** 앞뒤 쪽을 넘길 때마다 다시 열면 그때마다 파일 전체를 복사한다.
 *     파일이 바뀌거나 화면을 떠날 때 `destroy` 한다.
 *  ② **효과 안에서 동기 setState 를 하지 않는다**(`react-hooks/set-state-in-effect` 가 에러다).
 *     '무엇을 이미 그렸는가'(파일+쪽)를 기억하고 로딩은 **렌더에서 파생**한다.
 *
 * @param file - 지금 보고 있는 PDF (없으면 아무것도 하지 않는다)
 * @param page - 크게 볼 쪽. null 이면 닫힌 상태다
 * @returns 그린 이미지·로딩·오류
 */
export function usePdfPagePreview(file: File | null, page: number | null) {
  const [stored, setStored] = useState<{
    forFile: File | null;
    page: number | null;
    src: string | null;
    error: string | null;
  }>({ forFile: null, page: null, src: null, error: null });

  const docRef = useRef<{ file: File; doc: Promise<OpenPdf> } | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    // ⚠️ 효과 본문에서 true 로 **되돌린다** — StrictMode 는 마운트 → 언마운트 → 재마운트라,
    //    안 되돌리면 재마운트 뒤 이 기능이 조용히 죽는다
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // 파일이 바뀌거나 화면을 떠나면 열어 둔 문서를 닫는다
  useEffect(() => () => {
    const open = docRef.current;
    docRef.current = null;
    open?.doc.then((d) => d.pdf.destroy()).catch(() => undefined);
  }, [file]);

  useEffect(() => {
    if (!file || page === null) return;
    let fresh = true;

    if (!docRef.current || docRef.current.file !== file) {
      docRef.current = { file, doc: openPdfSource({ kind: 'file', file }) };
    }
    const entry = docRef.current;
    let opened = false;

    entry.doc
      .then((doc) => { opened = true; return pdfPagePreview(doc, page); })
      .then((src) => {
        if (!fresh || !aliveRef.current) return;
        setStored({ forFile: file, page, src, error: null });
      })
      .catch(() => {
        // ⚠️ **여는 데** 실패한 것만 놓는다. 그 약속을 붙들고 있으면 다음 쪽도 같은 실패를
        //    물려받는데, 실패한 약속에는 닫을 문서가 없어 놓아도 새는 것이 없다.
        //    반대로 **그리는 데만** 실패했으면 문서는 멀쩡히 열려 있다 — 여기서 놓으면
        //    정리가 그 문서를 못 찾아 `destroy` 를 영영 못 하고, 실패를 되풀이할수록 쌓인다
        if (!opened && docRef.current === entry) docRef.current = null;
        if (!fresh || !aliveRef.current) return;
        setStored({ forFile: file, page, src: null, error: '이 쪽을 크게 그리지 못했어요.' });
      });

    return () => { fresh = false; };
  }, [file, page]);

  // '이미 그린 것' 이 지금 보려는 것과 같은가 — 로딩은 state 가 아니라 여기서 나온다
  const ready = stored.forFile === file && stored.page === page;

  return {
    src: ready ? stored.src : null,
    error: ready ? stored.error : null,
    loading: page !== null && !ready,
  };
}
