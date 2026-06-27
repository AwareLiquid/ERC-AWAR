// Canonical ERC-83xx memory categories.
// Numeric values MUST match the on-chain Solidity `enum MemoryType` ordering
// in SPEC §6, so the off-chain commitment preimage and the contract agree.

export const MEMORY_TYPES = [
  "TEXT",
  "EMBEDDING",
  "LATENT",
  "TOOL_TRACE",
  "EPISODIC",
  "POLICY",
  "SHARED_WORKING",
  "PROOF",
] as const;

export type MemoryTypeName = (typeof MEMORY_TYPES)[number];

const NAME_TO_CODE = new Map<MemoryTypeName, number>(
  MEMORY_TYPES.map((name, i) => [name, i]),
);

export function memoryTypeCode(name: MemoryTypeName): number {
  const code = NAME_TO_CODE.get(name);
  if (code === undefined) throw new Error(`unknown memory type: ${name}`);
  return code;
}

export function memoryTypeName(code: number): MemoryTypeName {
  const name = MEMORY_TYPES[code];
  if (name === undefined) throw new Error(`unknown memory type code: ${code}`);
  return name;
}

export function isMemoryTypeName(value: unknown): value is MemoryTypeName {
  return typeof value === "string" && NAME_TO_CODE.has(value as MemoryTypeName);
}
