import ts from 'typescript';
import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = 'apps/web/src/app/features/help/help.ts';
const templatePath = 'apps/web/src/app/features/help/help.html';
const englishPath = 'libs/i18n/src/assets/i18n/en.json';
const arabicPath = 'libs/i18n/src/assets/i18n/ar.json';
const source = await readFile(sourcePath, 'utf8');
const file = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true);
let steps;

function findSteps(node) {
  if (
    ts.isPropertyDeclaration(node) &&
    node.name.getText(file) === 'steps' &&
    ts.isArrayLiteralExpression(node.initializer)
  ) {
    steps = node.initializer.elements;
  }
  ts.forEachChild(node, findSteps);
}

findSteps(file);
if (!steps || steps.length !== 15)
  throw new Error(`Expected the 15 authored help steps; found ${steps?.length ?? 0}.`);

const english = JSON.parse((await readFile(englishPath, 'utf8')).replace(/^\uFEFF/, ''));
const arabic = JSON.parse((await readFile(arabicPath, 'utf8')).replace(/^\uFEFF/, ''));
english.web.help = { steps: {} };
arabic.web.help = { steps: {} };
const edits = [];
const textOf = (object, property) => {
  const field = object.properties.find(
    (entry) => ts.isPropertyAssignment(entry) && entry.name.getText(file) === property,
  );
  if (!field || !ts.isStringLiteral(field.initializer))
    throw new Error(`Missing literal ${property} in a help step.`);
  return field.initializer.text;
};
const quote = (value) => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

steps.forEach((element, index) => {
  if (!ts.isObjectLiteralExpression(element))
    throw new Error(`Help step ${index + 1} is not an object literal.`);
  const number = String(index + 1).padStart(2, '0');
  const fields = [
    ['title', 'ar', 'titleKey', 'title'],
    ['text', 'textAr', 'textKey', 'text'],
    ['example', 'exampleAr', 'exampleKey', 'example'],
    ['label', 'labelAr', 'labelKey', 'label'],
  ];
  const translatedProperties = [];
  for (const [enField, arField, property, keyPart] of fields) {
    const key = `web.help.steps.step${number}.${keyPart}`;
    english.web.help.steps[`step${number}`] ??= {};
    arabic.web.help.steps[`step${number}`] ??= {};
    english.web.help.steps[`step${number}`][keyPart] = textOf(element, enField);
    arabic.web.help.steps[`step${number}`][keyPart] = textOf(element, arField);
    translatedProperties.push(`      ${property}: ${quote(key)},`);
  }
  const icon = textOf(element, 'icon');
  const link = textOf(element, 'link');
  const replacement = `    {\n${translatedProperties.join('\n')}\n      icon: ${quote(icon)},\n      link: ${quote(link)},\n    }`;
  edits.push({ start: element.getStart(file), end: element.getEnd(), replacement });
});

let updatedSource = source;
for (const edit of edits.reverse())
  updatedSource =
    updatedSource.slice(0, edit.start) + edit.replacement + updatedSource.slice(edit.end);

let template = await readFile(templatePath, 'utf8');
const replacements = [
  [/i18n\.t\(step\.title,\s*step\.ar\)/g, 'step.titleKey | translate'],
  [/i18n\.t\(current\(\)\.label,\s*current\(\)\.labelAr\)/g, 'current().labelKey | translate'],
  [/i18n\.t\(current\(\)\.title,\s*current\(\)\.ar\)/g, 'current().titleKey | translate'],
  [/i18n\.t\(current\(\)\.text,\s*current\(\)\.textAr\)/g, 'current().textKey | translate'],
  [
    /i18n\.t\(current\(\)\.example,\s*current\(\)\.exampleAr\)/g,
    'current().exampleKey | translate',
  ],
];
for (const [pattern, replacement] of replacements)
  template = template.replace(pattern, replacement);

await Promise.all([
  writeFile(sourcePath, updatedSource),
  writeFile(templatePath, template),
  writeFile(englishPath, `${JSON.stringify(english, null, 2)}\n`),
  writeFile(arabicPath, `${JSON.stringify(arabic, null, 2)}\n`),
]);
console.log(
  `Moved ${steps.length} authored Help steps and their 60 fields into the shared English/Arabic catalogs.`,
);
