import type { MemoryTypeName } from "./memoryType.js";

export const DELTA_SCHEMA_ID = "erc83xx/delta/v0";

/**
 * Off-chain Experience Delta record (SPEC §4.1).
 * `signature` is excluded from the deltaId preimage.
 */
export interface ExperienceDelta {
  schema: typeof DELTA_SCHEMA_ID;
  /** Memory subject / namespace — the ERC-8264 subject. */
  spaceId: string;
  /** Previous content commitment; ZERO32 for a genesis delta. */
  priorMemoryCommitment: string;
  /** New content commitment (off-chain payload hash). */
  newContentCommitment: string;
  /** Canonical memory category. */
  memoryType: MemoryTypeName;
  /** Hash of the schema describing how to interpret the commitment. */
  schemaHash: string;
  /** Related ERC-8263 inference attestation; ZERO32 if none. */
  inferenceAnchor: string;
  /** Related ERC-8299 (WYRIWE) input commitment; ZERO32 if none. */
  inputHash: string;
  /** Prior delta, forming the evolution chain; ZERO32 for the first. */
  previousDelta: string;
  /** Unix seconds. */
  timestamp: number;
  /** Monotonic version within the space. */
  version: number;
  /** Author identity (ERC-8004), 20-byte address. */
  agent: string;
  /** Off-chain locator: ipfs:// | ethstorage:// | ar:// */
  uri: string;
  /** Author signature over deltaId; not part of the preimage. */
  signature?: string;
}
