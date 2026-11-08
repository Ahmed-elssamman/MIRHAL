import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

const root = process.cwd();
const callPattern =
  /(?:i18n|preferences)\.t\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\)/g;
const escapedCallPattern =
  /(?:i18n|preferences)\.t\(\s*\\?'([^']*)\\?'\s*,\s*\\?'([^']*)\\?'\s*\)/g;

function fallbackKey(value) {
  const slug =
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'copy';
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++)
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `common.fallbacks.${slug}_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? walk(path) : [path];
      }),
    )
  ).flat();
}

function addPipeToDecorator(source, markerIndex) {
  const componentStart = source.lastIndexOf('@Component', markerIndex);
  if (componentStart < 0)
    throw new Error(`No component decorator before template at ${markerIndex}.`);
  const decoratorEnd = source.indexOf('})', markerIndex);
  const importsMatch = /imports\s*:\s*\[/.exec(source.slice(componentStart, decoratorEnd));
  if (importsMatch) {
    const arrayStart = componentStart + importsMatch.index + importsMatch[0].lastIndexOf('[');
    const arrayEnd = source.indexOf(']', arrayStart);
    if (!source.slice(arrayStart, arrayEnd).includes('TranslatePipe')) {
      source = `${source.slice(0, arrayStart + 1)}\n    TranslatePipe,${source.slice(arrayStart + 1)}`;
    }
  } else {
    source = `${source.slice(0, markerIndex)}imports: [TranslatePipe],\n  ${source.slice(markerIndex)}`;
  }
  if (!source.includes("from '@ngx-translate/core'")) {
    source = source.replace(
      /import\s*\{[^}]+\}\s*from\s*'@angular\/core';/,
      (line) => `${line}\nimport { TranslatePipe } from '@ngx-translate/core';`,
    );
  }
  return source;
}

const paths = (
  await Promise.all(
    ['apps/web/src/app', 'apps/admin/src/app', 'libs'].map((path) => walk(join(root, path))),
  )
).flat();
const owners = new Map();
for (const path of paths.filter((file) => file.endsWith('.ts'))) {
  const source = await readFile(path, 'utf8');
  for (const [, template] of source.matchAll(/templateUrl\s*:\s*['"]\.\/([^'"]+)['"]/g)) {
    owners.set(join(dirname(path), template), path);
  }
}

let migratedCalls = 0;
const skipped = [];
for (const path of paths.filter((file) => file.endsWith('.html'))) {
  let template = await readFile(path, 'utf8');
  if (!/(?:i18n|preferences)\.t\(/.test(template)) continue;
  const owner = owners.get(path);
  if (!owner) {
    skipped.push(path);
    continue;
  }
  template = template.replace(callPattern, (_call, english) => {
    migratedCalls++;
    return `('${fallbackKey(english)}' | translate)`;
  });
  await writeFile(path, template);
  const source = await readFile(owner, 'utf8');
  const marker = source.search(new RegExp(`templateUrl\\s*:\\s*['"]\\.\\/${basename(path)}['"]`));
  if (marker >= 0) await writeFile(owner, addPipeToDecorator(source, marker));
}

for (const path of paths.filter((file) => file.endsWith('.ts'))) {
  let source = await readFile(path, 'utf8');
  const templates = [
    ...[...source.matchAll(/template\s*:\s*`([\s\S]*?)`/g)].map((match) => ({
      match,
      escaped: false,
    })),
    ...[...source.matchAll(/template\s*:\s*'((?:\\.|[^'\\])*)'/g)].map((match) => ({
      match,
      escaped: true,
    })),
  ].filter(({ match: [, template] }) => /(?:i18n|preferences)\.t\(/.test(template));
  for (const { match, escaped } of templates.sort((a, b) => b.match.index - a.match.index)) {
    const [block, template] = match;
    const pattern = escaped ? escapedCallPattern : callPattern;
    const migrated = template.replace(pattern, (_call, english) => {
      migratedCalls++;
      const quote = escaped ? "\\'" : "'";
      return `(${quote}${fallbackKey(english)}${quote} | translate)`;
    });
    if (migrated === template) continue;
    source =
      source.slice(0, match.index) +
      block.replace(template, migrated) +
      source.slice(match.index + block.length);
    source = addPipeToDecorator(source, match.index);
  }
  if (templates.length) await writeFile(path, source);
}

console.log(
  `Migrated ${migratedCalls} template strings across ${owners.size} external-template component owners.`,
);
if (skipped.length)
  console.log(
    `Skipped templates without a matching component templateUrl:\n${skipped.map(basename).join('\n')}`,
  );
