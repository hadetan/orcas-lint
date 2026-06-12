# Orcas — Documentation

> Find values that are never consumed in JavaScript & TypeScript projects.

This folder holds the two locked planning documents for Orcas. They are meant to be
stable references — decisions here are made deliberately so we don't churn the design
later.

| Document | Audience | What it covers |
|----------|----------|----------------|
| [Product PRD](./product-prd.md) | Everyone (non-technical) | What Orcas is, who it's for, the problem, the 9 capabilities in plain language, how it's different, principles, roadmap, non-goals. |
| [Technical PRD](./technical-prd.md) | Engineers / contributors | Architecture, module layout, the value graph, escape/alias analysis, per-tracker algorithms with v1 certainty boundaries, parser/resolver stack, caching, config schema, CLI, performance & safety budgets, testing & fixture architecture, and self-analysis (dogfooding). |

**Status:** Draft v0.1 · **Last updated:** 2026-06-12

## The one-sentence version

Orcas detects *anything a program produces but never reads* — dead imports/exports, unused
files, unused dependencies, untouched object/array keys (even deeply nested), discarded return
values, and mutations nobody observes — and reports them **without ever touching your source
code**, staying **silent unless it is 100% certain** (use `--debug` to see what it skipped and
why).
