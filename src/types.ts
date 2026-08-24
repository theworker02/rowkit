export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type FieldKind =
  | "null"
  | "boolean"
  | "integer"
  | "number"
  | "string"
  | "array"
  | "object"
  | "mixed";

export interface FieldStat {
  name: string;
  kinds: Record<string, number>;
  present: number;
  missing: number;
  uniqueSample: string[];
  min?: number;
  max?: number;
}

export interface Schema {
  rows: number;
  fields: FieldStat[];
}

export function kindOf(value: JsonValue): FieldKind {
  if (value === null) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return "array";
  return "object";
}
