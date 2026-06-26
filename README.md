> ## ⚠️ TSP public alpha preview
>
> This repository contains historical TSP alpha-preview materials. It is not a final TSP release, is not certified for production use, and does not grant any right to claim TSP compatibility, TSP certification, TrustBadge authorization, or participation in the official TSP integrity domain.
>
> TSP v3.1+ is governed by the LexiCo TSP License and official conformance process.

<!-- tsp-alpha-banner:end -->

# tsp-verify — JavaScript port of the TSP reference verifier core

Verify [Trust Standard Protocol](https://truststandardprotocol.com) evidence
from JavaScript: canonicalization (RFC 8785 JCS, byte-identical to the reference),
trust envelope + trust manifest validation, Ed25519 local verification with the
granular check profile, and offline **license-artifact** verification
(`tsp.license.v1`, ADR-0010).

**Zero dependencies** — Node ≥ 20 only (uses the built-in Web Crypto API).

```js
import { verifyLocal } from "tsp-verify";

const result = await verifyLocal(envelope, { knownPublicKey });
console.log(result.valid);                  // true / false — fail-closed
console.log(result.checks.ledgerHash);      // granular per-check verdicts
```

It also verifies **commercial licenses** (TSP License Artifact v1) — a sibling
artifact validated fully offline through `license → issuer → pinned license-root`,
reusing the same crypto substrate:

```js
import { verifyLicense } from "tsp-verify";

const r = await verifyLicense(
  bundle,                                    // a tsp.license-bundle.v1
  {
    origin: "https://customer.example",      // this deployment's manifest origin
    trustedRootKeys: [pinnedRoot],           // [{ rootKeyId, publicKey }]
    requiredModules: ["gateway-pro"],        // default-deny per module
  },
  new Date(),                                // or an ISO-8601 string
);
console.log(r.ok, r.reason);                 // e.g. true "valid" | false "license_expired"
```

## Conformance is the correctness claim

This port is correct because it reproduces the normative verdicts of the
[tsp-spec](https://github.com/trust-standard-protocol/tsp-spec) fixture suites — the v3.0
TrustEnvelope vectors (including the ADR-0002 tamper-rejection profile) and the
ADR-0010 license vectors — not because anyone says so. Two separate
checksum-pinned tracks, never mixed. Prove it:

```bash
npm run conformance
# integrity: 10 v3.0 fixtures match pinned SHA256SUMS
# integrity: 9 license fixtures match pinned SHA256SUMS
# ✓ all 23 conformance vectors pass against the JS port
```

A failure of that runner is a bug in this port, never grounds to adjust the
fixtures (ADR-0008: the spec is the normative authority).

## API

- `canonicalize(value)` — RFC 8785 JCS canonical string.
- `sha256Hex(string)` — SHA-256 hex of a UTF-8 string.
- `validateTrustEnvelopeShape(envelope)` / `validateTrustManifest(manifest)` — structural validation.
- `verifyLocal(envelope, { knownPublicKey })` — local-plane verify (schema + content + ledger + Ed25519 signatures).
- `validateLicenseBundleShape(bundle)` / `verifyLicense(bundle, config, now)` — offline license-artifact verification.

Verification only: this package holds no private keys and signs nothing. Part of
the `tsp-verify` family alongside the Python, Rust, and Go ports.

## Releasing

Publishing is automated and runs **with npm provenance** (a signed attestation
tying the published tarball to this repo and the exact CI run — apt for a
provenance project). To cut a release:

1. Bump `version` in `package.json` (e.g. `0.1.1`) and commit to `main`.
2. Tag and push: `git tag v0.1.1 && git push origin v0.1.1`.

The `Release (npm)` workflow then runs the test + conformance suites, verifies
the tag matches `package.json`, and runs `npm publish --provenance --access public`.

One-time setup: add a repo secret **`NPM_TOKEN`** (npm Automation or
Granular-Access token with publish rights for `tsp-verify`) under
*Settings → Secrets and variables → Actions*. npm versions are immutable, so
each release needs a new version number.
