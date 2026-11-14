import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { badgeVariants } from './badge';

/**
 * 꼬리표가 화면마다 갈라지지 않게 지킨다(2026-11-13 — 원장님 "OMR 이나 이런 뱃지들이 다 옛날 느낌이야").
 * 예전에는 쓰는 곳마다 `bg-amber-500 text-white`·`bg-sky-500`·`text-[10px]` 를 덮어 꼬리표가 제각각이었다.
 * 색·크기·여백은 갈래(variant)로만 고르고, className 에는 **배치**(바깥 여백·정렬·폭 제한)만 둔다.
 *
 * ⚠️ 어떤 `<태그>` 가 공용 Badge 인지는 **TypeScript 타입 검사기에 묻는다** — 태그의 기호를 별칭(들여오기·다시 내보내기·
 *    기본 내보내기·이름공간·`const Tag = Badge`)을 따라 끝까지 풀고, 안 되면 태그의 타입(호출 시그니처의 선언)이 badge.tsx 의
 *    `Badge` 함수인지 본다(구조 분해·괄호·`as` 로 이름을 바꿔 담은 경우, 코덱스 4R).
 *    정규식(코덱스 1R)이나 손으로 짠 경로 풀기(코덱스 2·3R — 상대 경로, 배럴의 `export { Badge }`·`export * as`·기본 내보내기를
 *    차례로 놓쳤다)로 되돌리지 말 것. 저장소 전체를 여는 데 1초쯤이다.
 * ⚠️ 클래스는 **허용 목록**(배치)에 든 것만 통과한다 — 금지 목록은 `text-lg`·`pl-8`·`hover:bg-…` 처럼 빠진 것이 늘 남는다.
 *    글자로 못 읽는 className(`cn(…)`·변수)과 props 펼치기도 막는다.
 */

const ROOT = join(__dirname, '..', '..', '..');
const SRC = join(ROOT, 'src');
const BADGE_PATH = join(SRC, 'components', 'ui', 'badge.tsx');

/** 허용하는 배치 유틸리티 — 앞에 변형(`hover:`·`md:` 등)이 붙으면 안 된다 */
const LAYOUT_CLASS = /^(?:-?m[trblxy]?-[\w.[\]/-]+|align-[\w-]+|self-[\w-]+|order-[\w-]+|max-w-[\w.[\]/-]+|min-w-0|shrink(?:-0)?|grow(?:-0)?)$/;

/** 저장소 tsconfig 의 컴파일 설정(`@/` 별칭 포함) */
function compilerOptions(): ts.CompilerOptions {
  const config = ts.readConfigFile(join(ROOT, 'tsconfig.json'), ts.sys.readFile);
  return ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT).options;
}

/**
 * 프로그램을 만든다 — `virtual` 의 파일은 디스크 대신 그 글로 읽는다(짧은 글로 검사할 때).
 * @param rootNames - 시작 파일들
 * @param virtual - 경로 → 글
 * @returns 프로그램
 */
function makeProgram(rootNames: readonly string[], virtual: ReadonlyMap<string, string> = new Map()): ts.Program {
  const options = compilerOptions();
  const host = ts.createCompilerHost(options, true);
  const { fileExists, readFile, getSourceFile } = host;
  host.fileExists = (f) => virtual.has(f) || fileExists.call(host, f);
  host.readFile = (f) => virtual.get(f) ?? readFile.call(host, f);
  host.getSourceFile = (f, lang, onError, create) => {
    const text = virtual.get(f);
    return text !== undefined ? ts.createSourceFile(f, text, lang, true) : getSourceFile.call(host, f, lang, onError, create);
  };
  return ts.createProgram({ rootNames: [...rootNames, ...virtual.keys()], options, host });
}

/** 기호가 가리키는 끝 — 별칭과 `const Tag = Badge` 를 따라간다 */
function finalSymbol(checker: ts.TypeChecker, start: ts.Symbol | undefined): ts.Symbol | undefined {
  let symbol = start;
  for (let hop = 0; symbol && hop < 20; hop += 1) {
    if (symbol.flags & ts.SymbolFlags.Alias) {
      symbol = checker.getAliasedSymbol(symbol);
      continue;
    }
    const decl = symbol.valueDeclaration;
    const init = decl && ts.isVariableDeclaration(decl) ? decl.initializer : undefined;
    if (init && (ts.isIdentifier(init) || ts.isPropertyAccessExpression(init))) {
      symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(init) ? init.name : init);
      continue;
    }
    break;
  }
  return symbol;
}

