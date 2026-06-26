#!/usr/bin/env node
/**
 * TSP conformance runner for the JS port (tsp-verify).
 *
 * Runs the checksum-pinned tsp-spec fixture suites through THIS package's
 * exported functions: the v3.0 TrustEnvelope vectors AND the tsp.license.v1
 * vectors (ADR-0010), each a separate pinned track with its own SHA256SUMS,
 * never mixed. Exit 0 only if every snapshot is intact AND every vector
 * matches. A failure here means THIS PORT is wrong (ADR-0008) -- fix the port,
 * never the fixtures. Zero dependencies (Node >= 20 Web Crypto).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  canonicalize, sha256Hex, validateTrustEnvelopeShape, verifyLocal,
  verifyLicense,
} from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = path.join(__dirname, 'spec-snapshot');
const FIXTURES = path.join(SNAPSHOT, 'fixtures', 'v3.0');
const LICENSE_FIXTURES = path.join(SNAPSHOT, 'fixtures', 'license-v1');

const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf-8'));

function verifySums(sumsPath) {
  const mismatches = [];
  const lines = fs.readFileSync(sumsPath, 'utf-8').split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^([a-f0-9]{64})\s+(.+)$/);
    if (!m) { mismatches.push(`unparseable SHA256SUMS line: ${line}`); continue; }
    const [, expected, rel] = m;
    const target = path.join(SNAPSHOT, ...rel.split('/'));
    try {
      const actual = createHash('sha256').update(fs.readFileSync(target)).digest('hex');
      if (actual !== expected) mismatches.push(`${rel}: checksum drift -- expected ${expected}, got ${actual}`);
    } catch (e) {
      mismatches.push(`${rel}: cannot read (${e})`);
    }
  }
  return { count: lines.length, mismatches };
}

function rootKeysInDocumentOrder(raw) {
  const keys = [];
  let depth = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      let j = i + 1, e = false;
      for (; j < raw.length; j++) {
        const c = raw[j];
        if (e) { e = false; continue; }
        if (c === '\\') { e = true; continue; }
        if (c === '"') break;
      }
      if (depth === 1) {
        let m = j + 1;
        while (m < raw.length && /\s/.test(raw[m])) m++;
        if (raw[m] === ':') keys.push(raw.slice(i + 1, j));
      }
      i = j;
      continue;
    }
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
  }
  return keys;
}
const utf16Sort = (keys) => [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

async function runVector(vec) {
  const raw = fs.readFileSync(path.join(FIXTURES, vec.file), 'utf-8');
  const env = JSON.parse(raw);
  const fails = [];
  switch (vec.kind) {
    case 'cryptographic': {
      const key = readJson(path.join(FIXTURES, vec.key));
      const { valid, checks } = await verifyLocal(env, { knownPublicKey: key });
      const e = vec.expect;
      if (valid !== e.valid) fails.push(`valid: expected ${e.valid}, got ${valid}`);
      for (const [name, want] of Object.entries(e.checks)) {
        if (name === 'signatures') {
          want.forEach((w, i) => {
            const got = checks.signatures[i]?.status;
            if (got !== w) fails.push(`signatures[${i}]: expected ${w}, got ${got}`);
          });
        } else {
          const got = checks[name]?.status;
          if (got !== want) fails.push(`${name}: expected ${want}, got ${got}`);
        }
      }
      return fails;
    }
    case 'canonical-hash': {
      const got = await sha256Hex(canonicalize(env.content.value));
      if (got !== vec.expect.contentValueHash) fails.push(`canonical(content.value) hash: expected ${vec.expect.contentValueHash}, got ${got}`);
      if (vec.expect.schema === 'passed' && validateTrustEnvelopeShape(env).length > 0) fails.push('schema: expected passed, got failed');
      return fails;
    }
    case 'canonical-equivalence': {
      const ref = readJson(path.join(FIXTURES, vec.reference));
      const a = canonicalize(env), b = canonicalize(ref);
      if (a !== b) fails.push(`canonicalize(${vec.file}) !== canonicalize(${vec.reference})`);
      if ((await sha256Hex(a)) !== (await sha256Hex(b))) fails.push('sha256 of canonical forms differ');
      return fails;
    }
    case 'schema-invalid': {
      const errors = validateTrustEnvelopeShape(env);
      if (errors.length === 0) fails.push('schema: expected failed, got passed');
      if (vec.expect?.errorContains && !errors.some((x) => x.includes(vec.expect.errorContains)))
        fails.push(`expected a schema error containing "${vec.expect.errorContains}"; got: ${errors.join('; ')}`);
      return fails;
    }
    case 'structural-unsorted': {
      const keys = rootKeysInDocumentOrder(raw);
      if (JSON.stringify(keys) === JSON.stringify(utf16Sort(keys))) fails.push('document order equals canonical order -- JCS sort trap not exercised');
      return fails;
    }
    default:
      return [`unknown kind: ${vec.kind}`];
  }
}

async function runLicenseVector(vec, trustedRootKeys) {
  const bundle = readJson(path.join(LICENSE_FIXTURES, vec.file));
  const config = { origin: vec.origin, trustedRootKeys, requiredModules: vec.requiredModules ?? [] };
  const r = await verifyLicense(bundle, config, vec.now);
  const fails = [];
  if (r.ok !== vec.expect.ok) fails.push(`ok: expected ${vec.expect.ok}, got ${r.ok} (${r.reason}: ${r.detail})`);
  if (r.reason !== vec.expect.reason) fails.push(`reason: expected ${vec.expect.reason}, got ${r.reason}`);
  return fails;
}

async function main() {
  let failed = 0;

  const spec = readJson(path.join(SNAPSHOT, 'expectations.json'));
  console.log(`TSP JS-port conformance (tsp-verify) -- wire tsp "${spec.tsp}" - maturity "${spec.specMaturity}"`);
  const v3 = verifySums(path.join(FIXTURES, 'SHA256SUMS'));
  if (v3.mismatches.length) { console.log(RED(`v3.0 integrity FAILED (${v3.mismatches.length}/${v3.count})`)); v3.mismatches.forEach((m) => console.log('   ', m)); process.exit(1); }
  console.log(DIM(`integrity: ${v3.count} v3.0 fixtures match pinned SHA256SUMS`));
  for (const vec of spec.vectors) {
    const fails = await runVector(vec);
    if (fails.length === 0) console.log(`${GREEN('PASS')}  ${vec.file}  ${DIM('[' + vec.kind + ']')}`);
    else { failed++; console.log(`${RED('FAIL')}  ${vec.file}  ${DIM('[' + vec.kind + ']')}`); fails.forEach((f) => console.log(RED('        ' + f))); }
  }

  const lic = readJson(path.join(SNAPSHOT, 'license-expectations.json'));
  console.log(`\nlicense conformance -- artifact "${lic.artifact}"`);
  const ls = verifySums(path.join(LICENSE_FIXTURES, 'SHA256SUMS'));
  if (ls.mismatches.length) { console.log(RED(`license integrity FAILED (${ls.mismatches.length}/${ls.count})`)); ls.mismatches.forEach((m) => console.log('   ', m)); process.exit(1); }
  console.log(DIM(`integrity: ${ls.count} license fixtures match pinned SHA256SUMS`));
  const rootFile = readJson(path.join(LICENSE_FIXTURES, lic.rootKey));
  const trustedRootKeys = [{ rootKeyId: rootFile.rootKeyId, publicKey: rootFile.publicKey }];
  for (const vec of lic.vectors) {
    const fails = await runLicenseVector(vec, trustedRootKeys);
    if (fails.length === 0) console.log(`${GREEN('PASS')}  ${vec.file}  ${DIM('[' + vec.expect.reason + ']')}`);
    else { failed++; console.log(`${RED('FAIL')}  ${vec.file}  ${DIM('[' + vec.expect.reason + ']')}`); fails.forEach((f) => console.log(RED('        ' + f))); }
  }

  const total = spec.vectors.length + lic.vectors.length;
  console.log('');
  if (failed === 0) { console.log(GREEN(`✓ all ${total} conformance vectors pass against the JS port`)); process.exit(0); }
  console.log(RED(`✗ ${failed}/${total} vectors failed`)); process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
