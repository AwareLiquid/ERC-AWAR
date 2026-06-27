import { computeDeltaId } from "@erc-awar/spec";
import {
  type AwarenessCard,
  type EmbeddingInput,
  type IngestOptions,
  MemoryBridge,
} from "./bridge.js";

/**
 * Framework-agnostic tool layer. These handlers contain the bridge's MCP
 * behavior without depending on any MCP SDK, so they are unit-testable and can
 * be mounted onto any server (stdio, HTTP, in-process). `inputSchema` is a JSON
 * Schema suitable for MCP `tools/list`.
 */
export interface BridgeTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => unknown;
}

/** Compact view of a committed delta returned to MCP callers. */
export interface DeltaSummary {
  deltaId: string;
  spaceId: string;
  memoryType: string;
  version: number;
  priorMemoryCommitment: string;
  newContentCommitment: string;
  previousDelta: string;
  uri: string;
}

function summarize(delta: ReturnType<MemoryBridge["ingest"]>): DeltaSummary {
  return {
    deltaId: computeDeltaId(delta),
    spaceId: delta.spaceId,
    memoryType: delta.memoryType,
    version: delta.version,
    priorMemoryCommitment: delta.priorMemoryCommitment,
    newContentCommitment: delta.newContentCommitment,
    previousDelta: delta.previousDelta,
    uri: delta.uri,
  };
}

/** Build the bridge tool set bound to a given `MemoryBridge`. */
export function createBridgeTools(bridge: MemoryBridge): BridgeTool[] {
  return [
    {
      name: "awareness_ingest_card",
      description:
        "Ingest an Awareness memory card (decision/insight/solution/workflow/memory/task), committing one ERC-83xx Experience Delta. Re-using a card id extends that memory's evolution chain.",
      inputSchema: {
        type: "object",
        required: ["card"],
        properties: {
          card: {
            type: "object",
            required: ["id", "type", "content"],
            properties: {
              id: { type: "string" },
              type: {
                enum: ["decision", "insight", "solution", "workflow", "memory", "task"],
              },
              content: {},
              title: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              createdAt: { type: "integer" },
              updatedAt: { type: "integer" },
              subject: { type: "string" },
            },
          },
          options: { type: "object" },
        },
      },
      handler: (args) =>
        summarize(
          bridge.ingest(
            args.card as AwarenessCard,
            (args.options as IngestOptions) ?? {},
          ),
        ),
    },
    {
      name: "awareness_ingest_embedding",
      description:
        "Commit a dense retrieval vector (e.g. all-MiniLM-L6-v2, 384-dim) as an ERC-83xx MEMORY_EMBEDDING delta.",
      inputSchema: {
        type: "object",
        required: ["embedding"],
        properties: {
          embedding: {
            type: "object",
            required: ["id", "model", "dim", "vector"],
            properties: {
              id: { type: "string" },
              model: { type: "string" },
              dim: { type: "integer" },
              vector: { type: "array", items: { type: "number" } },
              metric: { enum: ["cosine", "dot", "l2"] },
              dtype: { enum: ["float32", "float16", "int8"] },
              vectorUri: { type: "string" },
            },
          },
          options: { type: "object" },
        },
      },
      handler: (args) =>
        summarize(
          bridge.ingestEmbedding(
            args.embedding as EmbeddingInput,
            (args.options as IngestOptions) ?? {},
          ),
        ),
    },
    {
      name: "memory_export_chain",
      description:
        "Export the full ordered Experience Delta chain for this memory space (an ERC-8269 portability capsule).",
      inputSchema: { type: "object", properties: {} },
      handler: () => ({
        spaceId: bridge.chain.spaceId,
        agent: bridge.chain.agent,
        head: bridge.chain.head,
        version: bridge.chain.version,
        deltas: bridge.export(),
      }),
    },
    {
      name: "memory_verify_chain",
      description:
        "Verify integrity of the Experience Delta chain (deltaId recomputation, previousDelta linkage, monotonic versions).",
      inputSchema: { type: "object", properties: {} },
      handler: () => bridge.verify(),
    },
  ];
}
