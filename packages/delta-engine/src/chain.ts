import {
  ZERO32,
  asAddress,
  asBytes32,
  computeDeltaId,
  type ExperienceDelta,
  type MemoryTypeName,
} from "@erc-awar/spec";
import { commitContent } from "./record.js";

export interface CommitInput {
  /** Logical memory id (used to track prior commitment of the same memory). */
  id: string;
  memoryType: MemoryTypeName;
  content: unknown;
  /** bytes32 schema hash. */
  schemaHash: string;
  /** Off-chain locator: ipfs:// | ethstorage:// | ar:// | https:// */
  uri: string;
  /** ERC-8263 inference attestation; defaults to ZERO32. */
  inferenceAnchor?: string;
  /** ERC-8299 / WYRIWE input commitment; defaults to ZERO32. */
  inputHash?: string;
  /** Unix seconds; defaults to now. */
  timestamp?: number;
}

export interface ChainVerification {
  valid: boolean;
  errors: string[];
}

/**
 * A per-space Experience Delta evolution chain (SPEC §4): a Git-like, linear,
 * append-only history. Each commit links to the previous delta and to the prior
 * content commitment of the same logical memory id.
 *
 * Branching DAGs are an open question (SPEC §13.1); this engine is linear.
 */
export class DeltaChain {
  readonly spaceId: string;
  readonly agent: string;

  private _deltas: ExperienceDelta[] = [];
  private _ids: string[] = [];
  private _headId: string = ZERO32;
  private _version = 0;
  private _lastCommitmentById = new Map<string, string>();

  constructor(spaceId: string, agent: string) {
    this.spaceId = asBytes32(spaceId, "spaceId");
    this.agent = asAddress(agent, "agent");
  }

  get head(): string {
    return this._headId;
  }
  get version(): number {
    return this._version;
  }
  get deltas(): readonly ExperienceDelta[] {
    return this._deltas;
  }
  /** deltaIds in commit order, aligned with `deltas`. */
  get ids(): readonly string[] {
    return this._ids;
  }

  /** Append a delta committing one memory change. Returns the delta. */
  commit(input: CommitInput): ExperienceDelta {
    const newContentCommitment = commitContent(input.content);
    const priorMemoryCommitment = this._lastCommitmentById.get(input.id) ?? ZERO32;

    const delta: ExperienceDelta = {
      schema: "erc83xx/delta/v0",
      spaceId: this.spaceId,
      priorMemoryCommitment,
      newContentCommitment,
      memoryType: input.memoryType,
      schemaHash: asBytes32(input.schemaHash, "schemaHash"),
      inferenceAnchor: input.inferenceAnchor ?? ZERO32,
      inputHash: input.inputHash ?? ZERO32,
      previousDelta: this._headId,
      timestamp: input.timestamp ?? Math.floor(Date.now() / 1000),
      version: this._version + 1,
      agent: this.agent,
      uri: input.uri,
    };

    const deltaId = computeDeltaId(delta);
    this._deltas.push(delta);
    this._ids.push(deltaId);
    this._headId = deltaId;
    this._version = delta.version;
    this._lastCommitmentById.set(input.id, newContentCommitment);
    return delta;
  }

  /** Latest committed content commitment for a logical id, or ZERO32. */
  latestCommitment(id: string): string {
    return this._lastCommitmentById.get(id) ?? ZERO32;
  }

  /**
   * Verify integrity: deltaId recomputation, previousDelta linkage, monotonic
   * versions, and consistent spaceId.
   */
  verify(): ChainVerification {
    const errors: string[] = [];
    let prevId = ZERO32;
    for (let i = 0; i < this._deltas.length; i++) {
      const d = this._deltas[i];
      const id = computeDeltaId(d);
      if (id !== this._ids[i]) errors.push(`#${i}: deltaId mismatch`);
      if (d.previousDelta !== prevId) errors.push(`#${i}: previousDelta not linked`);
      if (d.version !== i + 1) errors.push(`#${i}: version expected ${i + 1}, got ${d.version}`);
      if (d.spaceId !== this.spaceId) errors.push(`#${i}: spaceId mismatch`);
      prevId = id;
    }
    if (prevId !== this._headId) errors.push("head does not match last delta");
    return { valid: errors.length === 0, errors };
  }
}
