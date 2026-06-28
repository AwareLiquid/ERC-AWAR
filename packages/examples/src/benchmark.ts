import { DeltaChain } from "@erc-awar/delta-engine";
import { schemaHashFor } from "@erc-awar/mcp-bridge";
import { type Log, noop } from "./log.js";

const SPACE = "0x" + "33".repeat(32);
const AGENT = "0x" + "a1".repeat(20);

export interface BenchmarkResult {
  count: number;
  ms: number;
  deltasPerSec: number;
  /** Average off-chain payload size committed per delta (UTF-8 bytes). */
  avgPayloadBytes: number;
  /** On-chain footprint per memory: a single 32-byte commitment, regardless of payload. */
  onchainBytesPerDelta: number;
  /** Off-chain payload bytes / on-chain commitment bytes. */
  compressionRatio: number;
}

/**
 * Measures Experience-Delta commit throughput and the core economic property of
 * ERC-83xx: the on-chain footprint of a memory is a fixed 32-byte commitment,
 * independent of how large the off-chain payload is (SPEC §6, §12). This is a
 * structural measurement (no model inference involved), so it is deterministic.
 */
export function runBenchmark(count = 1000, log: Log = noop): BenchmarkResult {
  // A representative knowledge-card payload (~0.5 KB of text).
  const body = "Hybrid retrieval fuses BM25 with dense vectors via RRF. ".repeat(10);

  const chain = new DeltaChain(SPACE, AGENT);
  let payloadBytes = 0;

  const start = performance.now();
  for (let i = 0; i < count; i++) {
    const content = { text: `${body} #${i}`, cardKind: "insight", tags: ["bench"] };
    payloadBytes += Buffer.byteLength(JSON.stringify(content), "utf8");
    chain.commit({
      id: `card-${i}`,
      memoryType: "TEXT",
      content,
      schemaHash: schemaHashFor("TEXT"),
      uri: `awareness://card/${i}`,
      timestamp: 1_700_000_000 + i,
    });
  }
  const ms = performance.now() - start;

  const avgPayloadBytes = payloadBytes / count;
  const onchainBytesPerDelta = 32; // newContentCommitment
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
      `avg payload ${result.avgPayloadBytes}B -> on-chain 32B (${result.compressionRatio}x)`,
  );
  return result;
}
