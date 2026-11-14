import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
const BADGE_MODULE = '@/components/ui/badge';

/** 허용하는 배치 유틸리티 — 앞에 변형(`hover:` 등)이 붙으면 안 된다 */
const LAYOUT_CLASS = /^(?:-?m[trblxy]?-[\w.[\]/-]+|align-[\w-]+|self-[\w-]+|order-[\w-]+|max-w-[\w.[\]/-]+|min-w-0|shrink(?:-0)?|grow(?:-0)?)$/;

/** 이 파일에서 공용 Badge 를 들여온 이름들(별칭 포함) */
function badgeNames(file: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== BADGE_MODULE) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if ((element.propertyName ?? element.name).text === 'Badge') names.add(element.name.text);
    }
  }
  return names;
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
 * @param source - TSX 글
 * @returns 어긋난 className 들(글자로 못 읽으면 '<식>')
 */
function badgeClassOffenders(source: string): string[] {
  const file = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = badgeNames(file);
  if (names.size === 0) return [];
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && ts.isIdentifier(node.tagName) && names.has(node.tagName.text)) {
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

/** src 아래 .tsx 전부(테스트 제외) */
function tsxFiles(): string[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
    .map((f) => join(SRC, f));
}

const IMPORT = `import { Badge } from '${BADGE_MODULE}';\n`;

describe('Badge 덮어쓰기 검사', () => {
  it('src 의 모든 공용 Badge 는 className 에 배치만 둔다 — 색·크기·여백은 갈래(variant)로', () => {
    const offenders: string[] = [];
    for (const file of tsxFiles()) {
      for (const bad of badgeClassOffenders(readFileSync(file, 'utf8'))) offenders.push(`${file.slice(SRC.length + 1)}: ${bad}`);
    }
    expect(offenders).toEqual([]);
  });

  it('표기가 달라도 잡는다 — 작은따옴표 · 식 안의 글자 · 템플릿 · 별칭', () => {
    expect(badgeClassOffenders(`${IMPORT}<Badge className={'bg-amber-500 text-white'}>a</Badge>`)).toHaveLength(1);
    expect(badgeClassOffenders(`${IMPORT}<Badge className='bg-sky-500'>a</Badge>`)).toHaveLength(1);
    expect(badgeClassOffenders(`${IMPORT}<Badge className={\`text-[10px]\`}>a</Badge>`)).toHaveLength(1);
    expect(badgeClassOffenders(`import { Badge as Tag } from '${BADGE_MODULE}';\n<Tag className="bg-red-50" />`)).toHaveLength(1);
  });

  it('금지 목록이 아니라 허용 목록이다 — 크기·색·안쪽 여백·변형 표기는 다 막힌다', () => {
    for (const cls of ['text-lg', 'text-ink', 'pl-8', 'hover:bg-red-500', 'font-normal', 'border-0', 'md:ml-2']) {
      expect(badgeClassOffenders(`${IMPORT}<Badge className="${cls}">a</Badge>`)).toEqual([cls]);
    }
  });

  it('글자로 못 읽는 className 과 props 펼치기는 막는다', () => {
    expect(badgeClassOffenders(`${IMPORT}<Badge className={cn('ml-2', x)}>a</Badge>`)).toEqual(['<식>']);
    expect(badgeClassOffenders(`${IMPORT}<Badge {...props}>a</Badge>`)).toEqual(['<펼침>']);
  });

  it('배치는 통과한다 — 바깥 여백 · 정렬 · 폭 제한', () => {
    expect(badgeClassOffenders(`${IMPORT}<Badge className="ml-2 align-middle">a</Badge>`)).toEqual([]);
    expect(badgeClassOffenders(`${IMPORT}<Badge className="max-w-full -mt-0.5 self-start">a</Badge>`)).toEqual([]);
  });

  it('공용 Badge 를 들여오지 않은 파일의 같은 이름은 상관하지 않는다(표지의 번호 Badge 등)', () => {
    expect(badgeClassOffenders(`function Badge() { return null }\n<Badge className="bg-ink" />`)).toEqual([]);
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
