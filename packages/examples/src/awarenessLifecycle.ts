import type { ExperienceDelta } from "@erc-awar/core";
import {
  AwarenessAdapter,
  type AwarenessCard,
  type AwarenessProfileName,
} from "@erc-awar/awareness-adapter";
import { type Log, noop } from "./log.js";

const SPACE = "0x" + "11".repeat(32);

export interface LifecycleResult {
  spaceId: string;
  stateRoot: string;
  sequence: bigint;
  byProfile: Partial<Record<AwarenessProfileName, number>>;
  capsule: readonly ExperienceDelta[];
  verification: { valid: boolean; errors: string[] };
}

export function runAwarenessLifecycle(log: Log = noop): LifecycleResult {
  const adapter = new AwarenessAdapter(SPACE);
  const cards: AwarenessCard[] = [
    { id: "policy:no-pii", type: "decision", content: "Never persist user PII off-device.", createdAt: 1_700_000_000 },
    { id: "insight:rrf", type: "insight", content: "BM25 plus vectors fused with RRF.", createdAt: 1_700_000_100 },
    { id: "sol:build-green", type: "solution", content: "Keep the clean build deterministic.", createdAt: 1_700_000_200 },
    { id: "wf:ship", type: "workflow", content: "typecheck, test, build, release.", createdAt: 1_700_000_300 },
    { id: "mem:dark-mode", type: "memory", content: "User prefers dark mode.", createdAt: 1_700_000_400 },
    { id: "task:alpha", type: "task", content: "Ship the alpha.", createdAt: 1_700_000_500 },
  ];

  let timestamp = 1_700_000_000;
  for (const card of cards) {
    const record = adapter.ingest(card, { timestamp: timestamp++ });
    log(`commit #${record.delta.sequence} ${record.profile} ${card.id} -> ${record.transitionId}`);
  }
  adapter.ingest(
    { id: "insight:rrf", type: "insight", content: "RRF k=60 is a robust default." },
    { timestamp: timestamp++ },
  );
  adapter.ingestEmbedding(
    { id: "emb:dark-mode", model: "all-MiniLM-L6-v2", dim: 4, vector: [0.11, -0.02, 0.4, 0.37] },
    { timestamp: timestamp++ },
  );

  const byProfile: Partial<Record<AwarenessProfileName, number>> = {};
  for (const record of adapter.export()) {
    byProfile[record.profile] = (byProfile[record.profile] ?? 0) + 1;
  }
  const verification = adapter.verify();
  return {
    spaceId: adapter.machine.spaceId,
    stateRoot: adapter.machine.stateRoot,
    sequence: adapter.machine.sequence,
    byProfile,
    capsule: adapter.exportDeltas(),
    verification,
  };
}
