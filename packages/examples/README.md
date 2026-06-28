# @erc-awar/examples — end-to-end demos & benchmark (M5)

Runnable demos that wire the whole stack together: `@erc-awar/mcp-bridge` →
`@erc-awar/delta-engine` → `@erc-awar/spec`, plus an on-chain lifecycle against
the `contracts/` registry & market.

## Run

```bash
npm run build -w @erc-awar/examples
npm run demo  -w @erc-awar/examples   # runs all three TS demos
npm test      -w @erc-awar/examples   # asserts every demo's invariants (7 tests)
```

### 1. Awareness lifecycle (`awarenessLifecycle.ts`)

A fresh agent records six Awareness cards (decision/insight/solution/workflow/
memory/task), refines one memory (a linked versioned update), attaches a
retrieval embedding, then exports and verifies the evolution chain — an
ERC-8269-style portability capsule of 8 Experience Deltas
(`{POLICY:1, TEXT:4, EPISODIC:2, EMBEDDING:1}`).

### 2. Multi-agent merge (`multiAgentMerge.ts`)

Two agents edit the same Memory Space concurrently (SPEC §4.2). The overlapping
`summary` id is resolved by last-writer-wins (later timestamp; ties broken by the
lexicographically smaller agent), and the merged state is committed to one chain.

### 3. Benchmark (`benchmark.ts`)

Structural, deterministic measurement (no model inference): commit throughput
plus the core ERC-83xx economic property — a memory's on-chain footprint is a
fixed 32-byte commitment regardless of payload size (~19× smaller than the
~0.5 KB card it commits, in the default run).

## On-chain end-to-end (Foundry)

`contracts/script/Demo.s.sol` walks the full on-chain lifecycle: commit genesis
→ chain a second delta → list on the market → buyer purchases a license (ERC-20
settlement + royalty split) → revoke → proveDeletion.

```bash
cd contracts
forge script script/Demo.s.sol -vv          # run the narrated demo
forge test --match-contract DemoTest -vv     # same flow as a CI-covered test
```
