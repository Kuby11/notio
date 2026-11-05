import { describe, expect, it } from 'vitest';
import { type DatabaseProperty, type DatabaseRow } from './database';
import { evaluateFormulaExpression } from './formula';
import { newId } from './ids';

const workspaceId = newId();
const dbId = newId();
const now = new Date().toISOString();

const properties: DatabaseProperty[] = [
  { id: 'title', name: 'Name', type: 'title' },
  { id: 'price', name: 'Price', type: 'number' },
  { id: 'quantity', name: 'Quantity', type: 'number' },
  { id: 'in_stock', name: 'In Stock', type: 'checkbox' },
  { id: 'note', name: 'Note', type: 'text' },
  { id: 'due', name: 'Due', type: 'date' },
  { id: 'tags', name: 'Tags', type: 'multi_select' },
];

const row: DatabaseRow = {
  id: newId(),
  databaseId: dbId,
  workspaceId,
  title: 'Keyboard',
  properties: {
    price: 150,
    quantity: 3,
    in_stock: true,
    note: 'Mechanical',
    due: { start: '2026-11-03' },
    tags: ['office', 'gear'],
  },
  isTrashed: false,
  createdBy: workspaceId,
  createdAt: now,
  updatedAt: now,
};

function evaluate(expression: string): unknown {
  return evaluateFormulaExpression(row, expression, properties);
}

describe('Formula: literals and property lookup', () => {
  it('returns numbers, strings and keywords', () => {
    expect(evaluate('42')).toBe(42);
    expect(evaluate('.5')).toBe(0.5);
    expect(evaluate('"text"')).toBe('text');
    expect(evaluate("'single'")).toBe('single');
    expect(evaluate('"escaped \\"quote\\""')).toBe('escaped "quote"');
    expect(evaluate('true')).toBe(true);
    expect(evaluate('false')).toBe(false);
    expect(evaluate('null')).toBe(null);
  });

  it('resolves properties by name and by id, including the title', () => {
    expect(evaluate('prop("Price")')).toBe(150);
    expect(evaluate('prop("price")')).toBe(150);
    expect(evaluate('prop("Name")')).toBe('Keyboard');
    expect(evaluate('prop("title")')).toBe('Keyboard');
  });

  it('flattens arrays and reads the start of a date', () => {
    expect(evaluate('prop("Tags")')).toBe('office, gear');
    expect(evaluate('prop("Due")')).toBe('2026-11-03');
    expect(evaluate('prop("Note")')).toBe('Mechanical');
  });

  it('returns null for unknown or empty values', () => {
    expect(evaluate('prop("Missing")')).toBe(null);
    expect(evaluate('prop("Unknown id")')).toBe(null);
    expect(evaluate('prop(42)')).toBe(null);
  });
});

describe('Formula: arithmetic', () => {
  it('honours precedence and parentheses', () => {
    expect(evaluate('1 + 2 * 3')).toBe(7);
    expect(evaluate('(1 + 2) * 3')).toBe(9);
    expect(evaluate('10 - 4 - 3')).toBe(3);
    expect(evaluate('7 % 4')).toBe(3);
    expect(evaluate('9 / 2')).toBe(4.5);
  });

  it('applies unary operators', () => {
    expect(evaluate('-5')).toBe(-5);
    expect(evaluate('+"3"')).toBe(3);
    // A bare `!` is not a token: negation is exposed as the `not()` function.
    expect(evaluate('!true')).toBe(null);
    expect(evaluate('not(true)')).toBe(false);
    expect(evaluate('not(null)')).toBe(true);
    expect(evaluate('-"abc"')).toBe(null);
  });

  it('concatenates when either side is text', () => {
    expect(evaluate('prop("Name") + " x2"')).toBe('Keyboard x2');
    expect(evaluate('"total: " + prop("Price")')).toBe('total: 150');
    expect(evaluate('"a" + null')).toBe('a');
  });

  it('returns null for impossible arithmetic', () => {
    expect(evaluate('1 / 0')).toBe(null);
    expect(evaluate('1 % 0')).toBe(null);
    expect(evaluate('prop("Note") - 1')).toBe(null);
    expect(evaluate('true * false')).toBe(0);
  });
});

