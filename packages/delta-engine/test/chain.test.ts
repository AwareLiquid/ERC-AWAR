import { describe, expect, it } from "vitest";
import { ZERO32, computeDeltaId } from "@erc-awar/spec";
import { DeltaChain } from "../src/index.js";

const SPACE = "0x" + "11".repeat(32);
const AGENT = "0x" + "44".repeat(20);
const SCHEMA = "0x" + "33".repeat(32);

function newChain() {
  return new DeltaChain(SPACE, AGENT);
}

describe("DeltaChain", () => {
  it("links genesis with ZERO32 prior + previousDelta", () => {
    const c = newChain();
    const d = c.commit({ id: "m1", memoryType: "TEXT", content: { text: "v1" }, schemaHash: SCHEMA, uri: "ipfs://a", timestamp: 1 });
    expect(d.priorMemoryCommitment).toBe(ZERO32);
    expect(d.previousDelta).toBe(ZERO32);
    expect(d.version).toBe(1);
    expect(c.head).toBe(computeDeltaId(d));
  });

  it("chains previousDelta and tracks prior commitment per id", () => {
    const c = newChain();
    const d1 = c.commit({ id: "m1", memoryType: "TEXT", content: { text: "v1" }, schemaHash: SCHEMA, uri: "ipfs://a", timestamp: 1 });
    const d2 = c.commit({ id: "m1", memoryType: "TEXT", content: { text: "v2" }, schemaHash: SCHEMA, uri: "ipfs://b", timestamp: 2 });
    expect(d2.previousDelta).toBe(computeDeltaId(d1));
    expect(d2.priorMemoryCommitment).toBe(d1.newContentCommitment);
    expect(d2.version).toBe(2);
  });

  it("uses ZERO32 prior for a different id even mid-chain", () => {
    const c = newChain();
    c.commit({ id: "m1", memoryType: "TEXT", content: { text: "v1" }, schemaHash: SCHEMA, uri: "ipfs://a", timestamp: 1 });
    const d2 = c.commit({ id: "m2", memoryType: "POLICY", content: { rule: "r" }, schemaHash: SCHEMA, uri: "ipfs://b", timestamp: 2 });
    expect(d2.priorMemoryCommitment).toBe(ZERO32);
  });

  it("verifies a well-formed chain", () => {
    const c = newChain();
    c.commit({ id: "m1", memoryType: "TEXT", content: { text: "v1" }, schemaHash: SCHEMA, uri: "ipfs://a", timestamp: 1 });
    c.commit({ id: "m1", memoryType: "TEXT", content: { text: "v2" }, schemaHash: SCHEMA, uri: "ipfs://b", timestamp: 2 });
    expect(c.verify()).toEqual({ valid: true, errors: [] });
  });

  it("validates constructor inputs", () => {
    expect(() => new DeltaChain("0x12", AGENT)).toThrow();
    expect(() => new DeltaChain(SPACE, "0xnope")).toThrow();
  });
});
