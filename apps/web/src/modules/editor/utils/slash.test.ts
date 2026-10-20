import { describe, expect, it } from 'vitest';
import {
  SLASH_COMMANDS,
  detectSlashTrigger,
  filterSlashCommands,
  type SlashCommand,
} from './slash';

function ids(commands: SlashCommand[]): string[] {
  return commands.map((command) => command.id);
}

describe('detectSlashTrigger', () => {
  it('распознаёт слэш в начале блока', () => {
    expect(detectSlashTrigger('/')).toEqual({ query: '', from: 0, to: 1 });
    expect(detectSlashTrigger('/h1')).toEqual({ query: 'h1', from: 0, to: 3 });
  });

  it('распознаёт слэш после пробела или переноса строки', () => {
    expect(detectSlashTrigger('hello /')).toEqual({ query: '', from: 6, to: 7 });
    expect(detectSlashTrigger('hello /head')).toEqual({ query: 'head', from: 6, to: 11 });
    expect(detectSlashTrigger('first\n/')).toEqual({ query: '', from: 6, to: 7 });
  });

  it('не открывает меню внутри слова, URL или после пробела в запросе', () => {
    expect(detectSlashTrigger('foo/bar')).toBeNull();
    expect(detectSlashTrigger('https://example.com')).toBeNull();
    expect(detectSlashTrigger('/head ')).toBeNull();
    expect(detectSlashTrigger('//')).toBeNull();
  });
});

describe('filterSlashCommands', () => {
  it('без запроса возвращает все команды в заданном порядке', () => {
    expect(ids(filterSlashCommands(''))).toEqual([
      'text',
      'heading1',
      'heading2',
      'heading3',
      'heading4',
      'toggle',
      'numberedList',
      'checkList',
      'bulletedList',
    ]);
  });

  it('находит команды по латинским сокращениям Notion', () => {
    expect(ids(filterSlashCommands('h1'))[0]).toBe('heading1');
    expect(ids(filterSlashCommands('todo'))[0]).toBe('checkList');
    expect(ids(filterSlashCommands('bullet'))[0]).toBe('bulletedList');
    expect(ids(filterSlashCommands('num'))[0]).toBe('numberedList');
    expect(ids(filterSlashCommands('toggle'))[0]).toBe('toggle');
  });

  it('находит команды по русским названиям и markdown-символам', () => {
    expect(ids(filterSlashCommands('задача'))[0]).toBe('checkList');
    expect(ids(filterSlashCommands('##'))[0]).toBe('heading2');
    expect(ids(filterSlashCommands('[]'))[0]).toBe('checkList');
    expect(ids(filterSlashCommands('>'))[0]).toBe('toggle');
  });

  it('возвращает пустой список, если совпадений нет', () => {
    expect(filterSlashCommands('zzz')).toEqual([]);
  });

  it('показывает markdown-символы для всех команд, кроме текста', () => {
    expect(SLASH_COMMANDS.map((command) => command.markdown)).toEqual([
      null,
      '#',
      '##',
      '###',
      '####',
      '>',
      '1.',
      '[]',
      '-',
    ]);
  });
});
