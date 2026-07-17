# Agent Memory State v1

Status: pre-ERC community draft

This document is the repository-level specification for the implementation. The
submission-shaped ERC text is in `erc/erc-xxxx-agent-memory-state.md`.

## Scope

Agent Memory State v1 defines an authorized, append-only state accumulator for
private agent memory transitions. It standardizes commitments and state changes,
not raw memory storage or a product taxonomy.

```text
private memory operation
  -> privacy-preserving delta commitment
  -> authorized ExperienceDelta v1
  -> transitionId
  -> nextStateRoot
```

## Normative Delta

```solidity
struct ExperienceDelta {
    bytes32 spaceId;
    uint64 sequence;
    bytes32 prevStateRoot;
    bytes32 deltaCommitment;
    bytes32 provenanceCommitment;
    bytes32 profileId;
    bytes32 locatorCommitment;
}
```

No additional field participates in `transitionId`. In particular, v1 has no
author field, timestamp, raw URI, memory enum, `previousDelta`, or separate input
and inference fields.

## Canonical hashes

```text
EXPERIENCE_DELTA_TYPE =
"ExperienceDelta(bytes32 spaceId,uint64 sequence,bytes32 prevStateRoot,bytes32 deltaCommitment,bytes32 provenanceCommitment,bytes32 profileId,bytes32 locatorCommitment)"

transitionId = keccak256(abi.encode(
  keccak256(bytes(EXPERIENCE_DELTA_TYPE)),
  spaceId,
  sequence,
  prevStateRoot,
  deltaCommitment,
  provenanceCommitment,
  profileId,
  locatorCommitment
))

MEMORY_STATE_TYPE =
"MemoryState(bytes32 prevStateRoot,bytes32 transitionId)"

nextStateRoot = keccak256(abi.encode(
  keccak256(bytes(MEMORY_STATE_TYPE)),
  prevStateRoot,
  transitionId
))
```

JCS is not used to calculate a transition identifier. JSON sequence values are
decimal strings so the full `uint64` range can be represented losslessly.

## Space lifecycle

### Derivation

```text
MEMORY_SPACE_TYPE = "MemorySpace(address initialController,bytes32 salt)"
spaceId = keccak256(abi.encode(
  keccak256(bytes(MEMORY_SPACE_TYPE)),
  initialController,
  salt
))
```

This makes a namespace claim cryptographically specific to its initial controller.

### Registration

A Space is registered once with a non-zero controller and authorizer. The
controller authorizes:

```text
SpaceRegistration(bytes32 spaceId,address controller,address authorizer)
```

### Rotation

The controller can atomically rotate controller and authorizer by authorizing:

```text
SpaceAuthorization(bytes32 spaceId,address newController,address newAuthorizer,uint64 nonce)
```

The nonce begins at zero and each update signs the next nonce.

### Transition

The Registry accepts a Delta only when:

1. its Space exists;
2. `deltaCommitment` and `profileId` are non-zero;
3. `sequence == head.sequence + 1`;
4. `prevStateRoot == head.stateRoot`; and
5. the configured authorizer approves the EIP-712 digest.

The Registry calculates the Transition ID and next state root atomically.

## Authorization

The EIP-712 domain is fixed to:

```text
name = "AgentMemoryState"
version = "1"
chainId = current chain
verifyingContract = Registry
```

EOAs use non-malleable ECDSA. Contract wallets, multisigs, and smart accounts use
EIP-1271. A direct call from the exact required account may use an empty signature.
Relayers have no protocol authority.

## Privacy commitments

The SDK implements domain-separated commitments for delta payloads, provenance,
and locators. A low-entropy plaintext payload must be encrypted or committed with
a secret salt. A public salt alone does not stop targeted guessing.

`profileId` identifies application semantics. The core does not impose text,
embedding, policy, latent, or other memory categories.

## Layering

| Layer | Contents |
|---|---|
| Core | Delta, hashes, state roots, Space authorization, EOA/EIP-1271 signatures |
| Extensions | Deletion attestations and other optional records |
| Experimental | Market, REC, cognition-asset mechanisms |
| Adapters | Awareness and other memory-engine mappings |

## Conformance

An implementation is v1-conformant only if it:

1. uses the exact type strings and ABI encoding above;
2. passes `test-vectors/v1.json`;
3. enforces Space, sequence, prior-root, and authorization checks;
4. signs every Delta field, including `locatorCommitment`;
5. supports EIP-1271 authorizers or clearly declares a non-conforming subset; and
6. does not require raw cognition in public calldata.

The repository checks the vector in Solidity, the core TypeScript SDK, and a
dependency-isolated TypeScript implementation.

## Non-goals

v1 does not standardize identity registries, inference proofs, input provenance
formats, storage availability, retrieval, merge algorithms, cross-chain
migration, deletion guarantees, licensing, payments, tokenization, or
consciousness claims.

## Migration

Prototype records are not wire-compatible. A migration creates a new v1 Space
and commits a genesis payload that binds the old export/root and migration tool.
No old ID is silently reinterpreted as a v1 Transition ID.

## Release criteria

- clean checkout installs with a frozen lockfile;
- TypeScript build, typecheck, and tests pass;
- Solidity formatting, unit tests, fuzz tests, and invariants pass;
- all implementations pass the Golden Vector;
- an external security review is complete before production deployment; and
- a separately maintained implementation exists before claiming broad adoption.
