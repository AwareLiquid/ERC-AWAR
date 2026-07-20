import { describe, expect, it } from "vitest";
import {
  ZERO32,
  computeNextStateRoot,
  computeTransitionId,
  keccak256Utf8,
} from "@erc-awar/core";
import { MemoryStateMachine } from "../src/index.js";

const SPACE = "0x" + "11".repeat(32);
const PROFILE = keccak256Utf8("example/profile/v1");
const SALT_A = "0x" + "aa".repeat(32);
const SALT_B = "0x" + "bb".repeat(32);
const SALT_C = "0x" + "cc".repeat(32);
const SALT_D = "0x" + "dd".repeat(32);

function input(text: string, suffix: "a" | "b") {
  return {
    payload: { op: "upsert", text },
    profileId: PROFILE,
    locator: `ipfs://${suffix}`,
    deltaSalt: suffix === "a" ? SALT_A : SALT_C,
    locatorSalt: suffix === "a" ? SALT_B : SALT_D,
  };
}

describe("MemoryStateMachine", () => {
  it("builds genesis from ZERO32 and computes the next root", () => {
    const machine = new MemoryStateMachine(SPACE);
    const record = machine.commit(input("v1", "a"));
    expect(record.delta.sequence).toBe(1n);
    expect(record.delta.prevStateRoot).toBe(ZERO32);
    expect(record.transitionId).toBe(computeTransitionId(record.delta));
    expect(record.nextStateRoot).toBe(
      computeNextStateRoot(ZERO32, record.transitionId),
    );
    expect(machine.stateRoot).toBe(record.nextStateRoot);
  });

  it("links transitions by state root rather than a loose previous id", () => {
    const machine = new MemoryStateMachine(SPACE);
    const first = machine.commit(input("v1", "a"));
    const second = machine.commit(input("v2", "b"));
    expect(second.delta.sequence).toBe(2n);
    expect(second.delta.prevStateRoot).toBe(first.nextStateRoot);
    expect(machine.verify()).toEqual({ valid: true, errors: [] });
  });

  it("rejects externally prepared transitions with the wrong prior state", () => {
    const machine = new MemoryStateMachine(SPACE);
    const first = machine.commit(input("v1", "a"));
    expect(() =>
      machine.append({
        ...first.delta,
        sequence: 2n,
        prevStateRoot: ZERO32,
      }),
    ).toThrow(/prevStateRoot/);
  });

  it("validates constructor input", () => {
    expect(() => new MemoryStateMachine("0x12")).toThrow();
    expect(() => new MemoryStateMachine(ZERO32)).toThrow(/spaceId/);
  });

  it("supports an absent private locator", () => {
    const machine = new MemoryStateMachine(SPACE);
    const record = machine.commit({
      payload: { op: "redact" },
      profileId: PROFILE,
      deltaSalt: SALT_A,
    });
    expect(record.delta.locatorCommitment).toBe(ZERO32);
    expect(record.witness).toEqual({ deltaSalt: SALT_A });
  });

  it("rejects zero required commitments from external implementations", () => {
    const machine = new MemoryStateMachine(SPACE);
    const valid = machine.commit(input("v1", "a")).delta;
    const fresh = new MemoryStateMachine(SPACE);
    expect(() => fresh.append({ ...valid, deltaCommitment: ZERO32 })).toThrow(
      /deltaCommitment/,
    );
    expect(() => fresh.append({ ...valid, profileId: ZERO32 })).toThrow(/profileId/);
  });
});
