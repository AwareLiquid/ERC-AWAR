import { describe, expect, it } from "vitest";
import { ZERO32, validateContent, validateDelta } from "@erc-awar/spec";
import { MemoryBridge, buildContent, schemaHashFor, type AwarenessCard } from "../src/index.js";

const SPACE = "0x" + "11".repeat(32);
const AGENT = "0x" + "44".repeat(20);

const card = (over: Partial<AwarenessCard> & Pick<AwarenessCard, "id" | "type" | "content">): AwarenessCard =>
  ({ ...over });

describe("buildContent", () => {
  it("builds schema-valid TEXT for an insight", () => {
    const c = card({ id: "i1", type: "insight", content: "vector DBs need RRF", title: "Retrieval", tags: ["rag"] });
    const content = buildContent(c, "TEXT", 100);
    expect(content).toMatchObject({ text: "vector DBs need RRF", title: "Retrieval", cardKind: "insight", tags: ["rag"] });
    expect(validateContent("TEXT", content).valid).toBe(true);
  });

  it("builds schema-valid POLICY for a decision", () => {
    const c = card({ id: "d1", type: "decision", content: "always cite sources" });
    const content = buildContent(c, "POLICY", 100);
    expect(content).toMatchObject({ rule: "always cite sources", scope: "agent", cardKind: "decision" });
    expect(validateContent("POLICY", content).valid).toBe(true);
  });

  it("builds schema-valid EPISODIC using createdAt as occurredAt", () => {
    const c = card({ id: "m1", type: "memory", content: "user prefers dark mode", createdAt: 1700 });
    const content = buildContent(c, "EPISODIC", 999);
    expect(content).toMatchObject({ event: "user prefers dark mode", occurredAt: 1700, cardKind: "memory" });
    expect(validateContent("EPISODIC", content).valid).toBe(true);
  });

  it("falls back to occurredAt = timestamp when no card time", () => {
    const c = card({ id: "t1", type: "task", content: "ship M4" });
    expect(buildContent(c, "EPISODIC", 555).occurredAt).toBe(555);
  });

  it("stringifies structured content for text fields", () => {
    const c = card({ id: "s1", type: "solution", content: { steps: ["a", "b"] } });
    expect(buildContent(c, "TEXT", 1).text).toBe('{"steps":["a","b"]}');
  });
});

describe("MemoryBridge", () => {
  it("ingests a card into a valid Experience Delta", () => {
    const b = new MemoryBridge(SPACE, AGENT);
    const d = b.ingest(card({ id: "d1", type: "decision", content: "no PII off-device" }), { timestamp: 100 });

    expect(d.memoryType).toBe("POLICY");
    expect(d.spaceId).toBe(SPACE);
    expect(d.agent).toBe(AGENT);
    expect(d.version).toBe(1);
    expect(d.priorMemoryCommitment).toBe(ZERO32);
    expect(d.previousDelta).toBe(ZERO32);
    expect(d.schemaHash).toBe(schemaHashFor("POLICY"));
    expect(d.uri).toBe("awareness://card/d1");
    expect(validateDelta(d).valid).toBe(true);
  });

  it("tracks a memory's evolution across re-ingestion of the same id", () => {
    const b = new MemoryBridge(SPACE, AGENT);
    const d1 = b.ingest(card({ id: "x", type: "insight", content: "v1" }), { timestamp: 1 });
    const d2 = b.ingest(card({ id: "x", type: "insight", content: "v2" }), { timestamp: 2 });

    expect(d2.previousDelta).not.toBe(ZERO32);
    expect(d2.priorMemoryCommitment).toBe(d1.newContentCommitment);
    expect(d2.version).toBe(2);
  });

  it("supports a custom card-type mapping", () => {
    const b = new MemoryBridge(SPACE, AGENT, { cardTypeMap: { workflow: "TOOL_TRACE" } });
    expect(b.memoryTypeOf("workflow")).toBe("TOOL_TRACE");
  });

  it("ingests an embedding as MEMORY_EMBEDDING", () => {
    const b = new MemoryBridge(SPACE, AGENT);
    const d = b.ingestEmbedding(
      { id: "e1", model: "all-MiniLM-L6-v2", dim: 3, vector: [0.1, 0.2, 0.3], metric: "cosine" },
      { timestamp: 100 },
    );
    expect(d.memoryType).toBe("EMBEDDING");
    expect(d.schemaHash).toBe(schemaHashFor("EMBEDDING"));
    expect(validateDelta(d).valid).toBe(true);
  });

  it("rejects an unknown card type", () => {
    const b = new MemoryBridge(SPACE, AGENT);
    expect(() => b.ingest({ id: "z", type: "bogus" as never, content: "x" })).toThrow(/unknown/);
  });

  it("ingestAll commits and verifies a multi-card chain", () => {
    const b = new MemoryBridge(SPACE, AGENT);
    b.ingestAll(
      [
        card({ id: "a", type: "decision", content: "rule a" }),
        card({ id: "b", type: "insight", content: "note b" }),
        card({ id: "c", type: "memory", content: "event c", createdAt: 10 }),
      ],
      { timestamp: 5 },
    );
    expect(b.export()).toHaveLength(3);
    expect(b.verify()).toEqual({ valid: true, errors: [] });
  });
});
