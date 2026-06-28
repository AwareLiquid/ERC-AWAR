---
eip: 83xx
title: Agent Experience Delta Commitments
description: An append-only registry committing to verifiable agent memory state transitions; raw memory stays encrypted off-chain.
author: everest-an (@everest-an)
discussions-to: https://github.com/AwareLiquid/ERC-AWAR/discussions
status: Draft
type: Standards Track
category: ERC
created: 2026-06-28
requires: 20, 712
---

<!--
  The EIP number is assigned by the EIP editors; "83xx" is the project's
  requested placeholder. Before submission to ethereum/EIPs, replace the
  `discussions-to` URL with the canonical Ethereum Magicians thread.
-->

## Abstract

This proposal defines an interface for treating an autonomous agent's memory as a
sequence of *verifiable state transitions* rather than as opaque storage. Each
transition is an **Experience Delta**: a record that commits to a prior memory
state, a new memory state, the typed schema describing the memory, and optional
links to the inference and inputs that produced the change. Only commitments,
events, references, and proofs are written on-chain; the raw memory payload
remains encrypted off-chain. Deltas form a per-space, append-only evolution chain
addressed by an [EIP-712](./eip-712.md) structured-data hash. The interface also
specifies revocation and an optional proof-of-deletion primitive for compliance.

## Motivation

Agent identity, execution, input provenance, and inference attestation can each
be made verifiable on Ethereum, but the *memory that connects them over time*
has no shared representation. Without it, an agent is a stateless endpoint: there
is no way to prove how its knowledge, policies, or episodic recollections evolved,
who authored a change, which inference produced it, or that a deletion request
was honored.

Storing raw memory on-chain is neither private nor economical. The economically
and legally tractable object is a *commitment* to a memory state plus the
metadata needed to audit its evolution. This proposal standardizes that object so
that memory updates become composable with identity, settlement, and the broader
agent stack, and so that third parties (users, auditors, insurers, counterparty
agents) can verify an agent's adaptation history without access to its private
representations.

## Specification

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
document are to be interpreted as described in RFC 2119 and RFC 8174.

### Definitions

- **Memory Space**: a namespace, identified by a `bytes32` `spaceId`, that owns
  an independent evolution chain. A `spaceId` SHOULD identify a memory subject.
- **Experience Delta**: one committed memory state transition (the struct below).
- **Content commitment**: a `bytes32` binding to an off-chain memory payload.
- **Delta identifier** (`deltaId`): the content address of a Delta (see below).

### Memory types

A conforming registry MUST define the memory category as an enumeration whose
ordinal values are normative:

```solidity
enum MemoryType {
    TEXT,           // 0
    EMBEDDING,      // 1
    LATENT,         // 2
    TOOL_TRACE,     // 3
    EPISODIC,       // 4
    POLICY,         // 5
    SHARED_WORKING, // 6
    PROOF           // 7
}
```

Each Delta carries a `schemaHash` identifying the schema that describes how to
interpret its content commitment. The `schemaHash` for a category SHOULD be the
`keccak256` of that category's canonical schema identifier, so that off-chain
producers and on-chain records agree.

### Experience Delta record

```solidity
struct ExperienceDelta {
    bytes32   spaceId;               // memory namespace / subject
    bytes32   priorMemoryCommitment; // prior content commitment; 0 for genesis
    bytes32   newContentCommitment;  // new off-chain payload commitment
    MemoryType memoryType;
    bytes32   schemaHash;            // how to interpret the commitment
    bytes32   inferenceAnchor;       // related inference attestation; 0 if none
    bytes32   inputHash;             // related input commitment; 0 if none
    bytes32   previousDelta;         // evolution-chain pointer; 0 for genesis
    uint64    timestamp;             // unix seconds
    uint64    version;               // monotonic per space, starting at 1
}
```

### Content commitment

`newContentCommitment` MUST equal the `keccak256` hash of the
RFC 8785 (JSON Canonicalization Scheme) serialization of the off-chain payload.
For non-textual payloads (for example dense vectors committed under `EMBEDDING`),
the committed payload object MUST include the parameters required to interpret it
(such as model identifier and dimensionality). Implementations MUST NOT place raw
prompts, private memory, embeddings, or latent state in calldata.

### Delta identifier

The `deltaId` MUST be the EIP-712 `hashStruct` of the `ExperienceDelta`, using the
type:

```
ExperienceDelta(bytes32 spaceId,bytes32 priorMemoryCommitment,bytes32 newContentCommitment,uint8 memoryType,bytes32 schemaHash,bytes32 inferenceAnchor,bytes32 inputHash,bytes32 previousDelta,uint64 timestamp,uint64 version)
```

where `memoryType` is encoded as its `uint8` ordinal. The signing digest MUST be
`keccak256(0x1901 ‖ domainSeparator ‖ deltaId)` with the EIP-712 domain
`name = "ERC83xx"`, `version = "1"`, the current `chainId`, and
`verifyingContract` set to the registry address. Pinning `chainId` in the domain
and `spaceId` and `previousDelta` in the struct prevents cross-chain and
cross-space replay.

### Registry interface

```solidity
interface IERC83xx {
    event ExperienceCommitted(
        bytes32 indexed spaceId,
        bytes32 indexed deltaId,
        bytes32 previousDelta,
        MemoryType memoryType,
        address indexed agent,
        string  uri
    );
    event MemoryRevoked(bytes32 indexed spaceId, bytes32 indexed deltaId, address by);
    event DeletionProven(bytes32 indexed spaceId, bytes32 indexed deltaId, bytes32 evidence);

    function commitDelta(
        ExperienceDelta calldata d,
        string calldata uri,
        bytes calldata signature
    ) external returns (bytes32 deltaId);

    function head(bytes32 spaceId) external view returns (
        bytes32 deltaId, bytes32 commitment, uint64 version
    );

    function revoke(bytes32 spaceId, bytes32 deltaId) external;

    function proveDeletion(bytes32 spaceId, bytes32 deltaId, bytes calldata evidence) external;
}
```

