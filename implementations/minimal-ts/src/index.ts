import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

export interface MinimalDelta {
  spaceId: string;
  sequence: bigint;
  prevStateRoot: string;
  deltaCommitment: string;
  provenanceCommitment: string;
  profileId: string;
  locatorCommitment: string;
}

export interface MinimalTransition {
  delta: MinimalDelta;
  transitionId: string;
  nextStateRoot: string;
}

export const ZERO32 = "0x" + "00".repeat(32);

const DELTA_TYPE =
  "ExperienceDelta(bytes32 spaceId,uint64 sequence,bytes32 prevStateRoot,bytes32 deltaCommitment,bytes32 provenanceCommitment,bytes32 profileId,bytes32 locatorCommitment)";
const STATE_TYPE = "MemoryState(bytes32 prevStateRoot,bytes32 transitionId)";
const SPACE_TYPE = "MemorySpace(address initialController,bytes32 salt)";
const DOMAIN_TYPE =
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";
const REGISTRATION_TYPE =
  "SpaceRegistration(bytes32 spaceId,address controller,address authorizer)";
const AUTHORIZATION_TYPE =
  "SpaceAuthorization(bytes32 spaceId,address newController,address newAuthorizer,uint64 nonce)";

const DELTA_COMMITMENT_DOMAIN = "AgentMemoryState.deltaCommitment.v1";
const PROVENANCE_COMMITMENT_DOMAIN = "AgentMemoryState.provenanceCommitment.v1";
const LOCATOR_COMMITMENT_DOMAIN = "AgentMemoryState.locatorCommitment.v1";

function hash(bytes: Uint8Array): string {
  return "0x" + bytesToHex(keccak_256(bytes));
}

function hashText(value: string): string {
  return hash(utf8ToBytes(value));
}

function bytes32(value: string): Uint8Array {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error("expected bytes32");
  return Uint8Array.from(
    { length: 32 },
    (_, index) => Number.parseInt(value.slice(2 + index * 2, 4 + index * 2), 16),
  );
}

function normalizedBytes32(value: string): string {
  bytes32(value);
  return value.toLowerCase();
}

function addressWord(value: string): Uint8Array {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error("expected address");
  const output = new Uint8Array(32);
  for (let index = 0; index < 20; index++) {
    output[index + 12] = Number.parseInt(
      value.slice(2 + index * 2, 4 + index * 2),
      16,
    );
  }
  return output;
}

