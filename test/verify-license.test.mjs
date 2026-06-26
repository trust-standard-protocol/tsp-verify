import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyLicense } from '../src/index.js';

const FX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../conformance/spec-snapshot/fixtures/license-v1');
const load = (f) => JSON.parse(readFileSync(path.join(FX, f), 'utf8'));
const roots = () => { const rf = load('license-root-key.json'); return [{ rootKeyId: rf.rootKeyId, publicKey: rf.publicKey }]; };
const cfg = (origin, requiredModules = []) => ({ origin, trustedRootKeys: roots(), requiredModules });

test('valid pro license verifies offline', async () => {
  const r = await verifyLicense(load('valid-pro.json'), cfg('https://customer.example'), '2026-07-01T00:00:00.000Z');
  assert.equal(r.ok, true);
  assert.equal(r.reason, 'valid');
});

test('allowed origin + module gating', async () => {
  assert.equal((await verifyLicense(load('valid-pro.json'), cfg('https://staging.customer.example'), '2026-07-01T00:00:00.000Z')).ok, true);
  assert.equal((await verifyLicense(load('valid-pro.json'), cfg('https://customer.example', ['enterprise-policy']), '2026-07-01T00:00:00.000Z')).reason, 'module_not_licensed');
});

test('failure modes', async () => {
  const cases = [
    ['valid-pro.json', 'https://evil.example', '2026-07-01T00:00:00.000Z', 'origin_mismatch'],
    ['valid-pro.json', 'https://customer.example', '2026-10-01T00:00:00.000Z', 'license_expired'],
    ['valid-pro.json', 'https://customer.example', '2027-01-01T00:00:00.000Z', 'issuer_expired'],
    ['tampered-license.json', 'https://customer.example', '2026-07-01T00:00:00.000Z', 'license_signature_invalid'],
    ['untrusted-root.json', 'https://customer.example', '2026-07-01T00:00:00.000Z', 'untrusted_root'],
    ['issuer-mismatch.json', 'https://customer.example', '2026-07-01T00:00:00.000Z', 'issuer_mismatch'],
    ['schema-invalid.json', 'https://customer.example', '2026-07-01T00:00:00.000Z', 'schema_invalid'],
  ];
  for (const [file, origin, now, want] of cases) {
    const r = await verifyLicense(load(file), cfg(origin), now);
    assert.equal(r.reason, want, file);
  }
});

test('signed grace', async () => {
  const r = await verifyLicense(load('in-grace.json'), cfg('https://customer.example'), '2026-06-10T00:00:00.000Z');
  assert.equal(r.ok, true);
  assert.equal(r.reason, 'valid_in_grace');
  assert.equal(r.inGrace, true);
});

test('misconfiguration throws (fail-closed at the call site)', async () => {
  await assert.rejects(() => verifyLicense(load('valid-pro.json'), { origin: '', trustedRootKeys: roots() }, '2026-07-01T00:00:00.000Z'), /origin/);
  await assert.rejects(() => verifyLicense(load('valid-pro.json'), { origin: 'https://x', trustedRootKeys: [] }, '2026-07-01T00:00:00.000Z'), /trustedRootKeys/);
});
