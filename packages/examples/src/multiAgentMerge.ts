import { type Change, type Conflict, MemoryStateMachine, mergeChanges } from "@erc-awar/reference-engine";
import { profileIdFor } from "@erc-awar/awareness-adapter";
import { type Log, noop } from "./log.js";

const SPACE = "0x" + "22".repeat(32);
const AGENT_A = "0x" + "a1".repeat(20); // lexicographically smaller
const AGENT_B = "0x" + "b2".repeat(20);

export interface MergeDemoResult {
  conflicts: Conflict[];
  /** Resolved memory ids in deterministic order. */
  mergedIds: string[];
  /** Winning agent per memory id after resolution. */
  winners: Record<string, string>;
  /** Head + version of the chain after committing the merged state. */
  head: string;
  version: number;
}

/**
 * Two agents edit the same Memory Space concurrently (SPEC §4.2). Overlapping
 * ids are resolved by last-writer-wins (timestamp, then lexicographically
 * smaller agent), then the merged state is committed to a single chain.
 */
export function runMultiAgentMerge(log: Log = noop): MergeDemoResult {
  // Agent A's concurrent edits.
  const a: Change[] = [
    { id: "summary", op: "update", content: { text: "A's summary" }, timestamp: 10, agent: AGENT_A },
    { id: "todo", op: "add", content: { text: "write tests" }, timestamp: 12, agent: AGENT_A },
  ];
  // Agent B's concurrent edits — `summary` conflicts (later), `note` is unique.
  const b: Change[] = [
    { id: "summary", op: "update", content: { text: "B's summary" }, timestamp: 20, agent: AGENT_B },
    { id: "note", op: "add", content: { text: "B's note" }, timestamp: 11, agent: AGENT_B },
  ];

  const { merged, conflicts } = mergeChanges(a, b);

  for (const c of conflicts) {
    log(`conflict on "${c.id}": A(t=${c.a.timestamp}) vs B(t=${c.b.timestamp}) -> ${c.winner}`);
  }

  // Commit the resolved state into a single shared evolution chain.
  const chain = new MemoryStateMachine(SPACE);
  for (const change of merged) {
    if (change.op === "deprecate") continue;
    chain.commit({
      payload: { op: change.op, resourceId: change.id, content: change.content },
      profileId: profileIdFor("TEXT"),
      locator: `awareness://card/${change.id}`,
    });
  }

  const winners: Record<string, string> = {};
  for (const c of conflicts) winners[c.id] = c.winner === "a" ? c.a.agent : c.b.agent;

  log(`merged ${merged.length} memories; state=${chain.stateRoot.slice(0, 10)} sequence=${chain.sequence}`);

  return {
    conflicts,
    mergedIds: merged.map((m) => m.id),
    winners,
    head: chain.stateRoot,
    version: Number(chain.sequence),
  };
}
