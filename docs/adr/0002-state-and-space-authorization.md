# ADR-0002: State Roots and Space Authorization

- Status: Accepted
- Date: 2026-07-14

## Context

A previous-record pointer did not prove that the claimed prior memory state was
the current state. Recovering any signer also allowed another account to append
to an existing namespace.

## Decision

Every transition binds the exact current state root and next sequence. The
Registry computes the next state root. A Space ID derives from its initial
controller and salt. Each Space stores a controller and an operational authorizer.
The authorizer approves transitions; the controller approves nonce-bound account
rotation. Both EOA and EIP-1271 accounts are supported.

## Consequences

Takeover and stale-state writes are rejected on-chain. Concurrent branching is
not represented by v1 and must be resolved off-chain before committing.
