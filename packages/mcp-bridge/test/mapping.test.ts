import { describe, expect, it } from "vitest";
import { keccak256Utf8 } from "@erc-awar/spec";
import {
  AWARENESS_CARD_TYPES,
  DEFAULT_CARD_TYPE_MAP,
  isAwarenessCardType,
  schemaHashFor,
  schemaIdFor,
} from "../src/index.js";

describe("card taxonomy", () => {
  it("recognizes the six real Awareness card kinds", () => {
    expect([...AWARENESS_CARD_TYPES]).toEqual([
      "decision",
      "insight",
      "solution",
      "workflow",
      "memory",
      "task",
    ]);
  });

  it("guards card types", () => {
    expect(isAwarenessCardType("decision")).toBe(true);
    expect(isAwarenessCardType("nonsense")).toBe(false);
    expect(isAwarenessCardType(42)).toBe(false);
  });

  it("maps every card type to a canonical MEMORY_* category", () => {
    expect(DEFAULT_CARD_TYPE_MAP).toEqual({
      decision: "POLICY",
      insight: "TEXT",
      solution: "TEXT",
      workflow: "TEXT",
      memory: "EPISODIC",
      task: "EPISODIC",
    });
  });
});

describe("schema hashing", () => {
  it("derives schema id from the memory type", () => {
    expect(schemaIdFor("TEXT")).toBe(
      "https://erc-awar.dev/schemas/memory-categories/text.schema.json",
    );
    expect(schemaIdFor("TOOL_TRACE")).toBe(
      "https://erc-awar.dev/schemas/memory-categories/tool-trace.schema.json",
    );
  });

  it("schemaHash is keccak256 of the canonical schema id", () => {
    expect(schemaHashFor("POLICY")).toBe(keccak256Utf8(schemaIdFor("POLICY")));
    expect(schemaHashFor("POLICY")).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("distinct memory types get distinct schema hashes", () => {
    expect(schemaHashFor("TEXT")).not.toBe(schemaHashFor("EPISODIC"));
  });
});
