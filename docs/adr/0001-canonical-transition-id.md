# ADR-0001: One EIP-712 Transition Identifier

- Status: Accepted
- Date: 2026-07-14

## Context

The prototype computed a JCS hash in TypeScript and an EIP-712 struct hash in
Solidity. The same logical record therefore had two identifiers.

## Decision

`transitionId` is exclusively the EIP-712 `hashStruct` of the seven-field
`ExperienceDelta v1`. JSON is a transport representation only. The signing
digest wraps `transitionId` in the EIP-712 domain; it is not another record ID.

## Consequences

All implementations can compare one identifier. Prototype IDs are not compatible
and require explicit migration. Golden Vectors are a release gate.
