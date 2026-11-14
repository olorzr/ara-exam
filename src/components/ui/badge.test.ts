import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { badgeVariants } from './badge';

/**
 * 꼬리표가 화면마다 갈라지지 않게 지킨다(2026-11-13 — 원장님 "OMR 이나 이런 뱃지들이 다 옛날 느낌이야").
 * 예전에는 쓰는 곳마다 `bg-amber-500 text-white`·`bg-sky-500`·`text-[10px]` 를 덮어 꼬리표가 제각각이었다.
 * 색·크기·여백은 갈래(variant)로만 고르고, className 에는 **배치**(바깥 여백·정렬·폭 제한)만 둔다.
 *
 * ⚠️ 정규식으로 찾지 않는다(코덱스 1R) — `className={'…'}`·작은따옴표·템플릿 표기를 놓치고, 금지 목록은 `text-lg`·`pl-8`·
 *    `hover:bg-…` 처럼 빠진 것이 늘 남는다. 그래서 TypeScript 구문 트리로 **공용 Badge 를 들여온 파일의** `<Badge>` 만 찾고,
 *    클래스는 **허용 목록**(배치)에 든 것만 통과시킨다. 글자로 못 읽는 className(`cn(…)`·변수)은 그 자체로 막는다.
 */

const SRC = join(__dirname, '..', '..');
/** 공용 Badge 파일(확장자 없이) */
const BADGE_FILE = join(SRC, 'components', 'ui', 'badge');

/** 허용하는 배치 유틸리티 — 앞에 변형(`hover:` 등)이 붙으면 안 된다 */
const LAYOUT_CLASS = /^(?:-?m[trblxy]?-[\w.[\]/-]+|align-[\w-]+|self-[\w-]+|order-[\w-]+|max-w-[\w.[\]/-]+|min-w-0|shrink(?:-0)?|grow(?:-0)?)$/;

/** 모듈 경로 → 그 모듈이 공용 Badge 로 내보내는 이름들 */
type Exporters = Map<string, Set<string>>;

/** 파일 경로를 모듈 열쇠로 — 확장자·끝의 index 를 뗀다 */
function moduleKey(path: string): string {
  return path.replace(/\.(?:tsx?|jsx?)$/, '').replace(/[/\\]index$/, '');
}

/**
 * 모듈 지정자를 실제 경로(모듈 열쇠)로 — `@/` 별칭과 상대 경로를 같은 자리로 맞춘다(코덱스 2R: `../ui/badge` 로 빠져나갔다).
 * @returns 저장소 밖(패키지)이면 null
 */
function resolveModule(spec: string, fromFile: string): string | null {
  if (spec.startsWith('@/')) return moduleKey(join(SRC, spec.slice(2)));
  if (spec.startsWith('.')) return moduleKey(resolve(dirname(fromFile), spec));
  return null;
}

/** TSX/TS 를 구문 트리로 */
function parse(path: string, source: string): ts.SourceFile {
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

/**
 * 공용 Badge 를 내보내는 모듈들 — badge.tsx 와, 그것을 다시 내보내는 파일(배럴)을 더 늘지 않을 때까지 따라간다.
 * @param files - 저장소의 파일들
 * @returns 모듈 열쇠 → 내보낸 이름
 */
function badgeExporters(files: readonly { path: string; file: ts.SourceFile }[]): Exporters {
  const exporters: Exporters = new Map([[BADGE_FILE, new Set(['Badge'])]]);
  for (let changed = true; changed;) {
    changed = false;
    for (const { path, file } of files) {
      for (const statement of file.statements) {
        if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
        const from = resolveModule(statement.moduleSpecifier.text, path);
        const names = from ? exporters.get(from) : undefined;
        if (!names) continue;
        const clause = statement.exportClause;
        const exported = !clause ? [...names]
          : ts.isNamedExports(clause)
            ? clause.elements.filter((e) => names.has((e.propertyName ?? e.name).text)).map((e) => e.name.text)
            : [];
        const key = moduleKey(path);
        const mine = exporters.get(key) ?? new Set<string>();
        for (const name of exported) {
          if (!mine.has(name)) { mine.add(name); changed = true; }
        }
        exporters.set(key, mine);
      }
    }
  }
  return exporters;
}

/** 이 파일에서 공용 Badge 를 가리키는 이름 — 낱개로 들여온 이름(별칭 포함)과 묶어 들여온 이름공간 */
function badgeBindings(path: string, file: ts.SourceFile, exporters: Exporters) {
  const names = new Set<string>();
  const namespaces = new Map<string, Set<string>>();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const from = resolveModule(statement.moduleSpecifier.text, path);
    const exported = from ? exporters.get(from) : undefined;
    const bindings = statement.importClause?.namedBindings;
    if (!exported || !bindings) continue;
    if (ts.isNamespaceImport(bindings)) {
      namespaces.set(bindings.name.text, exported);
      continue;
    }
    for (const element of bindings.elements) {
      if (exported.has((element.propertyName ?? element.name).text)) names.add(element.name.text);
    }
  }
  return { names, namespaces };
}

