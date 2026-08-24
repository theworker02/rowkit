import type { FieldKind, FieldStat, JsonValue, Schema } from "./types.js";
import { kindOf } from "./types.js";
import { flatten } from "./jsonl.js";

const SAMPLE_CAP = 8;

export function emptyStat(name: string): FieldStat {
  return {
    name,
    kinds: {},
    present: 0,
    missing: 0,
    uniqueSample: [],
  };
}

export function observe(stat: FieldStat, value: JsonValue | undefined): void {
  if (value === undefined) {
    stat.missing += 1;
    return;
  }
  stat.present += 1;
  const kind = kindOf(value);
  stat.kinds[kind] = (stat.kinds[kind] ?? 0) + 1;
  if (typeof value === "number") {
    stat.min = stat.min === undefined ? value : Math.min(stat.min, value);
    stat.max = stat.max === undefined ? value : Math.max(stat.max, value);
  }
  const rendered = JSON.stringify(value);
  if (
    stat.uniqueSample.length < SAMPLE_CAP &&
    !stat.uniqueSample.includes(rendered)
  ) {
    stat.uniqueSample.push(rendered);
  }
}

export function dominantKind(stat: FieldStat): FieldKind {
  const entries = Object.entries(stat.kinds).filter(([k]) => k !== "null");
  if (entries.length === 0) return "null";
  if (entries.length > 1) {
    const numeric = entries.every(([k]) => k === "integer" || k === "number");
    if (numeric) return "number";
    return "mixed";
  }
  return entries[0][0] as FieldKind;
}

export function inferFromRows(rows: Record<string, JsonValue>[]): Schema {
  const stats = new Map<string, FieldStat>();
  for (const row of rows) {
    const keys = new Set([...stats.keys(), ...Object.keys(row)]);
    for (const key of keys) {
      const stat = stats.get(key) ?? emptyStat(key);
      observe(stat, row[key]);
      stats.set(key, stat);
    }
  }
  return { rows: rows.length, fields: [...stats.values()] };
}

export function flattenRow(value: JsonValue): Record<string, JsonValue> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return flatten(value);
  }
  return { value };
}
