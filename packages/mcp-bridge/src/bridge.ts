import {
  type ExperienceDelta,
  type MemoryTypeName,
  validateContent,
} from "@erc-awar/spec";
import { DeltaChain } from "@erc-awar/delta-engine";
import {
  type AwarenessCardType,
  type CardTypeMap,
  DEFAULT_CARD_TYPE_MAP,
  isAwarenessCardType,
} from "./cardTypes.js";
import { schemaHashFor } from "./schema.js";

/** An Awareness memory card (application layer). */
export interface AwarenessCard {
  /** Stable logical id; reused across versions to track a memory's evolution. */
  id: string;
  type: AwarenessCardType;
  /** Card body: free text, or a structured object. */
  content: string | Record<string, unknown>;
  title?: string;
  tags?: string[];
  /** Unix seconds the card was created. */
  createdAt?: number;
  /** Unix seconds the card was last updated. */
  updatedAt?: number;
  /** Subject address (0x…20 bytes) for episodic memories. */
  subject?: string;
}

/** Raw embedding payload (e.g. all-MiniLM-L6-v2, 384-dim) from Awareness's index. */
export interface EmbeddingInput {
  id: string;
  model: string;
  dim: number;
  vector: number[];
  metric?: "cosine" | "dot" | "l2";
  dtype?: "float32" | "float16" | "int8";
  vectorUri?: string;
}

export interface IngestOptions {
  /** Unix seconds; defaults to now. */
  timestamp?: number;
  /** Off-chain locator; defaults to `awareness://card/<id>`. */
  uri?: string;
  /** ERC-8263 inference attestation. */
  inferenceAnchor?: string;
  /** ERC-8299 / WYRIWE input commitment. */
  inputHash?: string;
}

export interface BridgeOptions {
  /** Override individual card -> MEMORY_* mappings. */
  cardTypeMap?: Partial<CardTypeMap>;
  /** Validate built content against the spec schema before committing (default true). */
  validate?: boolean;
}

function asText(content: string | Record<string, unknown>): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

/**
 * Build schema-valid MEMORY_* content for a card targeting `memoryType`.
 * Exposed for testing / custom pipelines.
 */
export function buildContent(
  card: AwarenessCard,
  memoryType: MemoryTypeName,
  timestamp: number,
): Record<string, unknown> {
  const text = asText(card.content);
  switch (memoryType) {
    case "TEXT":
      return {
        text,
        ...(card.title !== undefined ? { title: card.title } : {}),
        cardKind: card.type,
        ...(card.tags !== undefined ? { tags: card.tags } : {}),
      };
    case "POLICY":
      return {
        rule: text,
        scope: "agent",
        cardKind: card.type,
      };
    case "EPISODIC":
      return {
        event: text,
        occurredAt: card.createdAt ?? card.updatedAt ?? timestamp,
        cardKind: card.type,
        ...(card.subject !== undefined ? { subject: card.subject } : {}),
      };
    default:
      // Custom mappings to other categories pass structured content through.
      return typeof card.content === "string" ? { text } : { ...card.content };
  }
}

/**
 * Bridges Awareness cards into a per-space ERC-83xx Experience Delta chain.
 * Each ingested card becomes one verifiable memory state transition; re-ingesting
 * the same `id` extends that memory's evolution history (SPEC §4).
 */
export class MemoryBridge {
  readonly chain: DeltaChain;
  private readonly map: CardTypeMap;
  private readonly doValidate: boolean;

  constructor(spaceId: string, agent: string, opts: BridgeOptions = {}) {
    this.chain = new DeltaChain(spaceId, agent);
    this.map = { ...DEFAULT_CARD_TYPE_MAP, ...(opts.cardTypeMap ?? {}) };
    this.doValidate = opts.validate ?? true;
  }

  /** The MEMORY_* type a card kind maps to under this bridge's configuration. */
  memoryTypeOf(cardType: AwarenessCardType): MemoryTypeName {
    return this.map[cardType];
  }

  /** Ingest one card, committing an Experience Delta. */
  ingest(card: AwarenessCard, opts: IngestOptions = {}): ExperienceDelta {
    if (!isAwarenessCardType(card.type)) {
      throw new Error(`unknown Awareness card type: ${String(card.type)}`);
    }
    const memoryType = this.map[card.type];
    const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
    const content = buildContent(card, memoryType, timestamp);

    if (this.doValidate) {
      const res = validateContent(memoryType, content);
      if (!res.valid) {
        throw new Error(
          `card ${card.id} -> ${memoryType} content invalid: ${res.errors.join("; ")}`,
        );
      }
    }

    return this.chain.commit({
      id: card.id,
      memoryType,
      content,
      schemaHash: schemaHashFor(memoryType),
      uri: opts.uri ?? `awareness://card/${card.id}`,
      inferenceAnchor: opts.inferenceAnchor,
      inputHash: opts.inputHash,
      timestamp,
    });
  }

  /** Ingest many cards in order. */
  ingestAll(cards: AwarenessCard[], opts: IngestOptions = {}): ExperienceDelta[] {
    return cards.map((c) => this.ingest(c, opts));
  }

  /** Commit a dense vector from Awareness's retrieval index as MEMORY_EMBEDDING. */
  ingestEmbedding(input: EmbeddingInput, opts: IngestOptions = {}): ExperienceDelta {
    const content: Record<string, unknown> = {
      model: input.model,
      dim: input.dim,
      vector: input.vector,
      ...(input.metric !== undefined ? { metric: input.metric } : {}),
      ...(input.dtype !== undefined ? { dtype: input.dtype } : {}),
      ...(input.vectorUri !== undefined ? { vectorUri: input.vectorUri } : {}),
    };

    if (this.doValidate) {
      const res = validateContent("EMBEDDING", content);
      if (!res.valid) {
        throw new Error(`embedding ${input.id} content invalid: ${res.errors.join("; ")}`);
      }
    }

    return this.chain.commit({
      id: input.id,
      memoryType: "EMBEDDING",
      content,
      schemaHash: schemaHashFor("EMBEDDING"),
      uri: opts.uri ?? input.vectorUri ?? `awareness://embedding/${input.id}`,
      inferenceAnchor: opts.inferenceAnchor,
      inputHash: opts.inputHash,
      timestamp: opts.timestamp ?? Math.floor(Date.now() / 1000),
    });
  }

  /** Ordered Experience Deltas committed so far. */
  export(): readonly ExperienceDelta[] {
    return this.chain.deltas;
  }

  /** Verify chain integrity (delegates to the delta engine). */
  verify() {
    return this.chain.verify();
  }
}
