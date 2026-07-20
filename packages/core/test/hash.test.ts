import { describe, expect, it } from "vitest";
import {
  ENCRYPTED_PAYLOAD_PROFILE_ID,
  ZERO32,
  asAddress,
  asBytes32,
  computeLocatorCommitment,
  computePrivateCommitment,
  keccak256Utf8,
} from "../src/index.js";

describe("hashing and private commitments", () => {
  it("matches the known keccak256 empty-string vector", () => {
    expect(keccak256Utf8("")).toBe(
      "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    );
  });

  it("uses salt and profile in memory commitments", () => {
    const payload = new TextEncoder().encode("yes");
    const a = computePrivateCommitment(
      payload,
      "0x" + "aa".repeat(32),
      ENCRYPTED_PAYLOAD_PROFILE_ID,
    );
    const b = computePrivateCommitment(
      payload,
      "0x" + "bb".repeat(32),
      ENCRYPTED_PAYLOAD_PROFILE_ID,
    );
    expect(a).not.toBe(b);
    expect(a).not.toBe(keccak256Utf8("yes"));
  });

  it("commits locators without putting the locator in the public delta", () => {
    const salt = "0x" + "cc".repeat(32);
    expect(computeLocatorCommitment("ipfs://bafy", salt)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(() => computeLocatorCommitment("", salt)).toThrow();
  });

  it("normalizes and validates fixed-width hex", () => {
    expect(ZERO32).toBe("0x" + "0".repeat(64));
    expect(asBytes32("0x" + "AB".repeat(32), "x")).toBe("0x" + "ab".repeat(32));
    expect(asAddress("0x" + "CD".repeat(20), "a")).toBe("0x" + "cd".repeat(20));
  });
});
