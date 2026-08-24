import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { JsonValue } from "./types.js";
import { flattenRow, inferFromRows } from "./schema.js";
import { dominantKind } from "./schema.js";
import { readCsv } from "./csv.js";
import { readJsonl } from "./jsonl.js";

export type Format = "jsonl" | "csv";

export async function* rowsOf(
  path: string,
  format: Format,
): AsyncGenerator<{ line: number; value: Record<string, JsonValue> }> {
  if (format === "csv") {
    yield* readCsv(path);
    return;
  }
  for await (const { line, value } of readJsonl(path)) {
    yield { line, value: flattenRow(value) };
  }
}

export function detectFormat(path: string, explicit?: string): Format {
  if (explicit === "csv" || explicit === "jsonl") return explicit;
  return path.toLowerCase().endsWith(".csv") ? "csv" : "jsonl";
}

export async function infer(
  path: string,
  format: Format,
): Promise<ReturnType<typeof inferFromRows>> {
  const rows: Record<string, JsonValue>[] = [];
  for await (const { value } of rowsOf(path, format)) {
    rows.push(value);
  }
  return inferFromRows(rows);
}

export async function stats(
  path: string,
  format: Format,
): Promise<{
  rows: number;
  fields: number;
  schema: ReturnType<typeof inferFromRows>;
}> {
  const schema = await infer(path, format);
  return { rows: schema.rows, fields: schema.fields.length, schema };
}

export async function sample(
  path: string,
  format: Format,
  n: number,
  seed: number,
): Promise<Record<string, JsonValue>[]> {
  const reservoir: Record<string, JsonValue>[] = [];
  let i = 0;
  let state = seed >>> 0;
  const next = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for await (const { value } of rowsOf(path, format)) {
    i += 1;
    if (reservoir.length < n) {
      reservoir.push(value);
    } else {
      const j = Math.floor(next() * i);
      if (j < n) reservoir[j] = value;
    }
  }
  return reservoir;
}

export async function validate(
  path: string,
  format: Format,
  required: string[],
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  let rows = 0;
  for await (const { line, value } of rowsOf(path, format)) {
    rows += 1;
    for (const field of required) {
      if (value[field] === undefined || value[field] === null) {
        errors.push(`line ${line}: missing required field "${field}"`);
      }
    }
  }
  if (rows === 0) errors.push("no data rows found");
  return { ok: errors.length === 0, errors };
}

export async function dedupe(
  path: string,
  format: Format,
  keys: string[],
  outPath: string,
): Promise<{ kept: number; dropped: number }> {
  await mkdir(dirname(outPath) || ".", { recursive: true });
  const seen = new Set<string>();
  let kept = 0;
  let dropped = 0;
  const out = createWriteStream(outPath, { encoding: "utf8" });
  for await (const { value } of rowsOf(path, format)) {
    const payload =
      keys.length > 0
        ? JSON.stringify(keys.map((k) => value[k]))
        : JSON.stringify(value);
    const hash = createHash("sha256").update(payload).digest("hex");
    if (seen.has(hash)) {
      dropped += 1;
      continue;
    }
    seen.add(hash);
    kept += 1;
    out.write(`${JSON.stringify(value)}\n`);
  }
  await new Promise<void>((resolve, reject) => {
    out.end(() => resolve());
    out.on("error", reject);
  });
  return { kept, dropped };
}

export async function split(
  path: string,
  format: Format,
  ratio: number,
  trainPath: string,
  testPath: string,
  seed: number,
): Promise<{ train: number; test: number }> {
  await mkdir(dirname(trainPath) || ".", { recursive: true });
  await mkdir(dirname(testPath) || ".", { recursive: true });
  const train = createWriteStream(trainPath, { encoding: "utf8" });
  const test = createWriteStream(testPath, { encoding: "utf8" });
  let state = seed >>> 0;
  const next = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  let trainN = 0;
  let testN = 0;
  for await (const { value } of rowsOf(path, format)) {
    const line = `${JSON.stringify(value)}\n`;
    if (next() < ratio) {
      train.write(line);
      trainN += 1;
    } else {
      test.write(line);
      testN += 1;
    }
  }
  await Promise.all(
    [train, test].map(
      (s) =>
        new Promise<void>((resolve, reject) => {
          s.end(() => resolve());
          s.on("error", reject);
        }),
    ),
  );
  return { train: trainN, test: testN };
}

export function schemaTable(schema: ReturnType<typeof inferFromRows>): string {
  const header = ["field", "kind", "present", "missing", "min", "max"].join(
    "\t",
  );
  const body = schema.fields.map((f) =>
    [
      f.name,
      dominantKind(f),
      String(f.present),
      String(f.missing),
      f.min ?? "",
      f.max ?? "",
    ].join("\t"),
  );
  return [header, ...body].join("\n");
}
