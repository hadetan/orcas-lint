## 1. Project tooling & config files

- [x] 1.1 Add `tsconfig.json` (strict, ESM, `moduleResolution: bundler`, target matching `node >=20`)
- [x] 1.2 Add `tsup.config.ts` with two entries — `src/index.ts` (library) and `src/cli/index.ts` (CLI) — emitting ESM + `.d.ts`, with `clean: true`
- [x] 1.3 Add `vitest.config.ts` (node environment, coverage via `@vitest/coverage-v8`)
- [x] 1.4 Add `.oxlintrc.json` and `.prettierrc` (+ `.prettierignore`)
- [x] 1.5 Add `.gitignore` (`node_modules`, `dist`, `coverage`, `.cache`)
- [x] 1.6 Add `LICENSE` (MIT) and confirm `package.json` `license`/`author`/repo URLs
- [x] 1.7 Add a README stub (name, one-liner, links to `docs/`)
- [x] 1.8 Verify `build`, `typecheck`, `lint`, `format:check`, `test` all run green on the empty skeleton

## 2. Core type contracts & constants

- [x] 2.1 Create `src/types/` with `Finding`, `Skip`, `SkipReason`, `Severity`, `Certainty`, `RuleId`, `AnalyzeOptions`, `AnalyzeResult`, `Stats`, `OrcasConfig`
- [x] 2.2 Create `src/constants/`: `messages.ts`, `limits.ts` (default budgets), `rule-ids.ts` (the 9 rule ids + meta)
- [x] 2.3 Verify `tsc --noEmit` passes with the contracts in place

## 3. Test harness & hermetic fixture-runner

- [x] 3.1 Create the `test/` tree mirroring `src/` (empty spec placeholders allowed)
- [x] 3.2 Implement a fixture-runner that loads a fixture `input` + co-located `expected` and asserts exact `findings` **and** `skips` equality
- [x] 3.3 Add one trivial scaffolding fixture + test proving the runner works (hermetic: references nothing outside itself)

## 4. Configuration subsystem (`src/config/`)

- [x] 4.1 Implement `defaults.ts` (default project globs, rule severities, budgets, reporter)
- [x] 4.2 Implement `schema.ts` + `defineConfig` (typed authoring + validation)
- [x] 4.3 Implement `load.ts` using `c12` (discover `orcas.config.{ts,js,mjs,json,yaml}`, merge over defaults, surface invalid config as a configuration error)
- [x] 4.4 Tests: zero-config defaults apply; config overrides defaults; `off` rule is silent; `ignore` glob excludes a file; malformed config → configuration error

## 5. Safety & loop budgets (`src/pod/budget.ts`)

- [x] 5.1 Implement budget primitives: interprocedural depth limit, per-file timeout, global wall-clock budget, and a reusable visited-set guard
- [x] 5.2 Tests: cyclic input terminates; exceeding the global budget yields a partial result (never hangs)

## 6. Hunter contract & registry (`src/hunters/`)

- [x] 6.1 Define `base.ts`: the Hunter contract (id, rule, certainty levels, `run(view, budget) → { findings, skips }`)
- [x] 6.2 Implement `registry.ts`: register / enable-disable / order / invoke uniformly
- [x] 6.3 Add a no-op test Hunter (test-only) and tests: empty registry → zero findings/skips; registered no-op → its outputs aggregated

## 7. Subsystem seams — interfaces + minimal no-op impls

- [x] 7.1 `src/sonar/`: interfaces for `parser`, `resolver`, `module-graph`, `symbols`, `entry-points`, `manifest`; minimal impl that does **real file discovery** (via `tinyglobby`) and no-op resolution/graph
- [x] 7.2 `src/atlas/`: interface shapes for `graph`, `node`, `edge`, `access-path` and `current/{escape,alias}`, with empty in-memory stores
- [x] 7.3 `src/den/`: cache interface with a pass-through (no caching) implementation
- [x] 7.4 Verify `tsc --noEmit` passes across all seams

## 8. Diagnostics & reporting (`src/echo/`, `src/surface/`)

- [x] 8.1 Implement `echo/`: skip-diagnostics collector + `skip-reasons.ts` (enumerated reasons)
- [x] 8.2 Implement `surface/pretty.ts` (grouped, "no issues found" summary) and `surface/json.ts` (stable `{findings, skips, stats}`)
- [x] 8.3 Tests: empty result renders cleanly; JSON parseable + complete; skips hidden by default; `--debug`/`debug:true` shows each skip with reason + location; uncertain item → skip, never a finding

## 9. Pipeline, programmatic API & CLI

- [x] 9.1 Implement `pod/pipeline.ts` + `pod/index.ts`: ordered stages (load config → discover files → parse/resolve → build graph seams → run registry → collect), returning an `AnalyzeResult`; honor budgets and mark partial results
- [x] 9.2 Implement `src/index.ts` exporting `analyze()`, `defineConfig`, and public types; `analyze()` drives the pipeline
- [x] 9.3 Implement `src/cli/args.ts` + `src/cli/index.ts` with `cac`: parse `--debug`, `--json`, `--reporter`, `--config`, `--no-cache`, `--trace-depth`, `--rule`, `--production`, `--max-time`; select reporter; set exit code (`0`/`1`/`2`)
- [x] 9.4 Add `bin/orcas.mjs` shim that loads the built CLI entry
- [x] 9.5 Tests: CLI result == API result; `--json` switches format; `--debug` surfaces skips; `--rule id=off` disables a rule; exit codes `0`/`1`/`2`; a smoke test executes the **built** CLI

## 10. Dogfood & CI wiring

- [x] 10.1 Verify `npm run selfcheck` builds and runs the binary against `./src` (reports nothing yet, exits cleanly)
- [x] 10.2 Add a minimal CI workflow running `build` → `typecheck` → `lint` → `test` → `selfcheck`

## 11. Validation gate

- [x] 11.1 Run `orcas` end-to-end and confirm it prints an empty/"no issues found" report and exits `0`
- [x] 11.2 Confirm `publint` is clean on the packed output (`npm run prepublishOnly` dry path)
- [x] 11.3 Run `openspec validate scaffold-engine-foundation` and confirm the change is consistent
