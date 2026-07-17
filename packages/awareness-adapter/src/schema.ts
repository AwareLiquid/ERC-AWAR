import { keccak256Utf8 } from "@erc-awar/core";
import type { AwarenessProfileName } from "./cardTypes.js";

/**
 * Awareness-owned profile identifiers. These describe private payload semantics
 * without freezing the product taxonomy into Agent Memory State core.
 */
export const PROFILE_BASE = "https://awareness.market/profiles/memory";

const PROFILE_FILE: Record<AwarenessProfileName, string> = {
  TEXT: "text",
  EMBEDDING: "embedding",
  LATENT: "latent",
  TOOL_TRACE: "tool-trace",
  EPISODIC: "episodic",
  POLICY: "policy",
  SHARED_WORKING: "shared-working",
  PROOF: "proof",
};

/** Canonical profile URI for an Awareness payload family. */
export function profileUriFor(profile: AwarenessProfileName): string {
  return `${PROFILE_BASE}/${PROFILE_FILE[profile]}/v1`;
}

/**
 * Deterministic profile id: keccak256 of the canonical profile URI.
 */
export function profileIdFor(profile: AwarenessProfileName): string {
  return keccak256Utf8(profileUriFor(profile));
}
