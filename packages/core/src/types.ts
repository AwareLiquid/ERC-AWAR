export const EXPERIENCE_DELTA_VERSION = 1 as const;
export const EXPERIENCE_DELTA_SCHEMA_ID =
  "agent-memory-state/experience-delta/v1" as const;
export const MAX_UINT64 = (1n << 64n) - 1n;

/**
 * The complete and normative v1 transition claim.
 *
 * This shape intentionally contains no author, timestamp, URI, memory taxonomy,
 * or product metadata. Authorization is supplied by the Space configuration and
 * EIP-712 signature. The registry records observation time from `block.timestamp`.
 */
export interface ExperienceDelta {
  /** Namespace whose state is advanced by this transition. */
  spaceId: string;
  /** Strictly monotonic sequence, starting at 1. */
  sequence: bigint;
  /** Current registry state root, or ZERO32 for genesis. */
  prevStateRoot: string;
  /** Privacy-preserving commitment to the memory operation or encrypted delta. */
  deltaCommitment: string;
  /** Optional commitment to input/inference provenance; ZERO32 when absent. */
  provenanceCommitment: string;
  /** Identifier of the off-chain semantic and commitment profile. */
  profileId: string;
  /** Commitment to an off-chain locator; the locator itself is never core calldata. */
  locatorCommitment: string;
}

/** Lossless JSON representation. uint64 is encoded as a decimal string. */
export interface ExperienceDeltaJson extends Omit<ExperienceDelta, "sequence"> {
  sequence: string;
}

export function asUint64(value: bigint | number | string, field = "value"): bigint {
  let parsed: bigint;
  try {
    parsed = typeof value === "bigint" ? value : BigInt(value);
  } catch {
    throw new Error(`${field}: expected uint64`);
  }
  if (parsed < 0n || parsed > MAX_UINT64) {
    throw new Error(`${field}: expected uint64`);
  }
  return parsed;
}

export function toExperienceDeltaJson(delta: ExperienceDelta): ExperienceDeltaJson {
  return { ...delta, sequence: asUint64(delta.sequence, "sequence").toString(10) };
}

export function fromExperienceDeltaJson(delta: ExperienceDeltaJson): ExperienceDelta {
  return { ...delta, sequence: asUint64(delta.sequence, "sequence") };
}
