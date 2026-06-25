# tsp-verify

Public verifier implementation for the clean vNext Trust Standard Protocol
architecture.

## Doctrine

TSP verifies evidence state, not truth or final legal outcome.

## Scope

This repository provides verification code and tests for TSP evidence receipts.
Verification checks evidence-state signals such as schema, canonical form,
hashes, signatures, manifest binding, custody state, and profile state.

This repository does not sign production receipts, grant production issuance
rights, grant TrustBadge authorization, or grant Official TSP Conformance
Attestation.

## License

Code in this repository is licensed under Apache-2.0. See `LICENSE`.

## Scaffold

```text
src/
  Verifier implementation entry points.
test/
  Verifier tests and fixture checks.
```

