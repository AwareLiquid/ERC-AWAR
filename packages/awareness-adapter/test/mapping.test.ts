import { describe, expect, it } from "vitest";
import { keccak256Utf8 } from "@erc-awar/core";
import {
  AWARENESS_CARD_TYPES,
  DEFAULT_CARD_TYPE_MAP,
  isAwarenessCardType,
  profileIdFor,
  profileUriFor,
} from "../src/index.js";

describe("Awareness adapter profiles", () => {
  it("recognizes the six application card kinds", () => {
    expect([...AWARENESS_CARD_TYPES]).toEqual([
      "decision", "insight", "solution", "workflow", "memory", "task",
    ]);
    expect(isAwarenessCardType("decision")).toBe(true);
    expect(isAwarenessCardType("nonsense")).toBe(false);
  });

  it("keeps product taxonomy outside the protocol core", () => {
    expect(DEFAULT_CARD_TYPE_MAP.decision).toBe("POLICY");
    expect(DEFAULT_CARD_TYPE_MAP.insight).toBe("TEXT");
    expect(profileUriFor("TEXT")).toBe(
      "https://awareness.market/profiles/memory/text/v1",
    );
    expect(profileIdFor("POLICY")).toBe(keccak256Utf8(profileUriFor("POLICY")));
  });
});
