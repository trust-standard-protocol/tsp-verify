/**
 * tsp-verify -- JavaScript port of the TSP reference verifier core.
 *
 * Normative authority is trust-standard-protocol/tsp-spec (ADR-0008): this port is conformant
 * because it reproduces the spec's fixture verdicts, not because it is trusted.
 * Run `npm run conformance` to prove it on your machine. Verification only:
 * holds no keys, signs nothing. Zero dependencies (Node >= 20 Web Crypto).
 */
export { canonicalize } from './canonical.js';
export { sha256Hex } from './hash.js';
export { validateTrustEnvelopeShape } from './schema.js';
export { validateTrustManifest } from './manifest.js';
export { verifyLocal } from './verify-local.js';
export { validateLicenseBundleShape } from './license-schema.js';
export { verifyLicense } from './verify-license.js';
