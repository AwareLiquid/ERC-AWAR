# @erc-awar/mcp-bridge — Awareness ↔ ERC-83xx (M4)

Bridges [Awareness](https://github.com/everest-an/Awareness-Market) memory cards
into ERC-83xx **Experience Deltas** (SPEC §4–§5). Each ingested card becomes one
verifiable memory state transition; re-using a card `id` extends that memory's
evolution chain. Built on `@erc-awar/spec` and `@erc-awar/delta-engine`.

## Card → MEMORY_\* mapping

The real Awareness taxonomy (four knowledge-card kinds + two working stores) maps
onto the eight canonical categories. Each choice follows the target schema's own
description (SPEC §5, §13.6):

| Awareness card | MEMORY_\* | Why |
| --- | --- | --- |
| `decision` | `POLICY` | constrains future agent behavior |
| `insight` | `TEXT` | human-readable knowledge |
| `solution` | `TEXT` | human-readable knowledge |
| `workflow` | `TEXT` | human-readable knowledge |
| `memory` | `EPISODIC` | an event observed at a point in time |
| `task` | `EPISODIC` | a unit of work observed/created at a time |

The mapping is overridable via `BridgeOptions.cardTypeMap`. `EMBEDDING` is
produced from Awareness's retrieval vectors (all-MiniLM-L6-v2, 384-dim) via
`ingestEmbedding`; `LATENT` / `SHARED_WORKING` / `TOOL_TRACE` / `PROOF` come from
other sources and have no default card mapping.

`schemaHash` is the keccak256 of each category's canonical JSON Schema `$id`, so
off-chain producers and the on-chain `ExperienceDelta.schemaHash` agree.

## Usage

```ts
import { MemoryBridge, createBridgeTools } from "@erc-awar/mcp-bridge";

const bridge = new MemoryBridge(spaceId, agentAddress);

const delta = bridge.ingest({
  id: "card-42",
  type: "decision",
  content: "never store PII off-device",
});
// -> MEMORY_POLICY Experience Delta, validated against the spec schema

bridge.verify();        // { valid: true, errors: [] }
bridge.export();        // ordered delta chain (ERC-8269 portability capsule)

// Mount on any MCP server:
const tools = createBridgeTools(bridge);
// awareness_ingest_card | awareness_ingest_embedding
// memory_export_chain   | memory_verify_chain
```

The `createBridgeTools` handlers are framework-agnostic (no MCP SDK dependency),
so they are unit-testable and can be wired to a stdio/HTTP MCP server.

## Test

```bash
npm test -w @erc-awar/mcp-bridge   # 21 tests
```
