import {
  type AwarenessCard,
  type EmbeddingInput,
  type IngestOptions,
  AwarenessAdapter,
  type AwarenessTransition,
} from "./bridge.js";

export interface BridgeTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => unknown;
}

export interface TransitionSummary {
  transitionId: string;
  spaceId: string;
  sequence: string;
  profile: string;
  prevStateRoot: string;
  nextStateRoot: string;
  deltaCommitment: string;
  provenanceCommitment: string;
  locatorCommitment: string;
}

function summarize(record: AwarenessTransition): TransitionSummary {
  return {
    transitionId: record.transitionId,
    spaceId: record.delta.spaceId,
    sequence: record.delta.sequence.toString(10),
    profile: record.profile,
    prevStateRoot: record.delta.prevStateRoot,
    nextStateRoot: record.nextStateRoot,
    deltaCommitment: record.delta.deltaCommitment,
    provenanceCommitment: record.delta.provenanceCommitment,
    locatorCommitment: record.delta.locatorCommitment,
  };
}

export function createBridgeTools(bridge: AwarenessAdapter): BridgeTool[] {
  return [
    {
      name: "awareness_ingest_card",
      description: "Prepare a private Awareness card transition for an Agent Memory State space.",
      inputSchema: {
        type: "object",
        required: ["card"],
        properties: {
          card: {
            type: "object",
            required: ["id", "type", "content"],
            properties: {
              id: { type: "string" },
              type: { enum: ["decision", "insight", "solution", "workflow", "memory", "task"] },
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
      handler: (args) => summarize(
        bridge.ingest(args.card as AwarenessCard, (args.options as IngestOptions) ?? {}),
      ),
    },
    {
      name: "awareness_ingest_embedding",
      description: "Prepare a private Awareness embedding transition.",
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
      handler: (args) => summarize(
        bridge.ingestEmbedding(
          args.embedding as EmbeddingInput,
          (args.options as IngestOptions) ?? {},
        ),
      ),
    },
    {
      name: "memory_export_chain",
      description: "Export ordered public transition claims; private witnesses stay separate.",
      inputSchema: { type: "object", properties: {} },
      handler: () => ({
        spaceId: bridge.machine.spaceId,
        stateRoot: bridge.machine.stateRoot,
        headTransitionId: bridge.machine.headTransitionId,
        sequence: bridge.machine.sequence.toString(10),
        deltas: bridge.exportDeltas().map((delta) => ({
          ...delta,
          sequence: delta.sequence.toString(10),
        })),
      }),
    },
    {
      name: "memory_verify_chain",
      description: "Verify transition ids, sequence numbers, and every state-root transition.",
      inputSchema: { type: "object", properties: {} },
      handler: () => bridge.verify(),
    },
  ];
}
