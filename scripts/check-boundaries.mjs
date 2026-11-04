#!/usr/bin/env node
/**
 * Frontend architecture boundary check (apps/web).
 *
 * Rules (see .agents/AGENTS.md):
 *  1. shared never imports modules/core/app.
 *  2. Outside code reaches a module only through `modules/<module>` (index.ts):
 *     deep imports (hooks, stores, api, types, utils, ui) are forbidden.
 *  3. A module's stores and api are visible only inside that module.
 *  4. api must not pull in React, TanStack Query, Zustand, core or stores:
 *     only raw calls and pure helpers.
 *  5. A module's ui folder holds no hooks or stores: ui is components only.
 *  6. Hooks: one exported hook per file, and every module has its facade
 *     hooks/use-<module>.ts. Large facades may be split across hook files.
 *  7. TanStack Query keys live only in utils/query-keys.ts.
 *
 * The script never resolves files on disk — it compares normalised import paths.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(process.cwd(), 'apps/web');
const SRC = join(ROOT, 'src');
const staticImportPattern = /from\s+['"]([^'"]+)['"]/gu;
const dynamicImportPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/gu;

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

// 6. Hooks: a facade hook per module plus optional operation hooks, each in
//    its own file. The file name must match the hook it exports.
const hooksByModule = new Map();

for (const file of files) {
  const relativePath = relative(SRC, file).split('\\').join('/');
  const match = relativePath.match(/^modules\/([^/]+)\/hooks\/(.+\.ts)$/u);

  if (match === null || relativePath.includes('.test.')) {
    continue;
  }

  const [, moduleName, fileName] = match;
  const hooks = hooksByModule.get(moduleName) ?? [];
  hooks.push({ relativePath, fileName });
  hooksByModule.set(moduleName, hooks);
}

/** `use-database-views.ts` -> `useDatabaseViews`. */
function hookNameForFile(fileName) {
  const [first, ...rest] = fileName.replace(/\.ts$/u, '').split('-');

  return first + rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

for (const [moduleName, hooks] of hooksByModule) {
  const facade = `use-${moduleName}.ts`;

  if (!hooks.some((hook) => hook.fileName === facade)) {
    violations.push(`modules/${moduleName}/hooks: отсутствует facade-хук ${facade}`);
  }

  for (const hook of hooks) {
    const source = readFileSync(join(SRC, hook.relativePath), 'utf8');
    const exported = [...source.matchAll(/^export\s+(?:function|const)\s+(use[A-Z]\w*)/gmu)].map(
      (match) => match[1],
    );

    if (exported.length !== 1) {
      violations.push(
        `${hook.relativePath}: в одном файле должен быть ровно один хук, найдено ${exported.length}`,
      );
      continue;
    }

    if (exported[0] !== hookNameForFile(hook.fileName)) {
      violations.push(`${hook.relativePath}: имя файла не совпадает с хуком ${exported[0] ?? ''}`);
    }
  }
}

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

  // 7. TanStack Query keys live only in the module's own utils/query-keys.ts.
  const relativePath = relative(SRC, file).split('\\').join('/');

  if (
    relativePath.startsWith('modules/') &&
    /(?:^|\/)query-keys(?:\.test)?\.ts$/u.test(relativePath) &&
    !/^modules\/[^/]+\/utils\/query-keys(?:\.test)?\.ts$/u.test(relativePath)
  ) {
    violations.push(`${fromRel}: ключи TanStack Query живут в utils/query-keys.ts`);
  }

  // 5. ui is the component layer: no hooks or stores here.
  if (/modules\/[^/]+\/ui\/(?:hooks|stores)\//u.test(fromRel)) {
    violations.push(`${fromRel}: hooks/stores не могут жить внутри ui`);
  }

  // 6. No separate use-case classes: business logic lives in the hooks.
  if (/modules\/[^/]+\/hooks\/use-cases\//u.test(fromRel)) {
    violations.push(`${fromRel}: папка use-cases не используется — логика живёт в хуках`);
  }

  for (const specifier of specifiers) {
    const target = resolveSpecifier(file, specifier);

    if (target === null) {
      continue;
    }

    const targetRel = relative(SRC, target).split('\\').join('/');
    const targetModule = moduleOf(target);

    // 1. shared knows nothing about modules/core/app.
    if (isShared && (targetModule !== null || targetRel.startsWith('core/'))) {
      violations.push(`${fromRel}: shared не может импортировать ${specifier}`);
    }

    // 2-3. Deep module imports are allowed only from the module itself.
    if (targetModule !== null && targetModule.rest !== '' && targetModule.rest !== 'index') {
      if (fromModule === null || fromModule.name !== targetModule.name) {
        violations.push(`${fromRel}: глубокий импорт модуля запрещён: ${specifier}`);
      }
    }

    // 4. api is raw calls only: no React, Query, Zustand or core.
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
