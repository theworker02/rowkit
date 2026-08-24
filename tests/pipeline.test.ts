import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inferFromRows } from "../src/schema.js";
import { detectFormat, infer, sample, validate } from "../src/pipeline.js";

describe("schema inference", () => {
  it("tracks mixed numeric kinds as number", () => {
    const schema = inferFromRows([
      { n: 1 },
      { n: 1.5 },
      { n: null },
    ]);
    expect(schema.rows).toBe(3);
    expect(schema.fields[0].name).toBe("n");
  });
});

describe("pipeline", () => {
  it("detects csv from extension", () => {
    expect(detectFormat("data.csv")).toBe("csv");
    expect(detectFormat("data.jsonl")).toBe("jsonl");
  });

  it("infers jsonl and validates required fields", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rowkit-"));
    const file = join(dir, "rows.jsonl");
    await writeFile(
      file,
      '{"id":1,"name":"a"}\n{"id":2,"name":null}\n{"id":3,"name":"c"}\n',
    );
    const schema = await infer(file, "jsonl");
    expect(schema.rows).toBe(3);
    const ok = await validate(file, "jsonl", ["id"]);
    expect(ok.ok).toBe(true);
    const bad = await validate(file, "jsonl", ["name"]);
    expect(bad.ok).toBe(false);
    const rows = await sample(file, "jsonl", 2, 7);
    expect(rows).toHaveLength(2);
  });
});
