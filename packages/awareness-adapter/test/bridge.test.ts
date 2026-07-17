import { describe, expect, it } from "vitest";
import { ZERO32, validateExperienceDelta } from "@erc-awar/core";
import {
  AwarenessAdapter,
  buildContent,
  profileIdFor,
  validateProfileContent,
  type AwarenessCard,
} from "../src/index.js";

const SPACE = "0x" + "11".repeat(32);
const SALTS = {
  deltaSalt: "0x" + "aa".repeat(32),
  locatorSalt: "0x" + "bb".repeat(32),
};

const card = (
  over: Partial<AwarenessCard> & Pick<AwarenessCard, "id" | "type" | "content">,
): AwarenessCard => ({ ...over });

describe("Awareness profile content", () => {
  it("builds profile-valid card payloads", () => {
    const text = buildContent(
      card({ id: "i1", type: "insight", content: "RRF", title: "Retrieval" }),
      "TEXT",
      100,
    );
    expect(text).toMatchObject({ text: "RRF", cardKind: "insight" });
    expect(validateProfileContent("TEXT", text).valid).toBe(true);

    const policy = buildContent(
      card({ id: "d1", type: "decision", content: "cite sources" }),
      "POLICY",
      100,
    );
    expect(validateProfileContent("POLICY", policy).valid).toBe(true);
  });

  it("uses product time inside private episodic content", () => {
    const content = buildContent(
      card({ id: "m1", type: "memory", content: "dark mode", createdAt: 1700 }),
      "EPISODIC",
      999,
    );
    expect(content.occurredAt).toBe(1700);
  });
});

describe("AwarenessAdapter", () => {
  it("maps a card to a valid v1 transition without exposing its locator", () => {
    const adapter = new AwarenessAdapter(SPACE);
    const record = adapter.ingest(
      card({ id: "d1", type: "decision", content: "no PII off-device" }),
      { timestamp: 100, ...SALTS },
    );

    expect(record.profile).toBe("POLICY");
    expect(record.delta.spaceId).toBe(SPACE);
    expect(record.delta.sequence).toBe(1n);
    expect(record.delta.prevStateRoot).toBe(ZERO32);
    expect(record.delta.profileId).toBe(profileIdFor("POLICY"));
    expect(record.witness.locator).toBe("awareness://card/d1");
    expect(record.delta).not.toHaveProperty("uri");
    expect(validateExperienceDelta(record.delta).valid).toBe(true);
  });

  it("links repeated card updates through the global state root", () => {
    const adapter = new AwarenessAdapter(SPACE);
    const first = adapter.ingest(card({ id: "x", type: "insight", content: "v1" }), {
      timestamp: 1,
      ...SALTS,
    });
    const second = adapter.ingest(card({ id: "x", type: "insight", content: "v2" }), {
      timestamp: 2,
      deltaSalt: "0x" + "cc".repeat(32),
      locatorSalt: "0x" + "dd".repeat(32),
    });
    expect(second.delta.prevStateRoot).toBe(first.nextStateRoot);
    expect(second.delta.sequence).toBe(2n);
  });

  it("supports adapter-specific profile mapping", () => {
    const adapter = new AwarenessAdapter(SPACE, {
      cardTypeMap: { workflow: "TOOL_TRACE" },
    });
    expect(adapter.profileOf("workflow")).toBe("TOOL_TRACE");
  });

  it("ingests an embedding under the Awareness embedding profile", () => {
    const adapter = new AwarenessAdapter(SPACE);
    const record = adapter.ingestEmbedding(
      { id: "e1", model: "all-MiniLM-L6-v2", dim: 3, vector: [0.1, 0.2, 0.3] },
      { timestamp: 100, ...SALTS },
    );
    expect(record.profile).toBe("EMBEDDING");
    expect(record.delta.profileId).toBe(profileIdFor("EMBEDDING"));
  });

  it("rejects an unknown card type and verifies a multi-card chain", () => {
    const adapter = new AwarenessAdapter(SPACE);
    expect(() =>
      adapter.ingest({ id: "z", type: "bogus" as never, content: "x" }),
    ).toThrow(/unknown/);
    adapter.ingestAll([
      card({ id: "a", type: "decision", content: "rule a" }),
      card({ id: "b", type: "insight", content: "note b" }),
    ]);
    expect(adapter.verify()).toEqual({ valid: true, errors: [] });
  });
});
