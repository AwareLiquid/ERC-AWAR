import { randomBytes, utf8ToBytes } from "@noble/hashes/utils";
import {
  asBytes32,
  bytes32Word,
  concatBytes,
  keccak256,
  keccak256Utf8,
} from "./hash.js";

export const SALTED_KECCAK_PROFILE_ID = keccak256Utf8(
  "agent-memory-state/commitment/salted-keccak256/v1",
);
export const ENCRYPTED_PAYLOAD_PROFILE_ID = keccak256Utf8(
  "agent-memory-state/commitment/encrypted-payload/v1",
);

export const DELTA_COMMITMENT_DOMAIN = keccak256Utf8(
  "AgentMemoryState.deltaCommitment.v1",
);
export const PROVENANCE_COMMITMENT_DOMAIN = keccak256Utf8(
  "AgentMemoryState.provenanceCommitment.v1",
);
export const LOCATOR_COMMITMENT_DOMAIN = keccak256Utf8(
  "AgentMemoryState.locatorCommitment.v1",
);

export function randomSalt(): string {
  return "0x" + Array.from(randomBytes(32), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function domainSeparatedCommitment(
  domain: string,
  payload: Uint8Array,
  salt: string,
  profileId?: string,
): string {
  const words = [
    bytes32Word(domain, "domain"),
    ...(profileId === undefined ? [] : [bytes32Word(profileId, "profileId")]),
    bytes32Word(asBytes32(salt, "salt")),
    bytes32Word(keccak256(payload)),
  ];
  return keccak256(concatBytes(...words));
}

/**
 * Commit to plaintext or ciphertext with a 32-byte salt and explicit profile.
 * For low-entropy plaintext, the salt MUST remain secret; encrypted payloads
 * SHOULD use a fresh high-entropy encryption key and nonce.
 */
export function computePrivateCommitment(
  payload: Uint8Array,
  salt: string,
  profileId: string = SALTED_KECCAK_PROFILE_ID,
): string {
  return domainSeparatedCommitment(
    DELTA_COMMITMENT_DOMAIN,
    payload,
    salt,
    asBytes32(profileId, "profileId"),
  );
}

export function computeProvenanceCommitment(
  provenance: Uint8Array,
  salt: string,
): string {
  return domainSeparatedCommitment(PROVENANCE_COMMITMENT_DOMAIN, provenance, salt);
}

export function computeLocatorCommitment(locator: string, salt: string): string {
  if (locator.length === 0) throw new Error("locator must not be empty");
  return domainSeparatedCommitment(
    LOCATOR_COMMITMENT_DOMAIN,
    utf8ToBytes(locator),
    salt,
  );
}