describe('Formula: comparisons', () => {
  it('compares numbers', () => {
    expect(evaluate('2 > 1')).toBe(true);
    expect(evaluate('2 < 1')).toBe(false);
    expect(evaluate('2 >= 2')).toBe(true);
    expect(evaluate('2 <= 1')).toBe(false);
    expect(evaluate('2 == 2')).toBe(true);
    expect(evaluate('2 = 2')).toBe(true);
    expect(evaluate('2 != 2')).toBe(false);
  });

  it('compares text by ordinal order', () => {
    expect(evaluate('"abc" == "abc"')).toBe(true);
    expect(evaluate('"abc" != "abc"')).toBe(false);
    expect(evaluate('"abc" == "ABC"')).toBe(false);
    expect(evaluate('"abc" > "abb"')).toBe(true);
  });

  it('compares booleans and treats null specially', () => {
    expect(evaluate('true == true')).toBe(true);
    expect(evaluate('true != false')).toBe(true);
    expect(evaluate('true > false')).toBe(true);
    expect(evaluate('null > 1')).toBe(null);
    expect(evaluate('null == 1')).toBe(null);
    expect(evaluate('null != 1')).toBe(true);
  });
});

describe('Formula: functions', () => {
  it('evaluates conditionals and logic', () => {
    expect(evaluate('if(prop("In Stock"), "yes", "no")')).toBe('yes');
    expect(evaluate('if(false, "yes", "no")')).toBe('no');

    // A missing third argument is a null else-branch, not a parse error.
    expect(evaluate('if(false, "yes")')).toBe(null);

    expect(evaluate('and(true, 1, "x")')).toBe(true);
    expect(evaluate('and(true, 0)')).toBe(false);
    expect(evaluate('or(false, "", 0)')).toBe(false);
    expect(evaluate('or(false, "x")')).toBe(true);
    expect(evaluate('not(false)')).toBe(true);
  });

  it('evaluates text helpers', () => {
    expect(evaluate('concat("a", 1, true)')).toBe('a1true');
    expect(evaluate('length("hello")')).toBe(5);
    expect(evaluate('length(null)')).toBe(0);
    expect(evaluate('toLowerCase("ABC")')).toBe('abc');
    expect(evaluate('toUpperCase("abc")')).toBe('ABC');
  });

  it('evaluates numeric helpers', () => {
    expect(evaluate('min(3, 1, 2)')).toBe(1);
    expect(evaluate('max(3, 1, 2)')).toBe(3);
    expect(evaluate('round(2.6)')).toBe(3);
    expect(evaluate('abs(-2.5)')).toBe(2.5);
    expect(evaluate('floor(2.9)')).toBe(2);
    expect(evaluate('ceil(2.1)')).toBe(3);
    expect(evaluate('min("abc")')).toBe(0);
    expect(evaluate('round("abc")')).toBe(null);
    expect(evaluate('abs(null)')).toBe(null);
  });

  it('accepts extra arguments and ignores them', () => {
    expect(evaluate('length("ab", "ignored")')).toBe(2);
  });
});

describe('Formula: invalid input never throws', () => {
  const invalid = [
    '',
    '   ',
    '1 2',
    '(1 + 2',
    '1 +',
    '@',
    '"unterminated',
    'foo()',
    'unknownIdentifier',
    'prop',
    'prop()',
    'prop("a", "b")',
    'constructor()',
    'toString()',
    '1.2.3',
    '1e3',
  ];

  it.each(invalid)('returns null for %j', (expression) => {
    expect(evaluate(expression)).toBe(null);
  });

  it('returns null for a non-finite result', () => {
    expect(evaluate('if(true, 1/0, 2)')).toBe(null);
  });

  it('does not expose the global scope', () => {
    expect(evaluate('this')).toBe(null);
    expect(evaluate('globalThis')).toBe(null);
  });
});
