import { describe, expect, it } from "vitest";
import { ZERO32 } from "@erc-awar/core";
import { diffStates, fingerprintContent, stableStringify, type MemoryEntry } from "../src/index.js";

const SCHEMA = "0x" + "33".repeat(32);
const entry = (id: string, content: unknown): MemoryEntry => ({
  id,
  content,
  profileId: SCHEMA,
});

describe("stableStringify / fingerprintContent", () => {
  it("is key-order independent", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
    expect(fingerprintContent({ b: 1, a: 2 })).toBe(fingerprintContent({ a: 2, b: 1 }));
  });
  it("tolerates floats (for embedding payloads)", () => {
    expect(fingerprintContent({ v: [0.1, 0.2] })).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("diffStates", () => {
  it("detects add / update / deprecate and skips unchanged", () => {
    const prev = [entry("a", { text: "x" }), entry("b", { text: "keep" }), entry("c", { text: "gone" })];
    const next = [entry("a", { text: "y" }), entry("b", { text: "keep" }), entry("d", { text: "new" })];
    const ops = diffStates(prev, next);
    const byId = Object.fromEntries(ops.map((o) => [o.id, o.op]));
    expect(byId).toEqual({ a: "update", c: "deprecate", d: "add" });
    expect(ops.find((o) => o.id === "b")).toBeUndefined();
  });

  it("add ops have ZERO32 prior commitment", () => {
    const ops = diffStates([], [entry("a", { text: "x" })]);
    expect(ops[0]).toMatchObject({ op: "add", priorCommitment: ZERO32 });
  });

  it("update prior commitment equals the previous content commitment", () => {
    const prev = [entry("a", { text: "x" })];
    const next = [entry("a", { text: "y" })];
    const op = diffStates(prev, next)[0];
    expect(op.op).toBe("update");
    if (op.op === "update") expect(op.priorCommitment).toBe(fingerprintContent({ text: "x" }));
  });

  it("throws on duplicate ids", () => {
    expect(() => diffStates([entry("a", {}), entry("a", {})], [])).toThrow();
  });
});
