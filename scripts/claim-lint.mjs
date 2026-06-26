import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();

export const includeExtensions = new Set([
  '.md',
  '.mdx',
  '.txt',
  '.json',
  '.js',
  '.mjs',
  '.ts',
  '.tsx',
  '.html',
  '.yml',
  '.yaml'
]);

const ignoredDirectories = new Set([
  '.git',
  '.astro',
  'build',
  'coverage',
  'dist',
  'node_modules'
]);

const ignoredFileNames = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'npm-shrinkwrap.json'
]);

const ignoredPaths = new Set([
  'scripts/claim-lint.mjs',
  'test/claim-lint.test.mjs'
]);

const riskyReference = String.raw`(?:EU\s+AI\s+Act(?:\s+compliant|\s+compliance)?|compliant|certified|certification(?:s)?|certify|certifies|certifying|approved|approval|safe|safety|hallucination-free|truth|factual\s+correctness|legal\s+outcome|official\s+issuer|TrustBadge\s+authorization|Official\s+TSP\s+Conformance)`;

export const rules = [
  {
    id: 'risky-eu-ai-act-compliant',
    pattern: /\bEU\s+AI\s+Act\s+compliant\b/gi,
    message: 'Do not claim EU AI Act compliance.'
  },
  {
    id: 'risky-eu-ai-act-compliance',
    pattern: /\bEU\s+AI\s+Act\s+compliance\b/gi,
    message: 'Do not claim EU AI Act compliance.'
  },
  {
    id: 'risky-compliant',
    pattern: /\bcompliant\b/gi,
    message: 'Avoid compliance claims in public TSP materials.'
  },
  {
    id: 'risky-certified',
    pattern: /\bcertified\b/gi,
    message: 'Avoid certification claims in public TSP materials.'
  },
  {
    id: 'risky-certification',
    pattern: /\bcertification(?:s)?\b/gi,
    message: 'Avoid certification claims in public TSP materials.'
  },
  {
    id: 'risky-certify',
    pattern: /\bcertif(?:y|ies|ying)\b/gi,
    message: 'Avoid certification claims in public TSP materials.'
  },
  {
    id: 'risky-approved',
    pattern: /\bapproved\b/gi,
    message: 'Avoid approval claims in public TSP materials.'
  },
  {
    id: 'risky-approval',
    pattern: /\bapproval\b/gi,
    message: 'Avoid approval claims in public TSP materials.'
  },
  {
    id: 'risky-safe',
    pattern: /(?<!claim-)(?<!doctrine-)\bsafe\b/gi,
    message: 'Avoid safety claims in public TSP materials.'
  },
  {
    id: 'risky-safety',
    pattern: /\bsafety\b/gi,
    message: 'Avoid safety claims in public TSP materials.'
  },
  {
    id: 'risky-hallucination-free',
    pattern: /\bhallucination-free\b/gi,
    message: 'Do not claim hallucination-free output.'
  },
  {
    id: 'risky-truth',
    pattern: /\btruth\b/gi,
    message: 'TSP verifies evidence state, not truth.'
  },
  {
    id: 'risky-factual-correctness',
    pattern: /\bfactual\s+correctness\b/gi,
    message: 'TSP does not certify factual correctness.'
  },
  {
    id: 'risky-legal-outcome',
    pattern: /\blegal\s+outcome\b/gi,
    message: 'TSP does not verify legal outcomes.'
  },
  {
    id: 'risky-official-issuer',
    pattern: /\bofficial\s+issuer\b/gi,
    message: 'Public repos do not create official issuer status.'
  },
  {
    id: 'risky-trustbadge-authorization',
    pattern: /\bTrustBadge\s+authorization\b/gi,
    message: 'Public repos do not grant TrustBadge authorization.'
  },
  {
    id: 'risky-official-tsp-conformance',
    pattern: /\bOfficial\s+TSP\s+Conformance\b/gi,
    message: 'Public repos do not grant Official TSP Conformance Attestation.'
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

const allowPatterns = [
  /\bTSP verifies evidence state,\s+not truth or final legal outcome\b/i,
  /\bIntegrity verified\.\s+Factual correctness not certified\.\b/i,
  /\bFactual correctness not certified\b/i,
  /\blegal\/compliance certification requests\b/i,
  new RegExp(String.raw`\bTSP does not verify\b[\s\S]{0,220}\b${riskyReference}\b`, 'i'),
  new RegExp(String.raw`\bdoes not\s+(?:certify|grant|verify|claim|approve|provide|imply|sign)\b[\s\S]{0,220}\b${riskyReference}\b`, 'i'),
  new RegExp(String.raw`\bdo not\s+(?:claim|describe|present|state|suggest|grant|certify|approve|use|add)\b[\s\S]{0,220}\b${riskyReference}\b`, 'i'),
  new RegExp(String.raw`\bnot\s+(?:truth|factual\s+correctness|legal\s+outcome|EU\s+AI\s+Act\s+compliance|EU\s+AI\s+Act\s+compliant|certified|certification|compliant|approved|approval|safe|safety|hallucination-free)\b`, 'i'),
  new RegExp(String.raw`\bOut of Scope\b[\s\S]{0,420}\b${riskyReference}\b`, 'i')
];

export function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

export function shouldScanPath(relativePath) {
  const normalizedPath = toPosix(relativePath);
  const fileName = path.posix.basename(normalizedPath);
  const extension = path.posix.extname(fileName).toLowerCase();

  if (ignoredPaths.has(normalizedPath) || ignoredFileNames.has(fileName)) {
    return false;
  }

  return includeExtensions.has(extension);
}

export function walk(directory, rootDirectory = directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...walk(absolutePath, rootDirectory));
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relativePath = toPosix(path.relative(rootDirectory, absolutePath));
    if (shouldScanPath(relativePath)) {
      files.push(absolutePath);
    }
  }

  return files;
}