function uintWord(value: bigint, bits: 64 | 256): Uint8Array {
  if (value < 0n || value >= 1n << BigInt(bits)) {
    throw new Error(`expected uint${bits}`);
  }
  const word = new Uint8Array(32);
  let remaining = value;
  for (let index = 31; index >= 0; index--) {
    word[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return word;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function words(parts: Uint8Array[]): Uint8Array {
  if (parts.some((part) => part.length !== 32)) throw new Error("expected ABI words");
  return concat(parts);
}

function payloadBytes(value: string | Uint8Array): Uint8Array {
  return typeof value === "string" ? utf8ToBytes(value) : value;
}

export const EXPERIENCE_DELTA_TYPEHASH = hashText(DELTA_TYPE);
export const MEMORY_STATE_TYPEHASH = hashText(STATE_TYPE);
export const MEMORY_SPACE_TYPEHASH = hashText(SPACE_TYPE);

export function transitionId(delta: MinimalDelta): string {
  return hash(words([
    bytes32(EXPERIENCE_DELTA_TYPEHASH),
    bytes32(delta.spaceId),
    uintWord(delta.sequence, 64),
    bytes32(delta.prevStateRoot),
    bytes32(delta.deltaCommitment),
    bytes32(delta.provenanceCommitment),
    bytes32(delta.profileId),
    bytes32(delta.locatorCommitment),
  ]));
}

export function nextStateRoot(prevStateRoot: string, id: string): string {
  return hash(words([
    bytes32(MEMORY_STATE_TYPEHASH),
    bytes32(prevStateRoot),
    bytes32(id),
  ]));
}

export function deriveSpaceId(initialController: string, salt: string): string {
  if (/^0x0{40}$/i.test(initialController)) throw new Error("zero controller");
  return hash(words([
    bytes32(MEMORY_SPACE_TYPEHASH),
    addressWord(initialController),
    bytes32(salt),
  ]));
}

export function privateDeltaCommitment(
  payload: string | Uint8Array,
  salt: string,
  profileId: string,
): string {
  return hash(words([
    bytes32(hashText(DELTA_COMMITMENT_DOMAIN)),
    bytes32(profileId),
    bytes32(salt),
    bytes32(hash(payloadBytes(payload))),
  ]));
}

export function provenanceCommitment(
  provenance: string | Uint8Array,
  salt: string,
): string {
  return hash(words([
    bytes32(hashText(PROVENANCE_COMMITMENT_DOMAIN)),
    bytes32(salt),
    bytes32(hash(payloadBytes(provenance))),
  ]));
}

export function locatorCommitment(locator: string, salt: string): string {
  if (locator.length === 0) throw new Error("empty locator");
  return hash(words([
    bytes32(hashText(LOCATOR_COMMITMENT_DOMAIN)),
    bytes32(salt),
    bytes32(hashText(locator)),
  ]));
}

export function domainSeparator(
  chainId: bigint | number | string,
  verifyingContract: string,
): string {
  return hash(words([
    bytes32(hashText(DOMAIN_TYPE)),
    bytes32(hashText("AgentMemoryState")),
    bytes32(hashText("1")),
    uintWord(BigInt(chainId), 256),
    addressWord(verifyingContract),
  ]));
}

export function signingDigest(structHash: string, domain: string): string {
  return hash(concat([
    new Uint8Array([0x19, 0x01]),
    bytes32(domain),
    bytes32(structHash),
  ]));
}

export function spaceRegistrationId(
  spaceId: string,
  controller: string,
  authorizer: string,
): string {
  return hash(words([
    bytes32(hashText(REGISTRATION_TYPE)),
    bytes32(spaceId),
    addressWord(controller),
    addressWord(authorizer),
  ]));
}

export function spaceAuthorizationId(
  spaceId: string,
  newController: string,
  newAuthorizer: string,
  nonce: bigint,
): string {
  return hash(words([
    bytes32(hashText(AUTHORIZATION_TYPE)),
    bytes32(spaceId),
    addressWord(newController),
    addressWord(newAuthorizer),
    uintWord(nonce, 64),
  ]));
}

function normalizeDelta(delta: MinimalDelta): MinimalDelta {
  return {
    spaceId: normalizedBytes32(delta.spaceId),
    sequence: delta.sequence,
    prevStateRoot: normalizedBytes32(delta.prevStateRoot),
    deltaCommitment: normalizedBytes32(delta.deltaCommitment),
    provenanceCommitment: normalizedBytes32(delta.provenanceCommitment),
    profileId: normalizedBytes32(delta.profileId),
    locatorCommitment: normalizedBytes32(delta.locatorCommitment),
  };
}

/** A dependency-isolated implementation of the normative linear state machine. */
export class MinimalStateMachine {
  readonly spaceId: string;
  private _stateRoot = ZERO32;
  private _sequence = 0n;

  constructor(spaceId: string) {
    this.spaceId = normalizedBytes32(spaceId);
    if (this.spaceId === ZERO32) throw new Error("zero spaceId");
  }

  get stateRoot(): string {
    return this._stateRoot;
  }

  get sequence(): bigint {
    return this._sequence;
  }

  append(input: MinimalDelta): MinimalTransition {
    const delta = normalizeDelta(input);
    if (delta.spaceId !== this.spaceId) throw new Error("spaceId mismatch");
    if (delta.deltaCommitment === ZERO32) throw new Error("zero deltaCommitment");
    if (delta.profileId === ZERO32) throw new Error("zero profileId");
    if (delta.sequence !== this._sequence + 1n) throw new Error("sequence mismatch");
    if (delta.prevStateRoot !== this._stateRoot) throw new Error("state root mismatch");

    const id = transitionId(delta);
    const root = nextStateRoot(this._stateRoot, id);
    this._sequence = delta.sequence;
    this._stateRoot = root;
    return { delta, transitionId: id, nextStateRoot: root };
  }
}
