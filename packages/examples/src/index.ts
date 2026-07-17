export * from "./log.js";
export * from "./awarenessLifecycle.js";
export * from "./multiAgentMerge.js";
export * from "./benchmark.js";

import { runAwarenessLifecycle } from "./awarenessLifecycle.js";
import { runBenchmark } from "./benchmark.js";
import { runMultiAgentMerge } from "./multiAgentMerge.js";

/** Run every demo with console output. Invoked by `npm run demo`. */
export function main(): void {
  const log = (line: string) => console.log(line);

  log("\n=== 1. Awareness lifecycle (cards -> bridge -> delta chain -> capsule) ===");
  const life = runAwarenessLifecycle(log);
  log(`capsule: ${life.capsule.length} deltas, sequence ${life.sequence}, byProfile=${JSON.stringify(life.byProfile)}`);

  log("\n=== 2. Multi-agent concurrent merge (last-writer-wins) ===");
  runMultiAgentMerge(log);

  log("\n=== 3. Benchmark (commit throughput + on-chain footprint) ===");
  runBenchmark(5000, log);
}

// Run when executed directly (node dist/index.js), not when imported.
import { fileURLToPath } from "node:url";
import { argv } from "node:process";
if (process.argv[1] && fileURLToPath(import.meta.url) === argv[1]) {
  main();
}
