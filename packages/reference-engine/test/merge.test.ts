import { describe, expect, it } from "vitest";
import { type Change, lwwResolver, mergeChanges } from "../src/index.js";

const A1 = "0x" + "a1".repeat(20);
const A2 = "0x" + "a2".repeat(20);

const ch = (id: string, agent: string, timestamp: number, op: Change["op"] = "update"): Change => ({
  id,
  op,
  content: { v: `${id}-${timestamp}` },
  timestamp,
  agent,
});

describe("mergeChanges", () => {
  it("passes through non-overlapping ids", () => {
    const r = mergeChanges([ch("a", A1, 1)], [ch("b", A2, 1)]);
    expect(r.conflicts).toHaveLength(0);
    expect(r.merged.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("resolves overlapping ids by last-writer-wins", () => {
    const r = mergeChanges([ch("a", A1, 1)], [ch("a", A2, 5)]);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].winner).toBe("b");
    expect(r.merged[0].agent).toBe(A2);
  });

  it("breaks timestamp ties deterministically by agent", () => {
    const r = mergeChanges([ch("a", A2, 3)], [ch("a", A1, 3)]);
    // A1 < A2 lexicographically -> side b wins
    expect(r.conflicts[0].winner).toBe("b");
    expect(r.merged[0].agent).toBe(A1);
  });

  it("collapses duplicates within one side to the latest", () => {
    const r = mergeChanges([ch("a", A1, 1), ch("a", A1, 9)], []);
    expect(r.merged).toHaveLength(1);
    expect(r.merged[0].timestamp).toBe(9);
  });

  it("supports a custom resolver", () => {
    const alwaysA = () => "a" as const;
    const r = mergeChanges([ch("a", A1, 1)], [ch("a", A2, 100)], alwaysA);
    expect(r.merged[0].agent).toBe(A1);
  });

  it("lwwResolver picks higher timestamp", () => {
    expect(lwwResolver(ch("a", A1, 2), ch("a", A2, 1))).toBe("a");
  });
});
