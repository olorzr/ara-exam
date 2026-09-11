import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 런타임 **순환 import** 를 막는다.
 *
 * ⚠️ 이 검사가 없어서 프로덕션이 멈춘 적이 있다(2026-09-11). 예산값이 `pdfPages` 에 있고
 *    `pdfColumns` 가 그것을 import 하는데 `pdfPages` 도 `pdfColumns` 를 import 해서
 *    순환이 됐다. 번들러가 CommonJS 로 풀면 나중에 초기화되는 쪽이 `undefined` 를 읽어
 *    단 이미지 예산이 `NaN` 이 되고, `url.length <= NaN` 이 늘 거짓이라 **모든 2단 쪽이
 *    조용히 건너뛰어져** 기출 읽기가 통째로 실패했다.
 *
 * 테스트(Vite/ESM)는 평가 순서가 달라 이것을 못 잡는다 — 그래서 값이 아니라
 * **그래프 자체**를 본다. `import type` 은 런타임에 없으므로 세지 않는다.
 */

const ROOT = 'src';

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

/** 확장자를 뗀 경로 — 그래프의 마디 이름 */
const nodeOf = (file: string) => file.replace(/\.tsx?$/, '');

/** import 한 줄이 **값을** 가져오는가 (`import type ...` 은 런타임에 없다) */
function isValueImport(statement: string): boolean {
  return !/^\s*import\s+type\s/.test(statement);
}

function buildGraph(files: string[]): Map<string, string[]> {
  const known = new Set(files.map(nodeOf));
  const resolve = (from: string, spec: string): string | null => {
    let base: string;
    if (spec.startsWith('@/')) base = path.join('src', spec.slice(2));
    else if (spec.startsWith('.')) base = path.join(path.dirname(from), spec);
    else return null;
    for (const candidate of [base, `${base}/index`]) {
      if (known.has(candidate)) return candidate;
    }
    return null;
  };

  const graph = new Map<string, string[]>();
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const deps = new Set<string>();
    for (const m of src.matchAll(/^\s*import\s[\s\S]*?from\s+['"]([^'"]+)['"]/gm)) {
      if (!isValueImport(m[0])) continue;
      const target = resolve(file, m[1]);
      if (target) deps.add(target);
    }
    graph.set(nodeOf(file), [...deps]);
  }
  return graph;
}

function findCycles(graph: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];

  const visit = (node: string) => {
    state.set(node, 1);
    stack.push(node);
    for (const dep of graph.get(node) ?? []) {
      if (state.get(dep) === 1) cycles.push([...stack.slice(stack.indexOf(dep)), dep]);
      else if (!state.has(dep)) visit(dep);
    }
    stack.pop();
    state.set(node, 2);
  };

  for (const node of graph.keys()) if (!state.has(node)) visit(node);
  return cycles;
}

describe('import 그래프', () => {
  it('값 import 에 순환이 없다 — 순환은 상수를 조용히 undefined 로 만든다', () => {
    const cycles = findCycles(buildGraph(sourceFiles(ROOT)));
    expect(cycles.map((c) => c.join(' → '))).toEqual([]);
  });
});
