import { normalizeExperienceDelta } from "./delta.js";
import { ZERO32 } from "./hash.js";
import type { ExperienceDelta } from "./types.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const FIELDS = [
  "spaceId",
  "sequence",
  "prevStateRoot",
  "deltaCommitment",
  "provenanceCommitment",
  "profileId",
  "locatorCommitment",
] as const;

export function validateExperienceDelta(value: unknown): ValidationResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { valid: false, errors: ["delta must be an object"] };
  }
  const record = value as Record<string, unknown>;
  const unknown = Object.keys(record).filter(
    (key) => !(FIELDS as readonly string[]).includes(key),
  );
  const missing = FIELDS.filter((key) => !(key in record));
  const errors = [
    ...missing.map((key) => `missing ${key}`),
    ...unknown.map((key) => `unknown field ${key}`),
  ];
  if (errors.length > 0) return { valid: false, errors };

  try {
    const delta = normalizeExperienceDelta(record as unknown as ExperienceDelta);
    if (delta.deltaCommitment === ZERO32) {
      return { valid: false, errors: ["deltaCommitment must not be ZERO32"] };
    }
    if (delta.profileId === ZERO32) {
      return { valid: false, errors: ["profileId must not be ZERO32"] };
    }
    return { valid: true, errors: [] };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
