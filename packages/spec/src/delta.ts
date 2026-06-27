import { canonicalize, type CanonicalValue } from "./canonicalize.js";
import { asAddress, asBytes32, keccak256Utf8 } from "./hash.js";
import { memoryTypeCode } from "./memoryType.js";
import { DELTA_SCHEMA_ID, type ExperienceDelta } from "./types.js";

/**
 * Build the canonical deltaId preimage (SPEC §4.1, §6).
 * - `signature` is excluded.
 * - `memoryType` is encoded as its integer code so the preimage matches the
 *   on-chain Solidity enum.
 * - hex fields are lowercased and length-checked.
 */
export function deltaPreimage(delta: ExperienceDelta): CanonicalValue {
  if (delta.schema !== DELTA_SCHEMA_ID) {
    throw new Error(`delta.schema must be "${DELTA_SCHEMA_ID}"`);
  }
  if (!Number.isInteger(delta.timestamp) || delta.timestamp < 0) {
    throw new Error("delta.timestamp must be a non-negative integer");
  }
  if (!Number.isInteger(delta.version) || delta.version < 0) {
    throw new Error("delta.version must be a non-negative integer");
  }

  return {
    schema: delta.schema,
    spaceId: asBytes32(delta.spaceId, "spaceId"),
    priorMemoryCommitment: asBytes32(
      delta.priorMemoryCommitment,
      "priorMemoryCommitment",
    ),
    newContentCommitment: asBytes32(
      delta.newContentCommitment,
      "newContentCommitment",
    ),
    memoryType: memoryTypeCode(delta.memoryType),
    schemaHash: asBytes32(delta.schemaHash, "schemaHash"),
    inferenceAnchor: asBytes32(delta.inferenceAnchor, "inferenceAnchor"),
    inputHash: asBytes32(delta.inputHash, "inputHash"),
    previousDelta: asBytes32(delta.previousDelta, "previousDelta"),
    timestamp: delta.timestamp,
    version: delta.version,
    agent: asAddress(delta.agent, "agent"),
    uri: delta.uri,
  };
}

/** deltaId = keccak256(JCS(preimage)). Deterministic and signature-free. */
export function computeDeltaId(delta: ExperienceDelta): string {
  return keccak256Utf8(canonicalize(deltaPreimage(delta)));
}
