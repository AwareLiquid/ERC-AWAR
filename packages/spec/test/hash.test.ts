import { describe, expect, it } from "vitest";
import {
  ZERO32,
  asAddress,
  asBytes32,
  contentCommitment,
  keccak256Utf8,
} from "../src/hash.js";

describe("hash", () => {
  it("matches the known keccak256 empty-string vector", () => {
    expect(keccak256Utf8("")).toBe(
      "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    );
  });

  it("commits opaque payloads", () => {
    const c = contentCommitment(new TextEncoder().encode("hello"));
    expect(c).toMatch(/^0x[0-9a-f]{64}$/);
    expect(c).toBe(keccak256Utf8("hello"));
  });

  it("ZERO32 is 32 zero bytes", () => {
    expect(ZERO32).toBe("0x" + "0".repeat(64));
  });

  it("normalizes and validates hex", () => {
    const upper = "0x" + "AB".repeat(32);
    expect(asBytes32(upper, "x")).toBe("0x" + "ab".repeat(32));
    expect(() => asBytes32("0x12", "x")).toThrow();
    expect(asAddress("0x" + "CD".repeat(20), "a")).toBe("0x" + "cd".repeat(20));
    expect(() => asAddress("0x" + "cd".repeat(32), "a")).toThrow();
  });
});
