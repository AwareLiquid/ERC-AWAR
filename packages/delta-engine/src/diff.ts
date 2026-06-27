import { ZERO32 } from "@erc-awar/spec";
import { commitContent, type MemoryEntry } from "./record.js";

export type DiffOp =
  | { op: "add"; id: string; entry: MemoryEntry; commitment: string; priorCommitment: string }
  | { op: "update"; id: string; entry: MemoryEntry; commitment: string; priorCommitment: string }
  | { op: "deprecate"; id: string; priorCommitment: string };

function index(entries: MemoryEntry[]): Map<string, MemoryEntry> {
  const m = new Map<string, MemoryEntry>();
  for (const e of entries) {
    if (m.has(e.id)) throw new Error(`duplicate entry id: ${e.id}`);
    m.set(e.id, e);
  }
  return m;
}

/**
 * Record-level diff between two memory states (SPEC §4.1 ops). Output is sorted
 * by id for determinism. Unchanged entries (same content commitment) are omitted.
 */
export function diffStates(prev: MemoryEntry[], next: MemoryEntry[]): DiffOp[] {
  const prevMap = index(prev);
  const nextMap = index(next);
  const ops: DiffOp[] = [];

  for (const [id, entry] of nextMap) {
    const commitment = commitContent(entry.content);
    const before = prevMap.get(id);
    if (!before) {
      ops.push({ op: "add", id, entry, commitment, priorCommitment: ZERO32 });
      continue;
    }
    const priorCommitment = commitContent(before.content);
    if (priorCommitment !== commitment) {
      ops.push({ op: "update", id, entry, commitment, priorCommitment });
    }
  }

  for (const [id, entry] of prevMap) {
    if (!nextMap.has(id)) {
      ops.push({ op: "deprecate", id, priorCommitment: commitContent(entry.content) });
    }
  }

  return ops.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
