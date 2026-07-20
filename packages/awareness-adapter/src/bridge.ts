import type { ExperienceDelta } from "@erc-awar/core";
import {
  MemoryStateMachine,
  type PrivateWitness,
  type TransitionRecord,
} from "@erc-awar/reference-engine";
import {
  type AwarenessCardType,
  type AwarenessProfileName,
  type CardTypeMap,
  DEFAULT_CARD_TYPE_MAP,
  isAwarenessCardType,
} from "./cardTypes.js";
import { profileIdFor } from "./schema.js";
import { validateProfileContent } from "./validate.js";

export interface AwarenessCard {
  id: string;
  type: AwarenessCardType;
  content: string | Record<string, unknown>;
  title?: string;
  tags?: string[];
  createdAt?: number;
  updatedAt?: number;
  subject?: string;
}

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
  /** Product timestamp used inside the private payload, never as chain ordering. */
  timestamp?: number;
  locator?: string;
  /** Generic provenance envelope, avoiding hard dependencies on draft ERCs. */
  provenance?: unknown;
  deltaSalt?: string;
  locatorSalt?: string;
  provenanceSalt?: string;
}

export interface BridgeOptions {
  cardTypeMap?: Partial<CardTypeMap>;
  validate?: boolean;
}

export interface AwarenessTransition extends TransitionRecord {
  resourceId: string;
  profile: AwarenessProfileName;
  witness: PrivateWitness;
}

function asText(content: string | Record<string, unknown>): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

export function buildContent(
  card: AwarenessCard,
  profile: AwarenessProfileName,
  timestamp: number,
): Record<string, unknown> {
  const text = asText(card.content);
  switch (profile) {
    case "TEXT":
      return {
        text,
        ...(card.title !== undefined ? { title: card.title } : {}),
        cardKind: card.type,
        ...(card.tags !== undefined ? { tags: card.tags } : {}),
      };
    case "POLICY":
      return { rule: text, scope: "agent", cardKind: card.type };
    case "EPISODIC":
      return {
        event: text,
        occurredAt: card.createdAt ?? card.updatedAt ?? timestamp,
        cardKind: card.type,
        ...(card.subject !== undefined ? { subject: card.subject } : {}),
      };
    default:
      return typeof card.content === "string" ? { text } : { ...card.content };
  }
}

export class AwarenessAdapter {
  readonly machine: MemoryStateMachine;
  private readonly map: CardTypeMap;
  private readonly doValidate: boolean;
  private readonly transitions: AwarenessTransition[] = [];

  constructor(spaceId: string, opts: BridgeOptions = {}) {
    this.machine = new MemoryStateMachine(spaceId);
    this.map = { ...DEFAULT_CARD_TYPE_MAP, ...(opts.cardTypeMap ?? {}) };
    this.doValidate = opts.validate ?? true;
  }

  get chain(): MemoryStateMachine {
    return this.machine;
  }

  profileOf(cardType: AwarenessCardType): AwarenessProfileName {
    return this.map[cardType];
  }

  ingest(card: AwarenessCard, opts: IngestOptions = {}): AwarenessTransition {
    if (!isAwarenessCardType(card.type)) {
      throw new Error(`unknown Awareness card type: ${String(card.type)}`);
    }
    const profile = this.map[card.type];
    const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
    const content = buildContent(card, profile, timestamp);
    if (this.doValidate) {
      const result = validateProfileContent(profile, content);
      if (!result.valid) {
        throw new Error(`card ${card.id} invalid: ${result.errors.join("; ")}`);
      }
    }

    const record = this.machine.commit({
      payload: {
        op: "upsert",
        resourceId: card.id,
        observedAt: timestamp,
        content,
      },
      profileId: profileIdFor(profile),
      locator: opts.locator ?? `awareness://card/${card.id}`,
      provenance: opts.provenance,
      deltaSalt: opts.deltaSalt,
      locatorSalt: opts.locatorSalt,
      provenanceSalt: opts.provenanceSalt,
    });
    const transition = {
      ...record,
      resourceId: card.id,
      profile,
      witness: record.witness as PrivateWitness,
    };
    this.transitions.push(transition);
    return transition;
  }

  ingestAll(cards: AwarenessCard[], opts: IngestOptions = {}): AwarenessTransition[] {
    return cards.map((card) => this.ingest(card, opts));
  }

  ingestEmbedding(input: EmbeddingInput, opts: IngestOptions = {}): AwarenessTransition {
    const content = {
      model: input.model,
      dim: input.dim,
      vector: input.vector,
      ...(input.metric !== undefined ? { metric: input.metric } : {}),
      ...(input.dtype !== undefined ? { dtype: input.dtype } : {}),
      ...(input.vectorUri !== undefined ? { vectorUri: input.vectorUri } : {}),
    };
    if (this.doValidate) {
      const result = validateProfileContent("EMBEDDING", content);
      if (!result.valid) throw new Error(`embedding ${input.id} invalid`);
    }
    const record = this.machine.commit({
      payload: {
        op: "upsert",
        resourceId: input.id,
        observedAt: opts.timestamp ?? Math.floor(Date.now() / 1000),
        content,
      },
      profileId: profileIdFor("EMBEDDING"),
      locator: opts.locator ?? input.vectorUri ?? `awareness://embedding/${input.id}`,
      provenance: opts.provenance,
      deltaSalt: opts.deltaSalt,
      locatorSalt: opts.locatorSalt,
      provenanceSalt: opts.provenanceSalt,
    });
    const transition = {
      ...record,
      resourceId: input.id,
      profile: "EMBEDDING" as const,
      witness: record.witness as PrivateWitness,
    };
    this.transitions.push(transition);
    return transition;
  }

  export(): readonly AwarenessTransition[] {
    return this.transitions;
  }

  exportDeltas(): readonly ExperienceDelta[] {
    return this.machine.deltas;
  }

  verify() {
    return this.machine.verify();
  }
}