/** badge.tsx 의 `Badge` 함수 선언인가 */
function declaresBadge(decl: ts.Declaration | undefined): boolean {
  return Boolean(decl && resolve(decl.getSourceFile().fileName) === BADGE_PATH
    && ts.isFunctionDeclaration(decl) && decl.name?.text === 'Badge');
}

/**
 * 이 태그가 공용 Badge(badge.tsx 의 `Badge` 함수)인가.
 *
 * 먼저 기호를 별칭 따라 풀고(들여오기·다시 내보내기·기본·이름공간), 안 되면 **태그의 타입**을 본다 — 구조 분해
 * (`const { Badge: Tag } = UI`)·괄호(`const Tag = (Badge)`)·`as` 처럼 이름을 바꿔 담아도 타입은 Badge 함수 그 자체라
 * 호출 시그니처의 선언이 badge.tsx 의 `Badge` 다(코덱스 4R).
 */
function isSharedBadge(checker: ts.TypeChecker, tag: ts.JsxTagNameExpression): boolean {
  // 내장 태그(div·span …)는 소문자 이름이다
  if (ts.isIdentifier(tag) && /^[a-z]/.test(tag.text)) return false;
  const at = ts.isPropertyAccessExpression(tag) ? tag.name : tag;
  const symbol = finalSymbol(checker, checker.getSymbolAtLocation(at));
  if (symbol?.declarations?.some(declaresBadge)) return true;
  return checker.getTypeAtLocation(tag).getCallSignatures().some((sig) => declaresBadge(sig.getDeclaration()));
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
 * @param program - 그 파일이 든 프로그램
 * @param fileName - 파일 경로
 * @returns 찾은 공용 Badge 수와 어긋난 className 들(글자로 못 읽으면 '<식>', props 펼치기는 '<펼침>')
 */
function scanBadges(program: ts.Program, fileName: string): { found: number; offenders: string[] } {
  const file = program.getSourceFile(fileName);
  if (!file) throw new Error(`프로그램에 없는 파일: ${fileName}`);
  const checker = program.getTypeChecker();
  const out: string[] = [];
  let found = 0;
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && isSharedBadge(checker, node.tagName)) {
      found += 1;
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
  return { found, offenders: out };
}

/** src 아래 화면 파일 전부(테스트 제외) */
function srcTsxFiles(): string[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
    .map((f) => join(SRC, f));
}

/** 짧은 글 검사용 가짜 파일들 — 실제 폴더 자리에 둔 셈 친다(상대 경로를 풀려고) */
const UI = join(SRC, 'components', 'ui');
const BANK = join(SRC, 'components', 'problem-bank');
const IMPORT = `import { Badge } from '@/components/ui/badge';\n`;
const PROBES: Record<string, { source: string; want: string[] }> = {
  relative: { source: `import { Badge } from '../ui/badge';\nexport const A = () => <Badge className="bg-red-500 text-lg pl-8">a</Badge>;`, want: ['bg-red-500 text-lg pl-8'] },
  namespace: { source: `import * as UI from '@/components/ui/badge';\nexport const A = () => <UI.Badge className="text-lg">a</UI.Badge>;`, want: ['text-lg'] },
  barrelLocal: { source: `import { Badge } from '@/components/ui/zz-barrel-local';\nexport const A = () => <Badge className="bg-sky-500">a</Badge>;`, want: ['bg-sky-500'] },
  barrelNamespace: { source: `import { UI } from '@/components/ui/zz-barrel-ns';\nexport const A = () => <UI.Badge className="text-lg">a</UI.Badge>;`, want: ['text-lg'] },
  barrelDefault: { source: `import Tag from '@/components/ui/zz-barrel-default';\nexport const A = () => <Tag className="bg-red-50">a</Tag>;`, want: ['bg-red-50'] },
  barrelStar: { source: `import { Badge } from '@/components/ui/zz-barrel-star';\nexport const A = () => <Badge className="pl-8">a</Badge>;`, want: ['pl-8'] },
  variableAlias: { source: `${IMPORT}const Tag = Badge;\nexport const A = () => <Tag className="bg-red-50">a</Tag>;`, want: ['bg-red-50'] },
  destructure: { source: `import * as UI from '@/components/ui/badge';\nconst { Badge: Tag } = UI;\nexport const A = () => <Tag className="bg-red-500" />;`, want: ['bg-red-500'] },
  parenthesized: { source: `${IMPORT}const Tag = (Badge);\nexport const A = () => <Tag className="bg-red-500" />;`, want: ['bg-red-500'] },
  asCast: { source: `${IMPORT}const Tag = Badge as typeof Badge;\nexport const A = () => <Tag className="text-lg" />;`, want: ['text-lg'] },
  importAlias: { source: `import { Badge as Tag } from '@/components/ui/badge';\nexport const A = () => <Tag className="bg-red-50" />;`, want: ['bg-red-50'] },
  quoting: {
    source: `${IMPORT}export const A = () => <><Badge className={'bg-amber-500 text-white'}>a</Badge><Badge className='bg-sky-500'>b</Badge><Badge className={\`text-[10px]\`}>c</Badge></>;`,
    want: ['bg-amber-500 text-white', 'bg-sky-500', 'text-[10px]'],
  },
  allowList: {
    source: `${IMPORT}export const A = () => <>${['text-lg', 'text-ink', 'pl-8', 'hover:bg-red-500', 'font-normal', 'border-0', 'md:ml-2'].map((c) => `<Badge className="${c}">a</Badge>`).join('')}</>;`,
    want: ['text-lg', 'text-ink', 'pl-8', 'hover:bg-red-500', 'font-normal', 'border-0', 'md:ml-2'],
  },
  dynamic: { source: `${IMPORT}declare const cn: (...a: unknown[]) => string;\ndeclare const props: object;\nexport const A = () => <><Badge className={cn('ml-2')}>a</Badge><Badge {...props}>b</Badge></>;`, want: ['<식>', '<펼침>'] },
  layout: { source: `${IMPORT}export const A = () => <><Badge className="ml-2 align-middle">a</Badge><Badge className="max-w-full -mt-0.5 self-start">b</Badge></>;`, want: [] },
  localSameName: { source: `function Badge(p: { className?: string }) { return <span {...p} />; }\nexport const A = () => <Badge className="bg-ink" />;`, want: [] },
  otherModuleSameName: { source: `import { Badge } from './zz-other-badge';\nexport const A = () => <Badge className="bg-ink" />;`, want: [] },
};
const VIRTUAL = new Map<string, string>([
  ...Object.entries(PROBES).map(([name, probe]) => [join(BANK, `zz-probe-${name}.tsx`), probe.source] as [string, string]),
  [join(UI, 'zz-barrel-local.ts'), `import { Badge } from './badge';\nexport { Badge };\n`],
  [join(UI, 'zz-barrel-ns.ts'), `export * as UI from './badge';\n`],
  [join(UI, 'zz-barrel-default.ts'), `export { Badge as default } from './badge';\n`],
  [join(UI, 'zz-barrel-star.ts'), `export * from './badge';\n`],
  [join(BANK, 'zz-other-badge.tsx'), `export function Badge(p: { className?: string }) { return <span {...p} />; }\n`],
]);

describe('Badge 덮어쓰기 검사', () => {
  it('src 의 모든 공용 Badge 는 className 에 배치만 둔다 — 색·크기·여백은 갈래(variant)로', () => {
    const files = srcTsxFiles();
    const program = makeProgram(files);
    const scans = files.map((f) => ({ f, ...scanBadges(program, f) }));
    const offenders = scans.flatMap(({ f, offenders: bad }) => bad.map((b) => `${f.slice(SRC.length + 1)}: ${b}`));
    expect(offenders).toEqual([]);
    // 헛통과 막기 — 경로 풀기가 조용히 실패하면 공용 Badge 를 하나도 못 찾고 통과한다(2026-11-14 운영 코드 34곳)
    expect(scans.reduce((n, s) => n + s.found, 0)).toBeGreaterThanOrEqual(30);
  }, 60_000);

  it('들여오는 길·표기가 달라도 공용 Badge 면 잡고, 이름만 같은 다른 것은 놔둔다', () => {
    const program = makeProgram([], VIRTUAL);
    for (const [name, probe] of Object.entries(PROBES)) {
      expect({ name, got: scanBadges(program, join(BANK, `zz-probe-${name}.tsx`)).offenders }).toEqual({ name, got: probe.want });
    }
  }, 60_000);
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
