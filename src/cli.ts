#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { Command } from "commander";
import {
  dedupe,
  detectFormat,
  infer,
  sample,
  schemaTable,
  split,
  stats,
  validate,
} from "./pipeline.js";

const program = new Command();

program
  .name("rowkit")
  .description(
    "Streaming JSONL/CSV toolkit for schema inference, validation, sampling, splits, and dedupe.",
  )
  .version("1.0.0");

program
  .command("infer")
  .argument("<file>", "JSONL or CSV path")
  .option("-f, --format <fmt>", "jsonl | csv")
  .option("-o, --out <file>", "write JSON schema to this path")
  .option("--json", "print JSON instead of a table")
  .action(async (file: string, opts: { format?: string; out?: string; json?: boolean }) => {
    const schema = await infer(file, detectFormat(file, opts.format));
    if (opts.out) {
      await writeFile(opts.out, `${JSON.stringify(schema, null, 2)}\n`);
    }
    process.stdout.write(
      opts.json ? `${JSON.stringify(schema, null, 2)}\n` : `${schemaTable(schema)}\n`,
    );
  });

program
  .command("stats")
  .argument("<file>", "JSONL or CSV path")
  .option("-f, --format <fmt>", "jsonl | csv")
  .action(async (file: string, opts: { format?: string }) => {
    const result = await stats(file, detectFormat(file, opts.format));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("sample")
  .argument("<file>", "JSONL or CSV path")
  .option("-n, --count <n>", "rows to keep", "10")
  .option("--seed <n>", "RNG seed", "1")
  .option("-f, --format <fmt>", "jsonl | csv")
  .action(async (file: string, opts: { count: string; seed: string; format?: string }) => {
    const rows = await sample(
      file,
      detectFormat(file, opts.format),
      Number(opts.count),
      Number(opts.seed),
    );
    for (const row of rows) process.stdout.write(`${JSON.stringify(row)}\n`);
  });

program
  .command("validate")
  .argument("<file>", "JSONL or CSV path")
  .requiredOption("--require <fields>", "comma-separated required field names")
  .option("-f, --format <fmt>", "jsonl | csv")
  .action(async (file: string, opts: { require: string; format?: string }) => {
    const required = opts.require.split(",").map((s) => s.trim()).filter(Boolean);
    const result = await validate(file, detectFormat(file, opts.format), required);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 1;
  });

program
  .command("dedupe")
  .argument("<file>", "JSONL or CSV path")
  .option("--keys <fields>", "comma-separated key fields (default: whole row)")
  .requiredOption("-o, --out <file>", "output JSONL path")
  .option("-f, --format <fmt>", "jsonl | csv")
  .action(async (file: string, opts: { keys?: string; out: string; format?: string }) => {
    const keys = (opts.keys ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const result = await dedupe(file, detectFormat(file, opts.format), keys, opts.out);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("split")
  .argument("<file>", "JSONL or CSV path")
  .option("--ratio <n>", "train fraction 0-1", "0.8")
  .requiredOption("--train <file>", "train JSONL path")
  .requiredOption("--test <file>", "test JSONL path")
  .option("--seed <n>", "RNG seed", "1")
  .option("-f, --format <fmt>", "jsonl | csv")
  .action(
    async (
      file: string,
      opts: { ratio: string; train: string; test: string; seed: string; format?: string },
    ) => {
      const result = await split(
        file,
        detectFormat(file, opts.format),
        Number(opts.ratio),
        opts.train,
        opts.test,
        Number(opts.seed),
      );
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    },
  );

await program.parseAsync(process.argv);
