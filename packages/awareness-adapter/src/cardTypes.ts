/**
 * Awareness application-layer card taxonomy.
 *
 * Grounded in the real Awareness memory MCP (github.com/everest-an/Awareness-Market):
 * four knowledge-card kinds (decision / insight / solution / workflow) plus the
 * working stores `memory` and `task`. These are product types, not protocol
 * fields. The adapter maps them to Awareness-owned profile identifiers.
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
 * Default card-to-profile mapping.
 *
 * Rationale (each choice follows the target schema's own description):
 * - decision -> POLICY:   a decision constrains future agent behavior, which is
 *   a policy or preference that constrains future behavior.
 * - insight / solution / workflow -> TEXT: human-readable knowledge cards; the
 *   TEXT profile lists these as `cardKind` examples.
 * - memory -> EPISODIC:   a recollection of something observed at a point in
 *   time.
 * - task -> EPISODIC:     a unit of work created/observed at a time; tracked as
 *   an event with `occurredAt`.
 *
 * EMBEDDING / LATENT / TOOL_TRACE / SHARED_WORKING / PROOF have no default card
 * source — they come from the retrieval index, LatentMAS collaboration, raw
 * execution traces, and proofs respectively, and are produced via dedicated
 * bridge entry points rather than card ingestion.
 */
export const AWARENESS_PROFILE_NAMES = [
  "TEXT",
  "EMBEDDING",
  "LATENT",
  "TOOL_TRACE",
  "EPISODIC",
  "POLICY",
  "SHARED_WORKING",
  "PROOF",
] as const;

export type AwarenessProfileName = (typeof AWARENESS_PROFILE_NAMES)[number];

export const DEFAULT_CARD_TYPE_MAP: Record<AwarenessCardType, AwarenessProfileName> = {
  decision: "POLICY",
  insight: "TEXT",
  solution: "TEXT",
  workflow: "TEXT",
  memory: "EPISODIC",
  task: "EPISODIC",
};

export type CardTypeMap = Record<AwarenessCardType, AwarenessProfileName>;
