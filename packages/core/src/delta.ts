import {
  asBytes32,
  bytes32Word,
  concatBytes,
  keccak256,
  keccak256Utf8,
  uintWord,
} from "./hash.js";
import { asUint64, type ExperienceDelta } from "./types.js";

export const EXPERIENCE_DELTA_TYPE =
  "ExperienceDelta(bytes32 spaceId,uint64 sequence,bytes32 prevStateRoot,bytes32 deltaCommitment,bytes32 provenanceCommitment,bytes32 profileId,bytes32 locatorCommitment)";
export const EXPERIENCE_DELTA_TYPEHASH = keccak256Utf8(EXPERIENCE_DELTA_TYPE);

export const MEMORY_STATE_TYPE =
  "MemoryState(bytes32 prevStateRoot,bytes32 transitionId)";
export const MEMORY_STATE_TYPEHASH = keccak256Utf8(MEMORY_STATE_TYPE);

export function normalizeExperienceDelta(delta: ExperienceDelta): ExperienceDelta {
  return {
    spaceId: asBytes32(delta.spaceId, "spaceId"),
    sequence: asUint64(delta.sequence, "sequence"),
    prevStateRoot: asBytes32(delta.prevStateRoot, "prevStateRoot"),
    deltaCommitment: asBytes32(delta.deltaCommitment, "deltaCommitment"),
    provenanceCommitment: asBytes32(
      delta.provenanceCommitment,
      "provenanceCommitment",
    ),
    profileId: asBytes32(delta.profileId, "profileId"),
    locatorCommitment: asBytes32(delta.locatorCommitment, "locatorCommitment"),
  };
}

/** Canonical v1 transition id: EIP-712 `hashStruct(ExperienceDelta)`. */
export function computeTransitionId(delta: ExperienceDelta): string {
  const d = normalizeExperienceDelta(delta);
  return keccak256(
    concatBytes(
      bytes32Word(EXPERIENCE_DELTA_TYPEHASH),
      bytes32Word(d.spaceId),
      uintWord(d.sequence),
      bytes32Word(d.prevStateRoot),
      bytes32Word(d.deltaCommitment),
      bytes32Word(d.provenanceCommitment),
      bytes32Word(d.profileId),
      bytes32Word(d.locatorCommitment),
    ),
  );
}

/** Deterministic state-machine transition performed by every conforming registry. */
export function computeNextStateRoot(
  prevStateRoot: string,
  transitionId: string,
): string {
  return keccak256(
    concatBytes(
      bytes32Word(MEMORY_STATE_TYPEHASH),
      bytes32Word(prevStateRoot, "prevStateRoot"),
      bytes32Word(transitionId, "transitionId"),
    ),
  );
}
