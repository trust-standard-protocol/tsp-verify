import assert from 'node:assert/strict';
import test from 'node:test';

import { scanText, shouldScanPath } from '../scripts/claim-lint.mjs';

test('claim-lint flags unnegated risky claims', () => {
  const findings = scanText(
    'README.md',
    [
      'This verifier is EU AI Act compliant.',
      'The TrustBadge is certified safe for legal outcome decisions.',
      'This is an official issuer approval.'
    ].join('\n')
  );

  assert.ok(findings.some((finding) => finding.rule === 'risky-eu-ai-act-compliant'));
  assert.ok(findings.some((finding) => finding.rule === 'risky-certified'));
  assert.ok(findings.some((finding) => finding.rule === 'risky-safe'));
  assert.ok(findings.some((finding) => finding.rule === 'risky-legal-outcome'));
  assert.ok(findings.some((finding) => finding.rule === 'risky-official-issuer'));
});

test('claim-lint allows doctrine-safe negations', () => {
  const findings = scanText(
    'README.md',
    [
      'TSP verifies evidence state, not truth or final legal outcome.',
      'TSP does not verify truth, factual correctness, legal outcome, safety, hallucination-free output, or EU AI Act compliance.',
      'Public contribution does not grant TrustBadge authorization or Official TSP Conformance Attestation.',
      'Integrity verified. Factual correctness not certified.'
    ].join('\n')
  );

  assert.deepEqual(findings, []);
});

test('claim-lint scans expanded text-like paths', () => {
  assert.equal(shouldScanPath('.github/workflows/claim-lint.yml'), true);
  assert.equal(shouldScanPath('.github/CONTRIBUTING.md'), true);
  assert.equal(shouldScanPath('src/index.js'), true);
  assert.equal(shouldScanPath('src/index.ts'), true);
  assert.equal(shouldScanPath('scripts/claim-lint.mjs'), false);
  assert.equal(shouldScanPath('test/claim-lint.test.mjs'), false);
  assert.equal(shouldScanPath('package-lock.json'), false);
});
