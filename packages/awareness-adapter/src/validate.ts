import type { AwarenessProfileName } from "./cardTypes.js";

export interface ProfileValidationResult {
  valid: boolean;
  errors: string[];
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Product-level validation. Profiles are intentionally outside the ERC core. */
export function validateProfileContent(
  profile: AwarenessProfileName,
  value: unknown,
): ProfileValidationResult {
  const content = object(value);
  if (!content) return { valid: false, errors: ["content must be an object"] };
  let valid = true;
  switch (profile) {
    case "TEXT":
      valid = typeof content.text === "string";
      break;
    case "POLICY":
      valid = typeof content.rule === "string" && typeof content.scope === "string";
      break;
    case "EPISODIC":
      valid = typeof content.event === "string" && Number.isInteger(content.occurredAt);
      break;
    case "EMBEDDING":
      valid =
        typeof content.model === "string" &&
        Number.isInteger(content.dim) &&
        Array.isArray(content.vector) &&
        content.vector.every((item) => typeof item === "number" && Number.isFinite(item));
      break;
    default:
      valid = Object.keys(content).length > 0;
  }
  return valid
    ? { valid: true, errors: [] }
    : { valid: false, errors: [`content does not satisfy Awareness ${profile} profile`] };
}
