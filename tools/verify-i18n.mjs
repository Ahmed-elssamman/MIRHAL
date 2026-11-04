import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseTree } from 'jsonc-parser';

const root = process.cwd();
const failures = [];

function findDuplicateKeys(node, path, duplicates) {
  if (!node) return;
  if (node.type === 'object') {
    const seen = new Set();
    for (const property of node.children ?? []) {
      const key = property.children?.[0]?.value;
      if (typeof key === 'string') {
        if (seen.has(key)) duplicates.push(`${path}.${key}`);
        seen.add(key);
        findDuplicateKeys(property.children?.[1], `${path}.${key}`, duplicates);
      }
    }
  } else if (node.type === 'array') {
    for (const [index, child] of (node.children ?? []).entries()) {
      findDuplicateKeys(child, `${path}[${index}]`, duplicates);
    }
  }
}

const parseJson = async (path) => {
  const source = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '');
  const parseErrors = [];
  const tree = parseTree(source, parseErrors, {
    allowTrailingComma: false,
    disallowComments: true,
  });
  if (parseErrors.length || !tree) throw new Error(`Invalid JSON in ${path}.`);
  const duplicates = [];
  findDuplicateKeys(tree, path, duplicates);
  for (const key of duplicates) failures.push(`Duplicate translation key: ${key}.`);
  return JSON.parse(source);
};
const english = await parseJson(join(root, 'libs/i18n/src/assets/i18n/en.json'));
const arabic = await parseJson(join(root, 'libs/i18n/src/assets/i18n/ar.json'));

function flatten(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

function fallbackKey(value) {
  const slug =
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'copy';
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return `${slug}_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
    }),
  );
  return nested.flat();
}

if (JSON.stringify(flatten(english).sort()) !== JSON.stringify(flatten(arabic).sort())) {
  failures.push('English and Arabic dictionary structures differ.');
}
if (!english.common?.fallbacks || !arabic.common?.fallbacks) {
  failures.push('Shared bilingual fallback catalog is missing.');
}
if (/[ØÙÂ][\u0080-\u00ff]/u.test(JSON.stringify(arabic))) {
  failures.push('Arabic dictionary contains text with a known mojibake pattern.');
}

const files = [
  ...(await sourceFiles(join(root, 'apps'))),
  ...(await sourceFiles(join(root, 'libs'))),
];
const source = (await Promise.all(files.map((path) => readFile(path, 'utf8')))).join('\n');
const fallbackMatches = [
  ...source.matchAll(
    /(?:i18n|preferences)\.t\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\)/g,
  ),
  ...source.matchAll(/(?:i18n|preferences)\.t\(\s*\\?'([^']*)\\?'\s*,\s*\\?'([^']*)\\?'\s*\)/g),
];
const seenFallbackPairs = new Set();
const fallbackCalls = fallbackMatches.filter((match) => {
  const pair = `${match[1]}\0${match[2]}`;
  if (seenFallbackPairs.has(pair)) return false;
  seenFallbackPairs.add(pair);
  return true;
});
if (process.argv.includes('--sync-fallbacks')) {
  for (const [, englishText, arabicText] of fallbackCalls) {
    const key = fallbackKey(englishText);
    english.common.fallbacks[key] = englishText;
    arabic.common.fallbacks[key] ??= arabicText;
  }
  await Promise.all([
    writeFile(
      join(root, 'libs/i18n/src/assets/i18n/en.json'),
      `${JSON.stringify(english, null, 2)}\n`,
    ),
    writeFile(
      join(root, 'libs/i18n/src/assets/i18n/ar.json'),
      `${JSON.stringify(arabic, null, 2)}\n`,
    ),
  ]);
}
const keySet = new Set(flatten(english));
const translatedKeys = [
  ...[...source.matchAll(/['"]([\w.-]+)['"]\s*\|\s*translate/g)].map(([, key]) => key),
  ...[...source.matchAll(/\\(['"])([\w.-]+)\\\1\s*\|\s*translate/g)].map(([, , key]) => key),
];
for (const key of translatedKeys) {
  if (!keySet.has(key)) failures.push(`TranslatePipe references missing key: ${key}.`);
}
let ambiguousPairs = 0;
for (const [, englishText, arabicText] of fallbackCalls) {
  const key = fallbackKey(englishText);
  if (english.common?.fallbacks?.[key] !== englishText) {
    failures.push(`Source fallback pair is absent or mismatched at common.fallbacks.${key}.`);
  } else if (arabic.common?.fallbacks?.[key] !== arabicText) {
    ambiguousPairs++;
  }
}

const keyReferences = new Set([
  ...[
    ...source.matchAll(
      /["']((?:common|forms|settings|adminSettings|admin|auth|web|updates|metadata|errors|shared)\.[\w.-]+)["']/g,
    ),
  ].map(([, key]) => key),
  ...[
    ...source.matchAll(
      /\\(["'])((?:common|forms|settings|adminSettings|admin|auth|web|updates|metadata|errors|shared)\.[\w.-]+)\\\1/g,
    ),
  ].map(([, , key]) => key),
]);
for (const [, englishText] of fallbackCalls) {
  keyReferences.add(`common.fallbacks.${fallbackKey(englishText)}`);
}
const dynamicNamespaces = [
  'common.labels.',
  'web.profile.avatars.',
  'web.features.analytics.factors.',
  'web.features.journey.factors.',
];
const unusedKeys = flatten(english).filter(
  (key) => !keyReferences.has(key) && !dynamicNamespaces.some((prefix) => key.startsWith(prefix)),
);
for (const key of unusedKeys)
  failures.push(`Translation key is not referenced by static code: ${key}.`);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `i18n verified: ${flatten(english).length} aligned keys; ${fallbackCalls.length} bilingual fallback call sites resolve to the shared catalog (${ambiguousPairs} English strings have context-specific Arabic copy and retain their source Arabic fallback); no statically unused keys remain outside documented dynamic namespaces.`,
  );
}
