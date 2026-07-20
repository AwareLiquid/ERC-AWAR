/**
 * Multi-way (one-way / multi-way) merge of concurrent memory changes for the
 * same space (SPEC §4.2). This resolves card-level concurrent edits; full
 * branching-DAG merge is an open question (SPEC §13.1).
 */

export interface Change {
  /** Logical memory id. */
  id: string;
  op: "add" | "update" | "deprecate";
  /** Application content (omitted for deprecate). */
  content?: unknown;
  /** Content commitment, if precomputed. */
  commitment?: string;
  /** Unix seconds — used for last-writer-wins. */
  timestamp: number;
  /** Author identity (ERC-8004) — deterministic tie-break. */
  agent: string;
}

export interface Conflict {
  id: string;
  a: Change;
  b: Change;
  winner: "a" | "b";
}

export interface MergeResult {
  merged: Change[];
  conflicts: Conflict[];
}

export type Resolver = (a: Change, b: Change) => "a" | "b";

/** Last-writer-wins by timestamp; tie broken by lexicographically smaller agent. */
export const lwwResolver: Resolver = (a, b) => {
  if (a.timestamp !== b.timestamp) return a.timestamp > b.timestamp ? "a" : "b";
  return a.agent.toLowerCase() <= b.agent.toLowerCase() ? "a" : "b";
};

function indexById(changes: Change[]): Map<string, Change> {
  const m = new Map<string, Change>();
  for (const c of changes) {
    const existing = m.get(c.id);
    // within one side, keep the latest by the same policy
    if (!existing || lwwResolver(c, existing) === "a") m.set(c.id, c);
  }
  return m;
}

/**
 * Merge two sets of concurrent changes. Non-overlapping ids pass through;
 * overlapping ids are conflicts resolved by `resolver` (default LWW).
 * Output is sorted by id for determinism.
 */
export function mergeChanges(
  a: Change[],
  b: Change[],
  resolver: Resolver = lwwResolver,
): MergeResult {
  const aMap = indexById(a);
  const bMap = indexById(b);
  const merged: Change[] = [];
  const conflicts: Conflict[] = [];

  const ids = new Set<string>([...aMap.keys(), ...bMap.keys()]);
  for (const id of ids) {
    const ca = aMap.get(id);
    const cb = bMap.get(id);
    if (ca && cb) {
      const winner = resolver(ca, cb);
      conflicts.push({ id, a: ca, b: cb, winner });
      merged.push(winner === "a" ? ca : cb);
    } else {
      merged.push((ca ?? cb) as Change);
    }
  }

  merged.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  conflicts.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return { merged, conflicts };
}
