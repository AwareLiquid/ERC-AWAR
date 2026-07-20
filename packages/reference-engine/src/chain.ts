import {
  ZERO32,
  asBytes32,
  computeLocatorCommitment,
  computeNextStateRoot,
  computePrivateCommitment,
  computeProvenanceCommitment,
  computeTransitionId,
  normalizeExperienceDelta,
  randomSalt,
  type ExperienceDelta,
} from "@erc-awar/core";
import { encodeContent } from "./record.js";

export interface CommitInput {
  /** Opaque memory operation or encrypted delta. */
  payload: unknown | Uint8Array;
  /** Profile defining payload semantics and commitment handling. */
  profileId: string;
  /** Optional private locator. Only its commitment enters ExperienceDelta. */
  locator?: string;
  /** Optional opaque provenance envelope. */
  provenance?: unknown | Uint8Array;
  /** Explicit salts are useful for deterministic vectors; fresh random defaults are safe. */
  deltaSalt?: string;
  locatorSalt?: string;
  provenanceSalt?: string;
}

export interface PrivateWitness {
  deltaSalt: string;
  locator?: string;
  locatorSalt?: string;
  provenanceSalt?: string;
}

export interface TransitionRecord {
  delta: ExperienceDelta;
  transitionId: string;
  nextStateRoot: string;
  /** Never submit this witness as public calldata. */
  witness?: PrivateWitness;
}

export interface ChainVerification {
  valid: boolean;
  errors: string[];
}

/**
 * A per-space, linear Experience Delta state machine. Each accepted transition
 * binds the exact prior state root and advances a monotonically increasing
 * sequence. Branching and merge semantics are outside v1.
 */
export class MemoryStateMachine {
  readonly spaceId: string;

  private _records: TransitionRecord[] = [];
  private _stateRoot: string = ZERO32;
  private _headTransitionId: string = ZERO32;
  private _sequence = 0n;

  constructor(spaceId: string) {
    this.spaceId = asBytes32(spaceId, "spaceId");
    if (this.spaceId === ZERO32) throw new Error("spaceId must not be ZERO32");
  }

  get stateRoot(): string {
    return this._stateRoot;
  }
  get headTransitionId(): string {
    return this._headTransitionId;
  }
  get sequence(): bigint {
    return this._sequence;
  }
  get deltas(): readonly ExperienceDelta[] {
    return this._records.map((record) => record.delta);
  }
  get records(): readonly TransitionRecord[] {
    return this._records;
  }

  /** Prepare and append one privacy-preserving transition. */
  commit(input: CommitInput): TransitionRecord {
    if (asBytes32(input.profileId, "profileId") === ZERO32) {
      throw new Error("profileId must not be ZERO32");
    }
    const deltaSalt = input.deltaSalt ?? randomSalt();
    const locatorSalt = input.locator === undefined
      ? undefined
      : (input.locatorSalt ?? randomSalt());
    const provenanceSalt = input.provenance === undefined
      ? undefined
      : (input.provenanceSalt ?? randomSalt());
    const delta: ExperienceDelta = {
      spaceId: this.spaceId,
      sequence: this._sequence + 1n,
      prevStateRoot: this._stateRoot,
      deltaCommitment: computePrivateCommitment(
        encodeContent(input.payload),
        deltaSalt,
        input.profileId,
      ),
      provenanceCommitment: input.provenance === undefined
        ? ZERO32
        : computeProvenanceCommitment(
            encodeContent(input.provenance),
            provenanceSalt as string,
          ),
      profileId: asBytes32(input.profileId, "profileId"),
      locatorCommitment: input.locator === undefined
        ? ZERO32
        : computeLocatorCommitment(input.locator, locatorSalt as string),
    };
    const record = this.append(delta);
    record.witness = {
      deltaSalt,
      ...(input.locator === undefined
        ? {}
        : { locator: input.locator, locatorSalt: locatorSalt as string }),
      ...(provenanceSalt === undefined ? {} : { provenanceSalt }),
    };
    return record;
  }

  /** Append a transition prepared by another implementation. */
  append(input: ExperienceDelta): TransitionRecord {
    const delta = normalizeExperienceDelta(input);
    if (delta.spaceId !== this.spaceId) throw new Error("spaceId mismatch");
    if (delta.deltaCommitment === ZERO32) {
      throw new Error("deltaCommitment must not be ZERO32");
    }
    if (delta.profileId === ZERO32) throw new Error("profileId must not be ZERO32");
    if (delta.sequence !== this._sequence + 1n) throw new Error("sequence mismatch");
    if (delta.prevStateRoot !== this._stateRoot) throw new Error("prevStateRoot mismatch");

    const transitionId = computeTransitionId(delta);
    if (this._records.some((record) => record.transitionId === transitionId)) {
      throw new Error("duplicate transitionId");
    }
    const nextStateRoot = computeNextStateRoot(this._stateRoot, transitionId);
    const record: TransitionRecord = { delta, transitionId, nextStateRoot };
    this._records.push(record);
    this._stateRoot = nextStateRoot;
    this._headTransitionId = transitionId;
    this._sequence = delta.sequence;
    return record;
  }

  /**
   * Verify transition identifiers, prior state roots, sequence, and Space ID.
   */
  verify(): ChainVerification {
    const errors: string[] = [];
    let stateRoot = ZERO32;
    let headTransitionId = ZERO32;
    for (let i = 0; i < this._records.length; i++) {
      const record = this._records[i];
      const expectedSequence = BigInt(i + 1);
      const transitionId = computeTransitionId(record.delta);
      const nextStateRoot = computeNextStateRoot(stateRoot, transitionId);
      if (record.delta.spaceId !== this.spaceId) errors.push(`#${i}: spaceId mismatch`);
      if (record.delta.sequence !== expectedSequence) errors.push(`#${i}: sequence mismatch`);
      if (record.delta.prevStateRoot !== stateRoot) errors.push(`#${i}: prevStateRoot mismatch`);
      if (record.transitionId !== transitionId) errors.push(`#${i}: transitionId mismatch`);
      if (record.nextStateRoot !== nextStateRoot) errors.push(`#${i}: nextStateRoot mismatch`);
      stateRoot = nextStateRoot;
      headTransitionId = transitionId;
    }
    if (stateRoot !== this._stateRoot) errors.push("stateRoot does not match history");
    if (headTransitionId !== this._headTransitionId) {
      errors.push("headTransitionId does not match history");
    }
    return { valid: errors.length === 0, errors };
  }
}
