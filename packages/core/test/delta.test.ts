import { describe, expect, it } from "vitest";
import {
  ZERO32,
  computeNextStateRoot,
  computeTransitionId,
  fromExperienceDeltaJson,
  toExperienceDeltaJson,
  validateExperienceDelta,
  type ExperienceDelta,
} from "../src/index.js";

function sampleDelta(): ExperienceDelta {
  return {
    spaceId: "0x" + "11".repeat(32),
    sequence: 1n,
    prevStateRoot: ZERO32,
    deltaCommitment: "0x" + "22".repeat(32),
    provenanceCommitment: "0x" + "33".repeat(32),
    profileId: "0x" + "44".repeat(32),
    locatorCommitment: "0x" + "55".repeat(32),
  };
}

describe("ExperienceDelta v1", () => {
  it("has one deterministic EIP-712 struct hash", () => {
    const id = computeTransitionId(sampleDelta());
    expect(id).toMatch(/^0x[0-9a-f]{64}$/);
    expect(computeTransitionId(sampleDelta())).toBe(id);
  });

  it("commits every one of the seven fields", () => {
    const base = computeTransitionId(sampleDelta());
    expect(computeTransitionId({ ...sampleDelta(), sequence: 2n })).not.toBe(base);
    expect(
      computeTransitionId({ ...sampleDelta(), locatorCommitment: "0x" + "99".repeat(32) }),
    ).not.toBe(base);
  });

  it("derives the next state root from prior root and transition id", () => {
    const id = computeTransitionId(sampleDelta());
    const root = computeNextStateRoot(ZERO32, id);
    expect(root).toMatch(/^0x[0-9a-f]{64}$/);
    expect(computeNextStateRoot("0x" + "99".repeat(32), id)).not.toBe(root);
  });

  it("round-trips uint64 through a lossless JSON decimal string", () => {
    const delta = { ...sampleDelta(), sequence: (1n << 64n) - 1n };
    expect(fromExperienceDeltaJson(toExperienceDeltaJson(delta))).toEqual(delta);
  });

  it("validates exact fields and uint64 bounds", () => {
    expect(validateExperienceDelta(sampleDelta())).toEqual({ valid: true, errors: [] });
    expect(validateExperienceDelta({ ...sampleDelta(), uri: "ipfs://leak" }).valid).toBe(false);
    expect(() => computeTransitionId({ ...sampleDelta(), sequence: 1n << 64n })).toThrow();
  });
});
