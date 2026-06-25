import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const includeExtensions = new Set(['.md', '.txt', '.json']);
const ignoredDirectories = new Set([
  '.git',
  '.github',
  '.astro',
  'build',
  'coverage',
  'dist',
  'node_modules'
]);

const rules = [
  {
    id: 'forbidden-certif-term',
    pattern: /\b(?:certified|certification|certifications|certify|certifies|certifying)\b/gi,
    message: 'Use "Conformant" or "Official TSP Conformance Attestation" language.'
  },
  {
    id: 'legacy-license-apache-mit',
    pattern: /\b(?:Apache\s*\/\s*MIT|MIT\s*\/\s*Apache)\b/gi,
    message: 'Legacy Apache/MIT dual-license language is not allowed in vNext repos.'
  },
  {
    id: 'legacy-license-lexico-reserved',
    pattern: /\bLexiCo\s+Reserved\b/gi,
    message: 'Custom LexiCo reserved-license claims are not allowed in vNext repo roots.'
  },
  {
    id: 'legacy-license-lexico-tsp',
    pattern: /\bLexiCo\s+TSP\s+License\b/gi,
    message: 'Legacy LexiCo TSP License language is not allowed in vNext repos.'
  },
  {
    id: 'legacy-license-source-available',
    pattern: /\b(?:source-available implementation|non-forkable)\b/gi,
    message: 'Legacy source-available/non-forkable license posture is not allowed here.'
  }
];

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function walk(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...walk(absolutePath));
      }
      continue;
    }

    if (entry.isFile() && includeExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(absolutePath);
    }
  }

  return files;
}

function lineAndColumn(text, index) {
  const prefix = text.slice(0, index);
  const lines = prefix.split(/\r\n|\r|\n/);
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

const findings = [];

for (const file of walk(root)) {
  if (!statSync(file).isFile()) {
    continue;
  }

  const text = readFileSync(file, 'utf8');
  const relativePath = toPosix(path.relative(root, file));

  for (const rule of rules) {
    rule.pattern.lastIndex = 0;

    for (const match of text.matchAll(rule.pattern)) {
      const location = lineAndColumn(text, match.index ?? 0);
      findings.push({
        file: relativePath,
        line: location.line,
        column: location.column,
        rule: rule.id,
        value: match[0],
        message: rule.message
      });
    }
  }
}

if (findings.length > 0) {
  console.error('claim-lint failed: forbidden public-claim or legacy-license language found.');
  for (const finding of findings) {
    console.error(
      `${finding.file}:${finding.line}:${finding.column} ` +
        `[${finding.rule}] ${JSON.stringify(finding.value)} - ${finding.message}`
    );
  }
  process.exit(1);
}

console.log('claim-lint passed: no forbidden public-claim or legacy-license language found.');
