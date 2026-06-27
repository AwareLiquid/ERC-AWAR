import { describe, expect, it } from "vitest";
import { ZERO32 } from "../src/hash.js";
import type { ExperienceDelta } from "../src/types.js";
import { validateContent, validateDelta } from "../src/validate.js";

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

describe("validateDelta", () => {
  it("accepts a well-formed delta", () => {
    expect(validateDelta(sampleDelta())).toEqual({ valid: true, errors: [] });
  });

  it("rejects an unknown memoryType", () => {
    const r = validateDelta({ ...sampleDelta(), memoryType: "BOGUS" });
    expect(r.valid).toBe(false);
  });

  it("rejects a bad hex field", () => {
    const r = validateDelta({ ...sampleDelta(), spaceId: "0x12" });
    expect(r.valid).toBe(false);
  });

  it("rejects extra properties", () => {
    const r = validateDelta({ ...sampleDelta(), surprise: true });
    expect(r.valid).toBe(false);
  });

  it("rejects a non-ipfs/ar/ethstorage uri", () => {
    const r = validateDelta({ ...sampleDelta(), uri: "ftp://x" });
    expect(r.valid).toBe(false);
  });
});

describe("validateContent", () => {
  it("validates embedding content with model + dim", () => {
    expect(
      validateContent("EMBEDDING", { model: "all-MiniLM-L6-v2", dim: 384 }).valid,
    ).toBe(true);
    expect(validateContent("EMBEDDING", { model: "x" }).valid).toBe(false);
  });

  it("validates latent content (LatentMAS)", () => {
    expect(
      validateContent("LATENT", {
        modelFamily: "qwen2",
        layer: 27,
        tensorShape: [1, 10, 3584],
        dtype: "bfloat16",
        kind: "latent_thought",
      }).valid,
    ).toBe(true);
  });

  it("validates shared-working content", () => {
    expect(
      validateContent("SHARED_WORKING", {
        participants: ["0x" + "44".repeat(20)],
        transport: "latent",
        topology: "sequential",
      }).valid,
    ).toBe(true);
  });

  it("rejects text content without text", () => {
    expect(validateContent("TEXT", { title: "x" }).valid).toBe(false);
  });
});