### Commit semantics

On `commitDelta`:

1. The registry MUST recover the signer `agent` from `signature` over the EIP-712
   digest of `d`, and MUST reject a signature that does not recover to a non-zero
   address. The signer is the authoring identity; the caller MAY be a relayer.
2. The registry MUST reject a Delta whose `deltaId` already exists.
3. For the first Delta in a space (no existing head), the registry MUST require
   `previousDelta == 0` and `version == 1`.
4. Otherwise, the registry MUST require `previousDelta` to equal the space's
   current head `deltaId` and `version` to equal the current head version plus
   one, and SHOULD require `timestamp` to be greater than or equal to the head
   timestamp.
5. The registry MUST update the space head to the new Delta and emit
   `ExperienceCommitted`.

`uri` is an off-chain locator for the encrypted payload and SHOULD use one of the
schemes `ipfs://`, `ethstorage://`, `ar://`, or `https://`. The `uri` MUST NOT be
empty.

### Revocation and deletion proof

`revoke` MUST mark a Delta as revoked and emit `MemoryRevoked`; a revoked Delta
MUST NOT be revoked again. `proveDeletion` allows a storage system to submit
cryptographic evidence that the off-chain payload or its decryption key has been
removed; it MUST emit `DeletionProven` with `keccak256(evidence)` and SHOULD
require the Delta to be revoked first. Authorization for `revoke` and
`proveDeletion` is delegated to the deployment's rights and mandate policy and is
out of scope for this interface.

Revocation and proof-of-deletion are commitments about state and authorized
storage; they do not, and cannot, guarantee universal deletion of data already
observed off-chain.

## Rationale

**Commitments, not data.** The on-chain footprint of a memory is a fixed-size
commitment regardless of payload size, keeping the chain a provenance and
accountability layer while raw memory stays private and off-chain.

**EIP-712 identifier and signature.** Using `hashStruct` as the `deltaId` makes a
Delta content-addressed and makes the authorizing signature meaningful and
wallet-displayable. Binding `chainId`, `spaceId`, and `previousDelta` into the
signed data is the minimal set that prevents replay across chains, spaces, and
positions in the chain.

**Signer recovery instead of `msg.sender`.** Recovering the agent from the
signature decouples authorship from gas payment, enabling relayed and batched
submissions without losing identity attribution.

**Linear chain.** A linear, append-only history is simple to verify
(recompute `deltaId`, check `previousDelta` linkage and monotonic `version`).
Branching memory graphs are deliberately left to a future extension.

**Typed categories.** A small fixed enumeration with per-Delta `schemaHash` lets
applications map richer taxonomies onto interoperable categories while still
committing to exactly how each payload is interpreted.

## Backwards Compatibility

No backward compatibility issues are introduced; this proposal defines a new
interface and event set. Settlement for memory licensing reuses [ERC-20](./eip-20.md)
and authorization MAY reuse existing identity, rights, and mandate components
without changes to this interface.

## Test Cases

A reference test suite covers: genesis and chained commits; `deltaId`
recomputation; EIP-712 signer recovery; rejection of bad genesis parameters,
broken chain links, non-monotonic timestamps, duplicate deltas, and empty URIs;
and the `revoke` then `proveDeletion` ordering. For example, a genesis commit MUST
satisfy `previousDelta == 0 && version == 1`, and `head(spaceId)` MUST then return
the new `deltaId`, its `newContentCommitment`, and `version == 1`. The executable
tests are provided with the reference implementation.

## Reference Implementation

A reference implementation is available at
<https://github.com/AwareLiquid/ERC-AWAR>:

- `contracts/` — `IERC83xx`, an `ERC83xxRegistry` implementing the commit / head /
  revoke / proveDeletion semantics with EIP-712 signer recovery, and an optional
  licensing market settling in ERC-20.
- `packages/spec` — canonicalization, content commitment, and the `deltaId`
  derivation.
- `packages/delta-engine` — building and verifying the evolution chain, and
  concurrent-change merge.
- `packages/mcp-bridge` — mapping an application-layer card taxonomy onto the
  `MemoryType` categories.

## Security Considerations

- **Replay and impersonation.** The EIP-712 domain pins `chainId` and the signed
  struct pins `spaceId` and `previousDelta`; implementations MUST verify all
  three. Signatures MUST be checked for `s`-value malleability.
- **Data availability.** A valid on-chain commitment does not guarantee long-term
  retrievability of off-chain data; deployments SHOULD use redundant storage and
  availability guarantees.
- **Deletion semantics.** `proveDeletion` attests removal from authorized storage
  or key destruction; it is not a guarantee of universal erasure and MUST NOT be
  represented as such.
- **Authorization.** This interface does not mandate an authorization model for
  `revoke` and `proveDeletion`; deployments MUST enforce an appropriate rights or
  mandate policy, as an over-permissive policy allows unauthorized revocation.
- **Privacy.** Commitments and `schemaHash` values are public; producers MUST
  ensure committed payloads and their canonical serializations do not leak
  sensitive data through low-entropy preimages.

## Copyright

Copyright and related rights waived via [CC0](./LICENSE.md).
