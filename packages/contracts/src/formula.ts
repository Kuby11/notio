import type { DatabaseProperty, DatabaseRow } from './database';

/**
 * A formula value: the subset of types a database cell can hold.
 * Anything the evaluator cannot reduce to these becomes `null`.
 */
export type FormulaValue = string | number | boolean | null;

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'identifier'; value: string }
  | { kind: 'operator'; value: string }
  | { kind: 'punctuation'; value: string };

const QUOTES = new Set(['"', "'"]);
const PUNCTUATION = new Set(['(', ')', ',']);
const WHITESPACE = /\s/u;
const DIGIT = /[0-9]/u;
const IDENTIFIER_START = /[A-Za-z_]/u;
const IDENTIFIER_PART = /[A-Za-z0-9_]/u;
const NUMBER_PART = /[0-9.]/u;

/**
 * Multi-character operators come first: `>=` must not tokenize as `>` and `=`.
 */
const OPERATORS = ['>=', '<=', '==', '!=', '>', '<', '+', '-', '*', '/', '%', '='] as const;

const KEYWORDS: Record<string, FormulaValue> = {
  true: true,
  false: false,
  null: null,
};

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index] ?? '';

    if (WHITESPACE.test(char)) {
      index += 1;
      continue;
    }

    if (QUOTES.has(char)) {
      const quote = char;
      let value = '';
      let closed = false;
      index += 1;

      while (index < source.length) {
        const current = source[index] ?? '';

        if (current === '\\' && index + 1 < source.length) {
          value += source[index + 1] ?? '';
          index += 2;
          continue;
        }

        if (current === quote) {
          index += 1;
          closed = true;
          break;
        }

        value += current;
        index += 1;
      }

      if (!closed) {
        throw new Error('Unterminated string literal');
      }

      tokens.push({ kind: 'string', value });
      continue;
    }

    if (DIGIT.test(char) || (char === '.' && DIGIT.test(source[index + 1] ?? ''))) {
      let raw = '';

      while (index < source.length && NUMBER_PART.test(source[index] ?? '')) {
        raw += source[index];
        index += 1;
      }

      const value = Number(raw);

      if (!Number.isFinite(value)) {
        throw new Error('Invalid number literal');
      }

      tokens.push({ kind: 'number', value });
      continue;
    }

    if (IDENTIFIER_START.test(char)) {
      let raw = '';

      while (index < source.length && IDENTIFIER_PART.test(source[index] ?? '')) {
        raw += source[index];
        index += 1;
      }

      tokens.push({ kind: 'identifier', value: raw });
      continue;
    }

    const operator = OPERATORS.find((candidate) => source.startsWith(candidate, index));

    if (operator !== undefined) {
      tokens.push({ kind: 'operator', value: operator });
      index += operator.length;
      continue;
    }

    if (PUNCTUATION.has(char)) {
      tokens.push({ kind: 'punctuation', value: char });
      index += 1;
      continue;
    }

    throw new Error(`Unexpected character: ${char}`);
  }

  return tokens;
}

