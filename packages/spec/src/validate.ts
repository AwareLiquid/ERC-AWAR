import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ValidateFunction } from "ajv";
import AjvModule from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { MEMORY_TYPES, type MemoryTypeName } from "./memoryType.js";

// ajv / ajv-formats ship CJS; normalize the default export across ESM interop.
// Typed as `any` here is deliberate interop glue — call-site safety comes from
// the `ValidateFunction` typing of the compiled validators below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ajv2020: any = (AjvModule as any).default ?? AjvModule;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addFormats: any = (addFormatsModule as any).default ?? addFormatsModule;

const SCHEMA_DIR = new URL("../schemas/", import.meta.url);

function loadSchema(rel: string): Record<string, unknown> {
  const path = fileURLToPath(new URL(rel, SCHEMA_DIR));
  return JSON.parse(readFileSync(path, "utf8"));
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const deltaValidator: ValidateFunction = ajv.compile(
  loadSchema("experience-delta.schema.json"),
);

const CATEGORY_FILES: Record<MemoryTypeName, string> = {
  TEXT: "text",
  EMBEDDING: "embedding",
  LATENT: "latent",
  TOOL_TRACE: "tool-trace",
  EPISODIC: "episodic",
  POLICY: "policy",
  SHARED_WORKING: "shared-working",
  PROOF: "proof",
};

const contentValidators = new Map<MemoryTypeName, ValidateFunction>(
  MEMORY_TYPES.map((name) => [
    name,
    ajv.compile(loadSchema(`memory-categories/${CATEGORY_FILES[name]}.schema.json`)),
  ]),
);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function format(validator: ValidateFunction): string[] {
  return (validator.errors ?? []).map(
    (e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`,
  );
}

/** Validate an Experience Delta record against the delta JSON Schema. */
export function validateDelta(delta: unknown): ValidationResult {
  const valid = deltaValidator(delta) as boolean;
  return { valid, errors: valid ? [] : format(deltaValidator) };
}

/** Validate a decrypted memory payload against its category schema. */
export function validateContent(
  memoryType: MemoryTypeName,
  content: unknown,
): ValidationResult {
  const validator = contentValidators.get(memoryType);
  if (!validator) throw new Error(`no schema for memory type: ${memoryType}`);
  const valid = validator(content) as boolean;
  return { valid, errors: valid ? [] : format(validator) };
}
