# ADR-0003: Private Payload and Locator Commitments

- Status: Accepted
- Date: 2026-07-14

## Context

Direct hashes of short memories are vulnerable to guessing. An unsigned URI can
be replaced by a relayer and can itself disclose sensitive storage metadata.

## Decision

The baseline uses domain-separated commitments with 32-byte salts. Low-entropy
payloads use secret salts or encrypted bytes with fresh keys and nonces. The
Delta contains `locatorCommitment`, never a required raw URI. Salts, keys,
payloads, and locators form a private witness distributed off-chain.

## Consequences

The Registry cannot retrieve memory and does not need access to private data.
Applications must manage witness availability and key recovery. Public metadata
leakage is reduced but not eliminated.