function textOf(value: FormulaValue): string {
  if (value === null) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

function numberOf(value: FormulaValue): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function truthy(value: FormulaValue): boolean {
  if (value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.length > 0;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return value;
}

/** A stable text form for comparison: numbers compare numerically, everything else as text. */
function compare(a: FormulaValue, b: FormulaValue): number | null {
  if (a === null || b === null) {
    return null;
  }

  const left = numberOf(a);
  const right = numberOf(b);

  if (left !== null && right !== null && typeof a !== 'string' && typeof b !== 'string') {
    return left < right ? -1 : left > right ? 1 : 0;
  }

  const textA = textOf(a);
  const textB = textOf(b);

  return textA < textB ? -1 : textA > textB ? 1 : 0;
}

interface FunctionDefinition {
  /** Minimum number of arguments; extra arguments are ignored. */
  arity: number;
  call: (args: FormulaValue[]) => FormulaValue;
}

/**
 * The evaluator.
 *
 * The expression is parsed with a small recursive-descent parser and evaluated
 * against the row. No source is ever handed to `Function`/`eval`, so a formula
 * cannot reach the page's globals, cookies or storage — the only identifiers it
 * can use are the functions below, `prop()`, `true`, `false` and `null`.
 *
 * Unknown identifiers and malformed expressions throw; the public entry point
 * turns that into `null`, which the UI renders as an empty cell.
 */
class FormulaEvaluator {
  private position = 0;

  private readonly functions: Record<string, FunctionDefinition>;

  constructor(
    private readonly tokens: Token[],
    private readonly resolveProperty: (name: string) => FormulaValue,
  ) {
    this.functions = {
      prop: {
        arity: 1,
        call: ([name]) => this.resolveProperty(textOf(name ?? null)),
      },
      if: {
        arity: 3,
        call: ([condition, thenValue, elseValue]) =>
          truthy(condition ?? null) ? (thenValue ?? null) : (elseValue ?? null),
      },
      and: {
        arity: 1,
        call: (args) => args.every((value) => truthy(value)),
      },
      or: {
        arity: 1,
        call: (args) => args.some((value) => truthy(value)),
      },
      not: {
        arity: 1,
        call: ([value]) => !truthy(value ?? null),
      },
      concat: {
        arity: 1,
        call: (args) => args.map((value) => textOf(value)).join(''),
      },
      min: {
        arity: 1,
        call: (args) => Math.min(...args.map((value) => numberOf(value) ?? 0)),
      },
      max: {
        arity: 1,
        call: (args) => Math.max(...args.map((value) => numberOf(value) ?? 0)),
      },
      round: {
        arity: 1,
        call: ([value]) => {
          const numeric = numberOf(value ?? null);
          return numeric === null ? null : Math.round(numeric);
        },
      },
      abs: {
        arity: 1,
        call: ([value]) => {
          const numeric = numberOf(value ?? null);
          return numeric === null ? null : Math.abs(numeric);
        },
      },
      floor: {
        arity: 1,
        call: ([value]) => {
          const numeric = numberOf(value ?? null);
          return numeric === null ? null : Math.floor(numeric);
        },
      },
      ceil: {
        arity: 1,
        call: ([value]) => {
          const numeric = numberOf(value ?? null);
          return numeric === null ? null : Math.ceil(numeric);
        },
      },
      length: {
        arity: 1,
        call: ([value]) => textOf(value ?? null).length,
      },
      toLowerCase: {
        arity: 1,
        call: ([value]) => textOf(value ?? null).toLowerCase(),
      },
      toUpperCase: {
        arity: 1,
        call: ([value]) => textOf(value ?? null).toUpperCase(),
      },
    };
  }

  parse(): FormulaValue {
    if (this.tokens.length === 0) {
      throw new Error('Empty expression');
    }

    const value = this.parseComparison();

    if (this.position < this.tokens.length) {
      throw new Error('Unexpected trailing tokens');
    }

    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private isOperator(...values: string[]): boolean {
    const token = this.peek();

    return token?.kind === 'operator' && values.includes(token.value);
  }

  private isPunctuation(value: string): boolean {
    const token = this.peek();

    return token?.kind === 'punctuation' && token.value === value;
  }

  private parseComparison(): FormulaValue {
    const left = this.parseAdditive();

    if (!this.isOperator('>', '<', '>=', '<=', '==', '=', '!=')) {
      return left;
    }

    const operator = (this.peek() as { value: string }).value;
    this.position += 1;

    const right = this.parseAdditive();
    const order = compare(left, right);

    if (operator === '!=') {
      return order !== 0;
    }

    if (order === null) {
      return null;
    }

    switch (operator) {
      case '>':
        return order > 0;
      case '<':
        return order < 0;
      case '>=':
        return order >= 0;
      case '<=':
        return order <= 0;
      default:
        return order === 0;
    }
  }

  private parseAdditive(): FormulaValue {
    let left = this.parseMultiplicative();

    while (this.isOperator('+', '-')) {
      const operator = (this.peek() as { value: string }).value;
      this.position += 1;

      const right = this.parseMultiplicative();

      if (operator === '-') {
        const a = numberOf(left);
        const b = numberOf(right);
        left = a === null || b === null ? null : a - b;
        continue;
      }

      // `+` concatenates when either side is text, exactly like the previous
      // JS-backed evaluator: a blank property becomes an empty string.
      if (typeof left === 'string' || typeof right === 'string') {
        left = textOf(left) + textOf(right);
      } else {
        const a = numberOf(left);
        const b = numberOf(right);
        left = a === null || b === null ? null : a + b;
      }
    }

    return left;
  }

  private parseMultiplicative(): FormulaValue {
    let left = this.parseUnary();

    while (this.isOperator('*', '/', '%')) {
      const operator = (this.peek() as { value: string }).value;
      this.position += 1;

      const right = this.parseUnary();
      const a = numberOf(left);
      const b = numberOf(right);

      if (a === null || b === null) {
        left = null;
        continue;
      }

      if (operator === '*') {
        left = a * b;
      } else if (operator === '/') {
        left = b === 0 ? null : a / b;
      } else {
        left = b === 0 ? null : a % b;
      }
    }

    return left;
  }

  private parseUnary(): FormulaValue {
    if (this.isOperator('-', '+', '!')) {
      const operator = (this.peek() as { value: string }).value;
      this.position += 1;

      const operand = this.parseUnary();

      if (operator === '!') {
        return !truthy(operand);
      }

      const numeric = numberOf(operand);

      if (numeric === null) {
        return null;
      }

      return operator === '-' ? -numeric : numeric;
    }

    return this.parsePrimary();
  }

  private parsePrimary(): FormulaValue {
    const token = this.peek();

    if (token === undefined) {
      throw new Error('Unexpected end of expression');
    }

    if (token.kind === 'number' || token.kind === 'string') {
      this.position += 1;
      return token.value;
    }

    if (token.kind === 'identifier') {
      this.position += 1;
      return this.parseIdentifier(token.value);
    }

    if (token.kind === 'punctuation' && token.value === '(') {
      this.position += 1;
      const value = this.parseComparison();

      if (!this.isPunctuation(')')) {
        throw new Error('Missing closing parenthesis');
      }

      this.position += 1;
      return value;
    }

    throw new Error(`Unexpected token: ${token.value}`);
  }

  private parseIdentifier(name: string): FormulaValue {
    if (this.isPunctuation('(')) {
      return this.callFunction(name);
    }

    if (Object.hasOwn(KEYWORDS, name)) {
      return KEYWORDS[name] ?? null;
    }

    throw new Error(`Unknown identifier: ${name}`);
  }

  private callFunction(name: string): FormulaValue {
    // `prop` is matched case-sensitively like every other function; the lookup
    // is on a null-prototype object so `constructor` cannot resolve to anything.
    const definition = Object.hasOwn(this.functions, name) ? this.functions[name] : undefined;

    if (definition === undefined) {
      throw new Error(`Unknown function: ${name}`);
    }

    this.position += 1;

    const args: FormulaValue[] = [];

    if (!this.isPunctuation(')')) {
      for (;;) {
        args.push(this.parseComparison());

        if (!this.isPunctuation(',')) {
          break;
        }

        this.position += 1;
      }
    }

    if (!this.isPunctuation(')')) {
      throw new Error('Missing closing parenthesis');
    }

    this.position += 1;

    if (args.length < definition.arity) {
      throw new Error(`Function ${name} expects ${definition.arity} argument(s)`);
    }

    return definition.call(args);
  }
}

/**
 * Evaluates a Notion-like formula against one row.
 *
 * Supported syntax:
 * - `prop("Property Name")` / `prop("propertyId")`
 * - Arithmetic `+ - * / %`, unary minus, comparisons `> < >= <= == !=`
 * - `if(cond, thenValue, elseValue)`, `and(...)`, `or(...)`, `not(...)`
 * - `concat(...)`, `min`, `max`, `round`, `abs`, `floor`, `ceil`
 * - `length`, `toLowerCase`, `toUpperCase`
 *
 * Returns `null` for an empty cell, an unknown property or an invalid
 * expression, so a bad formula never breaks the table it is rendered in.
 */
export function evaluateFormulaExpression(
  row: DatabaseRow,
  expression: string,
  properties: DatabaseProperty[],
): FormulaValue {
  try {
    const byName = new Map<string, DatabaseProperty>();

    for (const property of properties) {
      byName.set(property.name, property);
      byName.set(property.id, property);
    }

    const tokens = tokenize(expression);

    const evaluator = new FormulaEvaluator(tokens, (name) => {
      const property = byName.get(name);

      if (property === undefined) {
        return null;
      }

      const value =
        property.id === 'title' || property.type === 'title'
          ? row.title
          : row.properties[property.id];

      if (value === null || value === undefined) {
        return null;
      }

      if (Array.isArray(value)) {
        return value.join(', ');
      }

      if (typeof value === 'object') {
        // Date values hold `{ start, end }`: the start is the comparable part.
        return 'start' in value ? (value.start ?? null) : textOf(null);
      }

      return value;
    });

    const result = evaluator.parse();

    if (typeof result === 'number' && !Number.isFinite(result)) {
      return null;
    }

    return result;
  } catch {
    return null;
  }
}
