import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseTemplate } from '@angular/compiler';

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return path.endsWith('.html') && entry.name !== 'index.html' ? [path] : [];
  }))).flat();
}

const candidates = [];
for (const path of [...(await files('apps')), ...(await files('libs'))]) {
  const source = await readFile(path, 'utf8');
  const parsed = parseTemplate(source, path);
  if (parsed.errors?.length) {
    console.error(`${path}: ${parsed.errors.map((error) => error.msg).join('; ')}`);
    process.exitCode = 1;
    continue;
  }
  function visit(nodes) {
    for (const node of nodes) {
      if (node.constructor.name === 'Text' && /\p{L}{2}/u.test(node.value)) {
        candidates.push({ path, text: node.value.trim().replace(/\s+/g, ' ') });
      }
      for (const attribute of node.attributes ?? []) {
        if (
          ['aria-label', 'alt', 'placeholder', 'title', 'label'].includes(attribute.name) &&
          attribute.value &&
          /\p{L}{2}/u.test(attribute.value)
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
console.log(`Found ${candidates.length} raw text nodes.`);
for (const candidate of candidates) console.log(`${candidate.path}: ${JSON.stringify(candidate.text)}`);
if (candidates.length) process.exitCode = 1;
else console.log('Angular component templates contain no unlocalized static text or accessibility/form labels.');
