# @erc-awar/spec

ERC-83xx core spec utilities (M1): **Experience Delta** schemas, **JCS** canonicalization, and **commitment hashing**.

Implements the normative pieces of [SPEC.md](../../SPEC.md) §4–6 so higher layers
(delta-engine, mcp-bridge, contracts) share one deterministic definition of a
delta id and content commitment.

## Install / build / test

```bash
npm install
npm run build      # tsc -> dist/
npm test           # vitest (24 tests)
```

## What's inside

- **`schemas/experience-delta.schema.json`** — JSON Schema for an off-chain Experience Delta record.
- **`schemas/memory-categories/*.schema.json`** — content schemas for the 8 canonical memory types (`TEXT, EMBEDDING, LATENT, TOOL_TRACE, EPISODIC, POLICY, SHARED_WORKING, PROOF`).
- **`canonicalize(value)`** — JCS (RFC 8785) subset for delta metadata (sorted keys, integers only; floats live in opaque payloads, not the preimage).
- **`keccak256` / `contentCommitment`** — `@noble/hashes` keccak256 over bytes; `contentCommitment(payload)` = `keccak256(payload)`.
- **`computeDeltaId(delta)`** — `keccak256(JCS(preimage))`; signature-free, hex lowercased, `memoryType` encoded as its integer code to match the on-chain Solidity enum.
- **`validateDelta` / `validateContent`** — ajv validation against the schemas.

## Usage

```ts
import {
  ZERO32,
  computeDeltaId,
  contentCommitment,
  validateDelta,
  type ExperienceDelta,
} from "@erc-awar/spec";

const payload = new TextEncoder().encode(JSON.stringify({ text: "chose pgvector over pinecone" }));

const delta: ExperienceDelta = {
  schema: "erc83xx/delta/v0",
  spaceId: "0x" + "11".repeat(32),
  priorMemoryCommitment: ZERO32,
  newContentCommitment: contentCommitment(payload),
  memoryType: "TEXT",
  schemaHash: "0x" + "33".repeat(32),
  inferenceAnchor: ZERO32, // ERC-8263, optional
  inputHash: ZERO32,       // ERC-8299 / WYRIWE, optional
  previousDelta: ZERO32,
  timestamp: Math.floor(Date.now() / 1000),
  version: 1,
  agent: "0x" + "44".repeat(20), // ERC-8004 identity
  uri: "ipfs://bafy...",
};

validateDelta(delta);          // { valid: true, errors: [] }
const id = computeDeltaId(delta); // 0x… 32-byte deltaId
```

## Notes / open items

- `deltaId` is defined over the **JCS canonical JSON** per SPEC. On-chain struct
  hashing (abi.encode / EIP-712) alignment is an M3 (contracts) concern — see
  SPEC §13 open questions.
- Content payloads are committed as **opaque bytes**; encrypt before committing
  for private memory.

License: Apache-2.0