export function lineAndColumn(text, index) {
  const prefix = text.slice(0, index);
  const lines = prefix.split(/\r\n|\r|\n/);
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function lineBounds(text, index) {
  const lineStart = text.lastIndexOf('\n', index) + 1;
  const nextNewline = text.indexOf('\n', index);
  return {
    start: lineStart,
    end: nextNewline === -1 ? text.length : nextNewline
  };
}

export function isAllowedOccurrence(text, index, length) {
  const bounds = lineBounds(text, index);
  const line = text.slice(bounds.start, bounds.end);
  const context = text.slice(Math.max(0, index - 320), Math.min(text.length, index + length + 320));

  return allowPatterns.some((pattern) => pattern.test(line) || pattern.test(context));
}

export function scanText(relativePath, text) {
  const findings = [];

  for (const rule of rules) {
    rule.pattern.lastIndex = 0;

    for (const match of text.matchAll(rule.pattern)) {
      const index = match.index ?? 0;
      const value = match[0];

      if (isAllowedOccurrence(text, index, value.length)) {
        continue;
      }

      const location = lineAndColumn(text, index);
      findings.push({
        file: relativePath,
        line: location.line,
        column: location.column,
        rule: rule.id,
        value,
        message: rule.message
      });
    }
  }

  return findings;
}

export function scanRoot(rootDirectory = root) {
  const findings = [];

  for (const file of walk(rootDirectory)) {
    if (!statSync(file).isFile()) {
      continue;
    }

    const text = readFileSync(file, 'utf8');
    const relativePath = toPosix(path.relative(rootDirectory, file));
    findings.push(...scanText(relativePath, text));
  }

  return findings;
}

function printFindings(findings) {
  console.error('claim-lint failed: forbidden public-claim or legacy-license language found.');
  for (const finding of findings) {
    console.error(
      `${finding.file}:${finding.line}:${finding.column} ` +
        `[${finding.rule}] ${JSON.stringify(finding.value)} - ${finding.message}`
    );
  }
}

const modulePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  const findings = scanRoot(root);

  if (findings.length > 0) {
    printFindings(findings);
    process.exit(1);
  }

  console.log('claim-lint passed: no forbidden public-claim or legacy-license language found.');
}