/** className 값 — 글자로 읽을 수 없으면 null */
function literalClassName(attribute: ts.JsxAttribute): string | null {
  const init = attribute.initializer;
  if (!init) return '';
  if (ts.isStringLiteral(init)) return init.text;
  if (!ts.isJsxExpression(init) || !init.expression) return null;
  const expr = init.expression;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  return null;
}

/**
 * 한 파일에서 공용 Badge 의 className 이 배치 밖으로 나간 곳을 찾는다.
 * @param path - 파일 경로(상대 경로 들여오기를 풀 기준)
 * @param source - 글
 * @param exporters - 공용 Badge 를 내보내는 모듈들
 * @returns 어긋난 className 들(글자로 못 읽으면 '<식>', props 펼치기는 '<펼침>')
 */
function badgeClassOffenders(path: string, source: string, exporters: Exporters): string[] {
  const file = parse(path, source);
  const { names, namespaces } = badgeBindings(path, file, exporters);
  if (names.size === 0 && namespaces.size === 0) return [];
  const isBadgeTag = (tag: ts.JsxTagNameExpression) => (ts.isIdentifier(tag) && names.has(tag.text))
    || (ts.isPropertyAccessExpression(tag) && ts.isIdentifier(tag.expression)
      && Boolean(namespaces.get(tag.expression.text)?.has(tag.name.text)));
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && isBadgeTag(node.tagName)) {
      for (const prop of node.attributes.properties) {
        if (ts.isJsxSpreadAttribute(prop)) { out.push('<펼침>'); continue; }
        if (!ts.isIdentifier(prop.name) || prop.name.text !== 'className') continue;
        const value = literalClassName(prop);
        if (value === null) out.push('<식>');
        else if (value.split(/\s+/).filter(Boolean).some((c) => !LAYOUT_CLASS.test(c))) out.push(value);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

/** src 아래 .ts·.tsx 전부(테스트 제외) */
function sourceFiles(): { path: string; file: ts.SourceFile; text: string }[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.') && !f.endsWith('.d.ts'))
    .map((f) => {
      const path = join(SRC, f);
      const text = readFileSync(path, 'utf8');
      return { path, file: parse(path, text), text };
    });
}

/** 짧은 글로 검사 — 문항 은행 폴더의 파일인 셈 친다 */
const FAKE = join(SRC, 'components', 'problem-bank', 'Fake.tsx');
const DIRECT: Exporters = new Map([[BADGE_FILE, new Set(['Badge'])]]);
const IMPORT = `import { Badge } from '@/components/ui/badge';\n`;
const check = (source: string, exporters: Exporters = DIRECT) => badgeClassOffenders(FAKE, source, exporters);

describe('Badge 덮어쓰기 검사', () => {
  it('src 의 모든 공용 Badge 는 className 에 배치만 둔다 — 색·크기·여백은 갈래(variant)로', () => {
    const files = sourceFiles();
    const exporters = badgeExporters(files);
    const offenders: string[] = [];
    for (const { path, text } of files) {
      for (const bad of badgeClassOffenders(path, text, exporters)) offenders.push(`${path.slice(SRC.length + 1)}: ${bad}`);
    }
    expect(offenders).toEqual([]);
  });

  it('들여오는 길이 달라도 공용 Badge 다 — 상대 경로 · 이름공간 · 배럴', () => {
    expect(check(`import { Badge } from '../ui/badge';\n<Badge className="bg-red-500 text-lg pl-8">a</Badge>`)).toHaveLength(1);
    expect(check(`import { Badge } from '../ui/badge.tsx';\n<Badge className="bg-red-500">a</Badge>`)).toHaveLength(1);
    expect(check(`import * as UI from '@/components/ui/badge';\n<UI.Badge className="text-lg">a</UI.Badge>`)).toEqual(['text-lg']);
    // 배럴 — components/ui/index.ts 가 다시 내보내면 '@/components/ui' 로 들여와도 잡는다
    const barrel = { path: join(SRC, 'components', 'ui', 'index.ts'), file: parse('index.ts', `export { Badge } from './badge';\nexport * from './badge';`) };
    const viaBarrel = badgeExporters([barrel]);
    expect(check(`import { Badge } from '@/components/ui';\n<Badge className="bg-sky-500">a</Badge>`, viaBarrel)).toHaveLength(1);
    // 같은 이름이라도 다른 모듈이면 상관하지 않는다
    expect(check(`import { Badge } from '../covers/Badge';\n<Badge className="bg-ink" />`)).toEqual([]);
  });

  it('표기가 달라도 잡는다 — 작은따옴표 · 식 안의 글자 · 템플릿 · 별칭', () => {
    expect(check(`${IMPORT}<Badge className={'bg-amber-500 text-white'}>a</Badge>`)).toHaveLength(1);
    expect(check(`${IMPORT}<Badge className='bg-sky-500'>a</Badge>`)).toHaveLength(1);
    expect(check(`${IMPORT}<Badge className={\`text-[10px]\`}>a</Badge>`)).toHaveLength(1);
    expect(check(`import { Badge as Tag } from '@/components/ui/badge';\n<Tag className="bg-red-50" />`)).toHaveLength(1);
  });

  it('금지 목록이 아니라 허용 목록이다 — 크기·색·안쪽 여백·변형 표기는 다 막힌다', () => {
    for (const cls of ['text-lg', 'text-ink', 'pl-8', 'hover:bg-red-500', 'font-normal', 'border-0', 'md:ml-2']) {
      expect(check(`${IMPORT}<Badge className="${cls}">a</Badge>`)).toEqual([cls]);
    }
  });

  it('글자로 못 읽는 className 과 props 펼치기는 막는다', () => {
    expect(check(`${IMPORT}<Badge className={cn('ml-2', x)}>a</Badge>`)).toEqual(['<식>']);
    expect(check(`${IMPORT}<Badge {...props}>a</Badge>`)).toEqual(['<펼침>']);
  });

  it('배치는 통과한다 — 바깥 여백 · 정렬 · 폭 제한', () => {
    expect(check(`${IMPORT}<Badge className="ml-2 align-middle">a</Badge>`)).toEqual([]);
    expect(check(`${IMPORT}<Badge className="max-w-full -mt-0.5 self-start">a</Badge>`)).toEqual([]);
  });

  it('공용 Badge 를 들여오지 않은 파일의 같은 이름은 상관하지 않는다(표지의 번호 Badge 등)', () => {
    expect(check(`function Badge() { return null }\n<Badge className="bg-ink" />`)).toEqual([]);
  });
});

describe('Badge 갈래', () => {
  it('상태 갈래와 덜 중요한 수 갈래가 있고, 주 꼬리표는 잉크다', () => {
    for (const variant of ['default', 'outline', 'secondary', 'muted', 'ok', 'warn', 'danger', 'info'] as const) {
      expect(badgeVariants({ variant })).toContain('border');
    }
    // 주 꼬리표는 잉크 — 주 단추와 같은 색(0.9.82)
    expect(badgeVariants()).toContain('bg-ink');
    expect(badgeVariants()).toContain('font-tag');
  });
});
