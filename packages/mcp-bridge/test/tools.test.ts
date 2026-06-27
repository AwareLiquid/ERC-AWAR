import { describe, expect, it } from "vitest";
import { computeDeltaId } from "@erc-awar/spec";
import { MemoryBridge, createBridgeTools } from "../src/index.js";

const SPACE = "0x" + "11".repeat(32);
const AGENT = "0x" + "44".repeat(20);

function setup() {
  const bridge = new MemoryBridge(SPACE, AGENT);
  const tools = createBridgeTools(bridge);
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  return { bridge, tools, byName };
}

describe("bridge tools", () => {
  it("exposes the expected tool set with input schemas", () => {
    const { tools } = setup();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "awareness_ingest_card",
      "awareness_ingest_embedding",
      "memory_export_chain",
      "memory_verify_chain",
    ]);
    for (const t of tools) {
      expect(t.inputSchema).toHaveProperty("type", "object");
      expect(typeof t.description).toBe("string");
    }
  });

  it("ingest_card returns a delta summary with a recomputable deltaId", () => {
    const { bridge, byName } = setup();
    const res = byName.awareness_ingest_card.handler({
      card: { id: "d1", type: "decision", content: "no PII" },
      options: { timestamp: 100 },
    }) as { deltaId: string; memoryType: string; version: number };

    expect(res.memoryType).toBe("POLICY");
    expect(res.version).toBe(1);
    expect(res.deltaId).toBe(computeDeltaId(bridge.export()[0]));
  });

  it("export and verify reflect ingested state", () => {
    const { byName } = setup();
    byName.awareness_ingest_card.handler({
      card: { id: "a", type: "insight", content: "x" },
      options: { timestamp: 1 },
    });
    const exported = byName.memory_export_chain.handler({}) as {
      version: number;
      deltas: unknown[];
    };
    expect(exported.version).toBe(1);
    expect(exported.deltas).toHaveLength(1);
    expect(byName.memory_verify_chain.handler({})).toEqual({ valid: true, errors: [] });
  });

  it("ingest_embedding commits a MEMORY_EMBEDDING delta", () => {
    const { byName } = setup();
    const res = byName.awareness_ingest_embedding.handler({
      embedding: { id: "e1", model: "all-MiniLM-L6-v2", dim: 2, vector: [0.5, 0.5] },
      options: { timestamp: 1 },
    }) as { memoryType: string };
    expect(res.memoryType).toBe("EMBEDDING");
  });
});
