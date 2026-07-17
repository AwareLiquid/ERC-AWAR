import { MemoryStateMachine } from "@erc-awar/reference-engine";
import { profileIdFor } from "@erc-awar/awareness-adapter";
import { type Log, noop } from "./log.js";

const SPACE = "0x" + "33".repeat(32);
export interface BenchmarkResult {
  count: number;
  ms: number;
  deltasPerSec: number;
  /** Average off-chain payload size committed per delta (UTF-8 bytes). */
  avgPayloadBytes: number;
  /** Fixed ABI payload of the seven-field public Delta, excluding transaction overhead. */
  onchainBytesPerDelta: number;
  /** Off-chain payload bytes / on-chain commitment bytes. */
  compressionRatio: number;
}

/**
 * Measures local construction throughput and compares private payload size with
 * the seven fixed ABI words in ExperienceDelta v1. It excludes transaction and
 * event overhead and does not involve model inference.
 */
export function runBenchmark(count = 1000, log: Log = noop): BenchmarkResult {
  // A representative knowledge-card payload (~0.5 KB of text).
  const body = "Hybrid retrieval fuses BM25 with dense vectors via RRF. ".repeat(10);

  const chain = new MemoryStateMachine(SPACE);
  let payloadBytes = 0;

  const start = performance.now();
  for (let i = 0; i < count; i++) {
    const content = { text: `${body} #${i}`, cardKind: "insight", tags: ["bench"] };
    payloadBytes += Buffer.byteLength(JSON.stringify(content), "utf8");
    chain.commit({
      payload: { op: "upsert", resourceId: `card-${i}`, content },
      profileId: profileIdFor("TEXT"),
      locator: `awareness://card/${i}`,
    });
  }
  const ms = performance.now() - start;

  const avgPayloadBytes = payloadBytes / count;
  // Seven static ABI words in ExperienceDelta v1. Transaction and event overhead
  // are deployment-specific and intentionally excluded from this structural figure.
  const onchainBytesPerDelta = 7 * 32;
  const result: BenchmarkResult = {
    count,
    ms,
    deltasPerSec: Math.round((count / ms) * 1000),
    avgPayloadBytes: Math.round(avgPayloadBytes),
    onchainBytesPerDelta,
    compressionRatio: Math.round(avgPayloadBytes / onchainBytesPerDelta),
  };

  log(
    `committed ${count} deltas in ${ms.toFixed(1)}ms (${result.deltasPerSec}/s); ` +
      `avg payload ${result.avgPayloadBytes}B -> public Delta ${onchainBytesPerDelta}B ` +
      `(${result.compressionRatio}x)`,
  );
  return result;
}
