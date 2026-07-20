import { describe, expect, it } from "vitest";
import { computeTransitionId } from "@erc-awar/core";
import { AwarenessAdapter, createBridgeTools } from "../src/index.js";

const SPACE = "0x" + "11".repeat(32);

function setup() {
  const bridge = new AwarenessAdapter(SPACE);
  const tools = createBridgeTools(bridge);
  return { bridge, tools, byName: Object.fromEntries(tools.map((tool) => [tool.name, tool])) };
}

describe("Awareness bridge tools", () => {
  it("exposes the expected tool set", () => {
    const { tools } = setup();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "awareness_ingest_card",
      "awareness_ingest_embedding",
      "memory_export_chain",
      "memory_verify_chain",
    ]);
  });

  it("returns a recomputable transitionId", () => {
    const { bridge, byName } = setup();
    const result = byName.awareness_ingest_card.handler({
      card: { id: "d1", type: "decision", content: "no PII" },
      options: {
        timestamp: 100,
        deltaSalt: "0x" + "aa".repeat(32),
        locatorSalt: "0x" + "bb".repeat(32),
      },
    }) as { transitionId: string; profile: string; sequence: string };
    expect(result.profile).toBe("POLICY");
    expect(result.sequence).toBe("1");
    expect(result.transitionId).toBe(
      computeTransitionId(bridge.export()[0].delta),
    );
  });

  it("exports JSON-safe sequence values and verifies state", () => {
    const { byName } = setup();
    byName.awareness_ingest_card.handler({
      card: { id: "a", type: "insight", content: "x" },
    });
    const exported = byName.memory_export_chain.handler({}) as {
      sequence: string;
      deltas: Array<{ sequence: string }>;
    };
    expect(exported.sequence).toBe("1");
    expect(exported.deltas[0].sequence).toBe("1");
    expect(byName.memory_verify_chain.handler({})).toEqual({ valid: true, errors: [] });
  });
});
