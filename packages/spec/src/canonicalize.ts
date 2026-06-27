// Deterministic canonical serialization for ERC-83xx commitment preimages.
//
// This is a JCS (RFC 8785) subset sufficient for delta metadata: objects with
// string / integer / boolean / null / array values. Object keys are sorted by
// UTF-16 code unit (JS default string sort, which matches RFC 8785), arrays
// preserve order, and strings use standard JSON escaping.
//
// Floats are intentionally rejected: RFC 8785 number canonicalization for
// non-integers is subtle, and ERC-83xx delta metadata only ever carries
// integers (timestamp, version, memoryType). Raw payloads that contain floats
// (e.g. embedding vectors) are committed as opaque bytes via the content
// commitment, never through this function.

export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

export function canonicalize(value: CanonicalValue): string {
  if (value === null) return "null";

  const t = typeof value;

  if (t === "boolean") return value ? "true" : "false";

  if (t === "number") {
    const n = value as number;
    if (!Number.isFinite(n)) throw new Error("canonicalize: non-finite number");
    if (!Number.isInteger(n)) {
      throw new Error(
        "canonicalize: only integers are allowed in ERC-83xx delta metadata",
      );
    }
    return String(n);
  }

  if (t === "string") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }

  if (t === "object") {
    const obj = value as { [key: string]: CanonicalValue };
    const keys = Object.keys(obj).sort();
    const parts = keys.map(
      (k) => JSON.stringify(k) + ":" + canonicalize(obj[k]),
    );
    return "{" + parts.join(",") + "}";
  }

  throw new Error(`canonicalize: unsupported type ${t}`);
}
