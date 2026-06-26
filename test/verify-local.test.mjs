import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize, verifyLocal } from '../src/index.js';

const FX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../conformance/spec-snapshot/fixtures/v3.0');
const load = (f) => JSON.parse(readFileSync(path.join(FX, f), 'utf8'));

test('canonicalize: sorting + scalars (RFC 8785)', () => {
  assert.equal(canonicalize({ b: 1, a: 'x' }), '{"a":"x","b":1}');
  assert.equal(canonicalize(null), 'null');
  assert.equal(canonicalize(true), 'true');
});

test('verifyLocal: reference signed envelope verifies end-to-end', async () => {
  const r = await verifyLocal(load('valid-signed.json'), { knownPublicKey: load('valid-signed-key.json') });
  assert.equal(r.valid, true);
  assert.equal(r.checks.schema.status, 'passed');
  assert.equal(r.checks.ledgerHash.status, 'passed');
  assert.equal(r.checks.signatures[0].status, 'passed');
});

test('verifyLocal: ADR-0002 tamper profile (provenance mutated after signing)', async () => {
  const r = await verifyLocal(load('tampered-provenance.json'), { knownPublicKey: load('valid-with-provenance-key.json') });
  assert.equal(r.valid, false);
  assert.equal(r.checks.schema.status, 'passed');
  assert.equal(r.checks.ledgerHash.status, 'failed');
  assert.equal(r.checks.signatures[0].status, 'failed');
});
