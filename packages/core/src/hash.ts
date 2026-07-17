import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

export const ZERO32 = "0x" + "00".repeat(32);

const HEX32_RE = /^0x[0-9a-f]{64}$/;
const HEX20_RE = /^0x[0-9a-f]{40}$/;
const HEX_RE = /^0x(?:[0-9a-f]{2})*$/;

/** keccak256 of raw bytes, returned as 0x-prefixed lowercase hex. */
export function keccak256(bytes: Uint8Array): string {
  return "0x" + bytesToHex(keccak_256(bytes));
}

/** keccak256 of a UTF-8 string. */
export function keccak256Utf8(s: string): string {
  return keccak256(utf8ToBytes(s));
}

export function isBytes32(value: unknown): value is string {
  return typeof value === "string" && HEX32_RE.test(value.toLowerCase());
}

export function isAddress(value: unknown): value is string {
  return typeof value === "string" && HEX20_RE.test(value.toLowerCase());
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

/** Decode an even-length 0x-prefixed hex string. */
export function hexToBytes(value: string, field = "hex"): Uint8Array {
  const lower = value.toLowerCase();
  if (!HEX_RE.test(lower)) throw new Error(`${field}: expected even-length 0x hex`);
  const out = new Uint8Array((lower.length - 2) / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(lower.slice(2 + i * 2, 4 + i * 2), 16);
  }
  return out;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** ABI word for uint64/uint256-compatible unsigned values. */
export function uintWord(value: bigint): Uint8Array {
  if (value < 0n || value >= 1n << 256n) throw new Error("uintWord: out of range");
  const out = new Uint8Array(32);
  let n = value;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

/** ABI word for an address (left-padded to 32 bytes). */
export function addressWord(value: string, field = "address"): Uint8Array {
  const address = hexToBytes(asAddress(value, field), field);
  const out = new Uint8Array(32);
  out.set(address, 12);
  return out;
}

/** Exactly one bytes32 ABI word. */
export function bytes32Word(value: string, field = "bytes32"): Uint8Array {
  return hexToBytes(asBytes32(value, field), field);
}
