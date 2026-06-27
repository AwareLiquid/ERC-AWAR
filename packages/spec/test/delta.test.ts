import { describe, expect, it } from "vitest";
import { computeDeltaId, deltaPreimage } from "../src/delta.js";
import { ZERO32 } from "../src/hash.js";
import type { ExperienceDelta } from "../src/types.js";

function sampleDelta(): ExperienceDelta {
  return {
    schema: "erc83xx/delta/v0",
    spaceId: "0x" + "11".repeat(32),
    priorMemoryCommitment: ZERO32,
    newContentCommitment: "0x" + "22".repeat(32),
    memoryType: "TEXT",
    schemaHash: "0x" + "33".repeat(32),
    inferenceAnchor: ZERO32,
    inputHash: ZERO32,
    previousDelta: ZERO32,
    timestamp: 1719446400,
    version: 1,
    agent: "0x" + "44".repeat(20),
    uri: "ipfs://bafyExample",
  };
}

describe("Experience Delta id", () => {
  it("is a 32-byte hex digest", () => {
    expect(computeDeltaId(sampleDelta())).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("is deterministic and signature-free", () => {
    const a = computeDeltaId(sampleDelta());
    const withSig = { ...sampleDelta(), signature: "0xdeadbeef" };
    expect(computeDeltaId(withSig)).toBe(a);
  });

  it("encodes memoryType as its integer code in the preimage", () => {
    const pre = deltaPreimage(sampleDelta()) as Record<string, unknown>;
    expect(pre.memoryType).toBe(0);
    const latent = deltaPreimage({ ...sampleDelta(), memoryType: "LATENT" }) as Record<string, unknown>;
    expect(latent.memoryType).toBe(2);
  });

  it("changes when any committed field changes", () => {
    const base = computeDeltaId(sampleDelta());
    expect(computeDeltaId({ ...sampleDelta(), version: 2 })).not.toBe(base);
    expect(
      computeDeltaId({ ...sampleDelta(), newContentCommitment: "0x" + "99".repeat(32) }),
    ).not.toBe(base);
    expect(computeDeltaId({ ...sampleDelta(), memoryType: "EMBEDDING" })).not.toBe(base);
  });

  it("lowercases hex before hashing", () => {
    const upper: ExperienceDelta = { ...sampleDelta(), spaceId: "0x" + "AA".repeat(32) };
    const lower: ExperienceDelta = { ...sampleDelta(), spaceId: "0x" + "aa".repeat(32) };
    expect(computeDeltaId(upper)).toBe(computeDeltaId(lower));
  });

  it("rejects malformed hex fields", () => {
    expect(() => computeDeltaId({ ...sampleDelta(), spaceId: "0x12" })).toThrow();
  });
});
