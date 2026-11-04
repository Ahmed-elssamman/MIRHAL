import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseTemplate } from '@angular/compiler';
import * as ts from 'typescript';

const excludedText = new Set(['MIRHAL', 'مِرحال', 'XP']);

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return files(path);
        if (path.endsWith('.html')) return [path];
        if (path.endsWith('.ts') && !path.endsWith('.spec.ts')) return [path];
        return [];
      }),
    )
  ).flat();
}

function staticString(node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.Plus) {
    const left = staticString(node.left);
    const right = staticString(node.right);
    return left === undefined || right === undefined ? undefined : left + right;
  }
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => span.literal.text).join('');
  }
  return undefined;
}

function inlineTemplates(source, path) {
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const templates = [];
  function visit(node) {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(parsed) === 'template' &&
      (ts.isStringLiteralLike(node.initializer) ||
        ts.isBinaryExpression(node.initializer) ||
        ts.isTemplateExpression(node.initializer))
    ) {
      const value = staticString(node.initializer);
      if (value !== undefined) templates.push(value);
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return templates;
}

function inspectIndex(path, source, candidates) {
  const document = source.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const title = document.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const body = document.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '';
  const visibleText = `${title} ${body.replace(/<[^>]*>/g, ' ')}`;
  const labels = [
    ...document.matchAll(/\b(?:aria-label|alt|placeholder|title)\s*=\s*["']([^"']*)["']/gi),
  ].map((match) => match[1]);
  const description = document.match(
    /<meta\b(?=[^>]*name\s*=\s*["']description["'])[^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i,
  )?.[1];
  for (const text of [visibleText, ...labels, description].filter(Boolean)) {
    const normalized = text.trim().replace(/\s+/g, ' ');
    if (/\p{L}{2}/u.test(normalized) && !excludedText.has(normalized)) {
      candidates.push({ path, text: normalized });
    }
  }
}

const candidates = [];
const templateFiles = [...(await files('apps')), ...(await files('libs'))];
for (const path of templateFiles) {
  const source = await readFile(path, 'utf8');
  if (path.endsWith('index.html')) {
    inspectIndex(path, source, candidates);
    continue;
  }
  const templates = path.endsWith('.html') ? [source] : inlineTemplates(source, path);
  for (const template of templates) {
    const parsed = parseTemplate(template, path);
    if (parsed.errors?.length) {
      console.error(`${path}: ${parsed.errors.map((error) => error.msg).join('; ')}`);
      process.exitCode = 1;
      continue;
    }
    function visit(nodes) {
      for (const node of nodes) {
        if (node.constructor.name === 'Text' && /\p{L}{2}/u.test(node.value)) {
          const text = node.value.trim().replace(/\s+/g, ' ');
          if (text && !excludedText.has(text)) candidates.push({ path, text });
        }
        for (const attribute of node.attributes ?? []) {
          if (
            ['aria-label', 'alt', 'placeholder', 'title', 'label'].includes(attribute.name) &&
            attribute.value &&
            /\p{L}{2}/u.test(attribute.value) &&
            !excludedText.has(attribute.value)
          ) {
            candidates.push({ path, text: `${attribute.name}=${attribute.value}` });
          }
        }
        if (node.children) visit(node.children);
        if (node.template?.children) visit(node.template.children);
        if (node.branches) for (const branch of node.branches) visit(branch.children ?? []);
      }
    }
    visit(parsed.nodes);
  }
}

console.log(
  `Inspected ${templateFiles.length} Angular source files, including inline component templates and app entry documents.`,
);
console.log(`Found ${candidates.length} raw text nodes.`);
for (const candidate of candidates)
  console.log(`${candidate.path}: ${JSON.stringify(candidate.text)}`);
if (candidates.length) process.exitCode = 1;
else
  console.log(
    'Angular templates and app entry documents contain no unlocalized static text or accessibility/form labels.',
  );
