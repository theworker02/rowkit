# Buyer evaluation â€” rowkit

## Goal

In 15â€“45 minutes, verify the Product builds or runs as documented and that proprietary notices are present.

## Steps

1. Confirm root `LICENSE` is proprietary and `ACQUISITION.md` exists.
2. Skim `README.md` install/run claims.
3. Execute:

```
```bash
npm install -g @magnexis/rowkit
# or
npx @magnexis/rowkit --help
```
```text
rowkit infer <file> [--format jsonl|csv] [--json] [-o schema.json]
rowkit stats <file>
rowkit sample <file> -n 50 --seed 7
rowkit validate <file> --require id,title
rowkit dedupe <file> --keys id -o unique.jsonl
rowkit split <file> --ratio 0.8 --train train.jsonl --test test.jsonl --seed 1
```
```text
field     kind     present  missing  min  max
id        integer  1200     0        1    1200
title     string   1194     6
score     number   1200     0        0    1
```
```json
{ "ok": false, "errors": ["line 12: missing required field \"title\""] }
```
```ts
import { infer, validate } from "@magnexis/rowkit";

const schema = await infer("events.jsonl", "jsonl");
const { ok } = await validate("events.jsonl", "jsonl", ["id"]);
```
```bash
git clone https://github.com/theworker02/rowkit.git
cd rowkit
npm install
npm test
npm run build
node dist/cli.js --help
```
```

4. Run tests if present (`npm test`, `pytest`, `cargo test`, `go test ./...`, etc.).
5. Record README vs observed behavior gaps in workpapers.

## Pass criteria

- [ ] Clone succeeds
- [ ] Documented happy path works **or** failure is explained
- [ ] Minimal path needs no surprise secrets
- [ ] License notices intact

*Updated: 2026-09-22*
