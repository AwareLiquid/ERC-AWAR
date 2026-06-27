import type { MemoryTypeName } from "@erc-awar/spec";

/**
 * Awareness application-layer card taxonomy.
 *
 * Grounded in the real Awareness memory MCP (github.com/everest-an/Awareness-Market):
 * four knowledge-card kinds (decision / insight / solution / workflow) plus the
 * working stores `memory` and `task`. These are NOT ERC-83xx types — the bridge
 * maps them onto the eight canonical MEMORY_* categories (SPEC §5, §13.6).
 */
export const AWARENESS_CARD_TYPES = [
  "decision",
  "insight",
  "solution",
  "workflow",
  "memory",
  "task",
] as const;

export type AwarenessCardType = (typeof AWARENESS_CARD_TYPES)[number];

export function isAwarenessCardType(value: unknown): value is AwarenessCardType {
  return (
    typeof value === "string" &&
    (AWARENESS_CARD_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Default card -> MEMORY_* mapping.
 *
 * Rationale (each choice follows the target schema's own description):
 * - decision -> POLICY:   a decision constrains future agent behavior, which is
 *   exactly MEMORY_POLICY ("a policy / rule / preference that constrains future
 *   agent behavior").
 * - insight / solution / workflow -> TEXT: human-readable knowledge cards; the
 *   MEMORY_TEXT schema explicitly lists these as `cardKind` examples.
 * - memory -> EPISODIC:   a recollection of something observed at a point in
 *   time (MEMORY_EPISODIC: "an event observed at a point in time").
 * - task -> EPISODIC:     a unit of work created/observed at a time; tracked as
 *   an event with `occurredAt`.
 *
 * EMBEDDING / LATENT / TOOL_TRACE / SHARED_WORKING / PROOF have no default card
 * source — they come from the retrieval index, LatentMAS collaboration, raw
 * execution traces, and proofs respectively, and are produced via dedicated
 * bridge entry points rather than card ingestion.
 */
export const DEFAULT_CARD_TYPE_MAP: Record<AwarenessCardType, MemoryTypeName> = {
  decision: "POLICY",
  insight: "TEXT",
  solution: "TEXT",
  workflow: "TEXT",
  memory: "EPISODIC",
  task: "EPISODIC",
};

export type CardTypeMap = Record<AwarenessCardType, MemoryTypeName>;
