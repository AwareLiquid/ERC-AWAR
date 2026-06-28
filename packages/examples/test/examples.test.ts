import { describe, expect, it } from "vitest";
import { ZERO32 } from "@erc-awar/spec";
import { runAwarenessLifecycle, runBenchmark, runMultiAgentMerge } from "../src/index.js";

describe("Awareness lifecycle demo", () => {
  const r = runAwarenessLifecycle();

  it("commits 6 cards + 1 refinement + 1 embedding into a valid chain", () => {
    expect(r.capsule).toHaveLength(8);
    expect(r.version).toBe(8);
    expect(r.head).not.toBe(ZERO32);
    expect(r.verification).toEqual({ valid: true, errors: [] });
  });

  it("maps cards to the expected MEMORY_* categories", () => {
    expect(r.byType).toEqual({ POLICY: 1, TEXT: 4, EPISODIC: 2, EMBEDDING: 1 });
  });

  it("links the refinement to the prior commitment of the same id", () => {
    const rrf = r.capsule.filter((d) => d.uri === "awareness://card/insight:rrf");
    expect(rrf).toHaveLength(2);
    expect(rrf[1].priorMemoryCommitment).toBe(rrf[0].newContentCommitment);
  });
});

describe("Multi-agent merge demo", () => {
  const r = runMultiAgentMerge();

  it("detects exactly the overlapping-id conflict", () => {
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].id).toBe("summary");
  });

  it("resolves the conflict by last-writer-wins (later timestamp)", () => {
    expect(r.conflicts[0].winner).toBe("b");
    expect(r.winners.summary).toBe("0x" + "b2".repeat(20));
  });

  it("commits the merged state deterministically", () => {
    expect(r.mergedIds).toEqual(["note", "summary", "todo"]);
    expect(r.version).toBe(3);
    expect(r.head).not.toBe(ZERO32);
  });
});

describe("Benchmark demo", () => {
  it("reports throughput and a >1x off-chain:on-chain footprint ratio", () => {
    const r = runBenchmark(200);
    expect(r.count).toBe(200);
    expect(r.deltasPerSec).toBeGreaterThan(0);
    expect(r.onchainBytesPerDelta).toBe(32);
    expect(r.compressionRatio).toBeGreaterThan(1);
    expect(r.avgPayloadBytes).toBeGreaterThan(32);
  });
});
