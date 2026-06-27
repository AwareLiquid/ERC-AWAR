import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

export const ZERO32 = "0x" + "00".repeat(32);

const HEX32_RE = /^0x[0-9a-f]{64}$/;
const HEX20_RE = /^0x[0-9a-f]{40}$/;

/** keccak256 of raw bytes, returned as 0x-prefixed lowercase hex. */
export function keccak256(bytes: Uint8Array): string {
  return "0x" + bytesToHex(keccak_256(bytes));
}

/** keccak256 of a UTF-8 string. */
export function keccak256Utf8(s: string): string {
  return keccak256(utf8ToBytes(s));
}

/**
 * Content commitment for an off-chain memory payload.
 * The payload is treated as opaque bytes — this is what `newContentCommitment`
 * (and later `priorMemoryCommitment`) refer to. Encrypt before committing for
 * private memory.
 */
export function contentCommitment(payload: Uint8Array): string {
  return keccak256(payload);
}

export function isBytes32(value: unknown): value is string {
  return typeof value === "string" && HEX32_RE.test(value);
}

export function isAddress(value: unknown): value is string {
  return typeof value === "string" && HEX20_RE.test(value);
}

/** Normalize a 0x hex string to lowercase and assert it is 32 bytes. */
export function asBytes32(value: string, field: string): string {
  const lower = value.toLowerCase();
  if (!HEX32_RE.test(lower)) {
    throw new Error(`${field}: expected 32-byte 0x hex, got ${value}`);
  }
  return lower;
}

/** Normalize a 0x address to lowercase and assert it is 20 bytes. */
export function asAddress(value: string, field: string): string {
  const lower = value.toLowerCase();
  if (!HEX20_RE.test(lower)) {
    throw new Error(`${field}: expected 20-byte 0x address, got ${value}`);
  }
  return lower;
}
