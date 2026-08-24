import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { JsonValue } from "./types.js";

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function coerce(cell: string): JsonValue {
  if (cell === "") return null;
  if (cell === "true") return true;
  if (cell === "false") return false;
  if (/^-?\d+$/.test(cell)) return Number(cell);
  if (/^-?\d+\.\d+$/.test(cell)) return Number(cell);
  return cell;
}

export async function* readCsv(
  path: string,
): AsyncGenerator<{ line: number; value: Record<string, JsonValue> }> {
  const stream = createReadStream(path, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let line = 0;
  let headers: string[] | null = null;
  for await (const text of rl) {
    line += 1;
    if (!text.trim()) continue;
    const cells = splitCsvLine(text);
    if (!headers) {
      headers = cells.map((h, i) => h.trim() || `col_${i}`);
      continue;
    }
    const value: Record<string, JsonValue> = {};
    headers.forEach((name, i) => {
      value[name] = coerce(cells[i] ?? "");
    });
    yield { line, value };
  }
}
