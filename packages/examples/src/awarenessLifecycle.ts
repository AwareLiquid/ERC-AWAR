import { computeDeltaId, type ExperienceDelta, type MemoryTypeName } from "@erc-awar/spec";
import { type AwarenessCard, MemoryBridge } from "@erc-awar/mcp-bridge";
import { type Log, noop } from "./log.js";

const SPACE = "0x" + "11".repeat(32);
const AGENT = "0x" + "a1".repeat(20);

export interface LifecycleResult {
  spaceId: string;
  agent: string;
  head: string;
  version: number;
  /** Count of committed deltas by MEMORY_* category. */
  byType: Partial<Record<MemoryTypeName, number>>;
  /** The exported, ordered evolution chain (an ERC-8269 portability capsule). */
  capsule: readonly ExperienceDelta[];
  verification: { valid: boolean; errors: string[] };
}

/**
 * End-to-end: a fresh agent records a day's worth of Awareness cards, refines a
 * memory (versioned update), attaches a retrieval embedding, then exports and
 * verifies the whole evolution chain. Demonstrates bridge -> delta-engine.
 */
export function runAwarenessLifecycle(log: Log = noop): LifecycleResult {
  const bridge = new MemoryBridge(SPACE, AGENT);

  const cards: AwarenessCard[] = [
    {
      id: "policy:no-pii",
      type: "decision",
      content: "Never persist user PII off the local device.",
      createdAt: 1_700_000_000,
    },
    {
      id: "insight:rrf",
      type: "insight",
      title: "Hybrid retrieval",
      content: "BM25 + dense vectors fused with RRF beat either alone.",
      tags: ["retrieval", "rag"],
      createdAt: 1_700_000_100,
    },
    {
      id: "sol:build-green",
      type: "solution",
      content: "Inline an empty postcss config so vitest stops walking parent dirs.",
      createdAt: 1_700_000_200,
    },
    {
      id: "wf:ship",
      type: "workflow",
      content: "typecheck -> test -> build -> commit -> push.",
      createdAt: 1_700_000_300,
    },
    {
      id: "mem:dark-mode",
      type: "memory",
      content: "User said they prefer dark mode.",
      createdAt: 1_700_000_400,
    },
    {
      id: "task:m5",
      type: "task",
      content: "Ship M5 examples and benchmark.",
      createdAt: 1_700_000_500,
    },
  ];

  let ts = 1_700_000_000;
  for (const card of cards) {
    const d = bridge.ingest(card, { timestamp: ts++ });
    log(`commit v${d.version} ${d.memoryType.padEnd(8)} ${card.id} -> ${computeDeltaId(d)}`);
  }

  // Refine an existing memory: re-ingest the same id -> a linked update.
  const refined = bridge.ingest(
    { id: "insight:rrf", type: "insight", content: "RRF k=60 is a robust default fusion constant." },
    { timestamp: ts++ },
  );
  log(`refine v${refined.version} prior=${refined.priorMemoryCommitment.slice(0, 10)}…`);

  // Attach a retrieval vector from the index (all-MiniLM-L6-v2 is 384-dim;
  // truncated here for the demo).
  const emb = bridge.ingestEmbedding(
    { id: "emb:dark-mode", model: "all-MiniLM-L6-v2", dim: 4, vector: [0.11, -0.02, 0.4, 0.37], metric: "cosine" },
    { timestamp: ts++ },
  );
  log(`embed v${emb.version} ${emb.memoryType} dim=4`);

  const byType: Partial<Record<MemoryTypeName, number>> = {};
  for (const d of bridge.export()) byType[d.memoryType] = (byType[d.memoryType] ?? 0) + 1;

  const verification = bridge.verify();
  log(`verify -> ${verification.valid ? "OK" : verification.errors.join("; ")}`);

  return {
    spaceId: bridge.chain.spaceId,
    agent: bridge.chain.agent,
    head: bridge.chain.head,
    version: bridge.chain.version,
    byType,
    capsule: bridge.export(),
    verification,
  };
}
