import { keccak256 } from "@erc-awar/core";
import { utf8ToBytes } from "@noble/hashes/utils";

/**
 * Application-level memory entry. `content` is float-tolerant (unlike the JCS
 * delta preimage) because it is committed as an opaque payload.
 */
export interface MemoryEntry {
  /** Stable logical id, unchanged across versions of the same memory. */
  id: string;
  content: unknown;
  /** Application profile; this is metadata and not a protocol-wide enum. */
  profileId: string;
}

/**
 * Deterministic JSON serialization for content commitments. Sorts object keys,
 * drops `undefined` object members (JSON semantics), and — unlike the spec's
 * JCS canonicalizer — permits floats, since payloads may contain vectors.
 */
export function stableStringify(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number") {
    if (!Number.isFinite(value as number)) {
      throw new Error("stableStringify: non-finite number");
    }
    return JSON.stringify(value);
  }
  if (t === "boolean" || t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((x) => stableStringify(x === undefined ? null : x)).join(",") + "]";
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
  }
  throw new Error(`stableStringify: unsupported type ${t}`);
}

/**
 * Unsalted local fingerprint used only for application diffing. It MUST NOT be
 * used as an on-chain memory commitment for low-entropy content.
 */
export function fingerprintContent(content: unknown): string {
  return keccak256(utf8ToBytes(stableStringify(content)));
}

export function encodeContent(content: unknown): Uint8Array {
  return content instanceof Uint8Array
    ? content
    : utf8ToBytes(stableStringify(content));
}
