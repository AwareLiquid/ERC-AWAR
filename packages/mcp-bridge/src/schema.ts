import { type MemoryTypeName, keccak256Utf8 } from "@erc-awar/spec";

/**
 * Canonical JSON Schema `$id` for each MEMORY_* content schema shipped by
 * `@erc-awar/spec`. The on-delta `schemaHash` commits to one of these, so a
 * consumer always knows how to interpret a content commitment (SPEC §4.1, §5).
 */
export const SCHEMA_BASE = "https://erc-awar.dev/schemas/memory-categories";

const SCHEMA_FILE: Record<MemoryTypeName, string> = {
  TEXT: "text",
  EMBEDDING: "embedding",
  LATENT: "latent",
  TOOL_TRACE: "tool-trace",
  EPISODIC: "episodic",
  POLICY: "policy",
  SHARED_WORKING: "shared-working",
  PROOF: "proof",
};

/** Canonical schema `$id` URL for a memory type. */
export function schemaIdFor(memoryType: MemoryTypeName): string {
  return `${SCHEMA_BASE}/${SCHEMA_FILE[memoryType]}.schema.json`;
}

/**
 * Deterministic bytes32 schema hash for a memory type: keccak256 of the
 * canonical schema `$id`. Stable across processes and languages, so off-chain
 * producers and on-chain `ExperienceDelta.schemaHash` agree.
 */
export function schemaHashFor(memoryType: MemoryTypeName): string {
  return keccak256Utf8(schemaIdFor(memoryType));
}
