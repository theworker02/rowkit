import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { JsonValue } from "./types.js";

export async function* readJsonl(
  path: string,
): AsyncGenerator<{ line: number; value: JsonValue }> {
  const stream = createReadStream(path, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let line = 0;
  for await (const text of rl) {
    line += 1;
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    try {
      yield { line, value: JSON.parse(trimmed) as JsonValue };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid JSON on line ${line}: ${reason}`);
    }
  }
}

export function flatten(
  value: JsonValue,
  prefix = "",
): Record<string, JsonValue> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? { [prefix]: value } : {};
  }
  const out: Record<string, JsonValue> = {};
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    Object.assign(out, flatten(child as JsonValue, next));
  }
  return out;
}
