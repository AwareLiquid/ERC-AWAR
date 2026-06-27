import { describe, expect, it } from "vitest";
import { canonicalize } from "../src/canonicalize.js";

describe("canonicalize (JCS subset)", () => {
  it("sorts object keys deterministically", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalize({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
  });

  it("is independent of insertion order (nested)", () => {
    const a = canonicalize({ x: { c: 3, a: 1, b: 2 }, y: [1, 2, 3] });
    const b = canonicalize({ y: [1, 2, 3], x: { b: 2, a: 1, c: 3 } });
    expect(a).toBe(b);
  });

  it("preserves array order", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });

  it("handles primitives", () => {
    expect(canonicalize(null)).toBe("null");
    expect(canonicalize(true)).toBe("true");
    expect(canonicalize("a\"b")).toBe('"a\\"b"');
    expect(canonicalize(0)).toBe("0");
  });

  it("rejects non-integer numbers", () => {
    expect(() => canonicalize(1.5)).toThrow();
    expect(() => canonicalize(NaN)).toThrow();
  });
});
