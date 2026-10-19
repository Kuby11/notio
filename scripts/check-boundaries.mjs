#!/usr/bin/env node
/**
 * Проверка границ фронтенд-архитектуры (apps/web).
 *
 * Правила (см. .agents/AGENTS.md):
 *  1. shared не импортирует modules/core/app.
 *  2. Внешний код обращается к модулю только через `modules/<модуль>` (index.ts):
 *     глубокие импорты (hooks, stores, api, types, utils, ui) запрещены.
 *  3. stores и api модуля доступны только внутри этого же модуля.
 *  4. api не тянет React, TanStack Query, Zustand, core и stores: только
 *     сырые вызовы и чистые хелперы.
 *
 * Скрипт не резолвит файл на диск — сравнивает нормализованные пути импортов.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(process.cwd(), 'apps/web');
const SRC = join(ROOT, 'src');
const staticImportPattern = /from\s+['"]([^'"]+)['"]/gu;
const dynamicImportPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/gu;

/** Собирает все .ts/.tsx файлы под каталогом. */
function collectFiles(dir) {
  const result = [];

  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') {
      continue;
    }

    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      result.push(...collectFiles(path));
    } else if (/\.(?:ts|tsx)$/u.test(entry)) {
      result.push(path);
    }
  }

  return result;
}

/** Нормализует specifier в абсолютный путь внутри репозитория (или null). */
function resolveSpecifier(fromFile, specifier) {
  if (specifier.startsWith('@/')) {
    return join(SRC, specifier.slice(2));
  }

  if (specifier.startsWith('.')) {
    return resolve(dirname(fromFile), specifier);
  }

  return null;
}

/** `apps/web/src/modules/pages/api/x.ts` -> { module: 'pages', rest: 'api/x.ts' } */
function moduleOf(absolutePath) {
  const relativePath = relative(SRC, absolutePath).split('\\').join('/');

  if (!relativePath.startsWith('modules/')) {
    return null;
  }

  const [, name, ...rest] = relativePath.split('/');

  return { name, rest: rest.join('/') };
}

function rel(path) {
  return relative(process.cwd(), path).split('\\').join('/');
}

const violations = [];
const files = [...collectFiles(SRC), ...collectFiles(join(ROOT, 'test'))];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const specifiers = [
    ...[...source.matchAll(staticImportPattern)].map((match) => match[1]),
    ...[...source.matchAll(dynamicImportPattern)].map((match) => match[1]),
  ].filter((specifier) => specifier !== undefined);

  const fromRel = rel(file);
  const fromModule = moduleOf(file);
  const isShared = fromRel.startsWith('apps/web/src/shared/');
  const isApi = fromModule !== null && fromModule.rest.startsWith('api/');

  for (const specifier of specifiers) {
    const target = resolveSpecifier(file, specifier);

    if (target === null) {
      continue;
    }

    const targetRel = relative(SRC, target).split('\\').join('/');
    const targetModule = moduleOf(target);

    // 1. shared не знает про modules/core/app.
    if (isShared && (targetModule !== null || targetRel.startsWith('core/'))) {
      violations.push(`${fromRel}: shared не может импортировать ${specifier}`);
    }

    // 2-3. Глубокие импорты модуля — только из самого модуля.
    if (targetModule !== null && targetModule.rest !== '' && targetModule.rest !== 'index') {
      if (fromModule === null || fromModule.name !== targetModule.name) {
        violations.push(`${fromRel}: глубокий импорт модуля запрещён: ${specifier}`);
      }
    }

    // 4. api — только сырые вызовы: без React, Query, Zustand и core.
    if (isApi) {
      const bannedPackages = ['react', 'react-dom', '@tanstack/react-query', 'zustand'];
      const bannedPackage = bannedPackages.some(
        (name) => specifier === name || specifier.startsWith(`${name}/`),
      );

      if (bannedPackage || targetRel.startsWith('core/') || targetRel.includes('/stores/')) {
        violations.push(`${fromRel}: api не может зависеть от UI/состояния: ${specifier}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Нарушения границ архитектуры (apps/web):\n');
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  console.error(`\nВсего нарушений: ${violations.length}`);
  process.exit(1);
}

console.log('Границы архитектуры apps/web соблюдены.');
