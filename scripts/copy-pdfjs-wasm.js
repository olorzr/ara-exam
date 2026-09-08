// pdfjs-dist wasm 자산을 public으로 복사 — predev/prebuild 훅에서 실행.
// pdfjs 5.x는 JBIG2(흑백 스캐너 PDF)·JPX 디코딩에 wasm이 필요하고,
// getDocument({ wasmUrl })가 이 경로에서 jbig2.wasm 등을 fetch한다.
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'wasm')
const dest = path.join(__dirname, '..', 'public', 'pdfjs-wasm')

if (!fs.existsSync(src)) {
  console.error('❌ node_modules/pdfjs-dist/wasm 이 없어. npm install 먼저 실행해줘.')
  process.exit(1)
}
fs.cpSync(src, dest, { recursive: true })
console.log(`✅ pdfjs wasm 복사 완료: ${dest}`)
