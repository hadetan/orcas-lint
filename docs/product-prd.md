# Orcas — Product PRD (Non-Technical)

> A plain-language description of *what* we are building and *why*. No code, no jargon.
> The companion [Technical PRD](./technical-prd.md) covers *how*.

---

## 1. What is Orcas?

Orcas is a free, open-source tool (an npm package) for JavaScript and TypeScript projects.
You run one command and it tells you about **code that produces a value nobody ever uses** —
so you can safely clean it up.

Most "dead code" tools only catch the obvious cases: a file you forgot to delete, a
dependency you no longer need, an import you no longer use. Orcas does all of that too, but it
goes **much deeper** — down to a single key inside a nested object, a value returned from a
function that the caller throws away, or a change you make to an array that nothing ever reads
back.

Think of it like this: a killer whale (an orca) uses echolocation to find prey hidden in
dark water. Orcas uses the same idea on your codebase — it sends out "pings" through every
connection in your code and finds the values that nothing is listening to.

---

## 2. The problem we're solving

As projects grow, they quietly fill up with code that does nothing useful:

- An object has 12 fields but only 7 are ever read. The other 5 are noise.
- A function returns a result, but somewhere a caller just ignores it.
- Someone adds an item to a list, then never looks at that list again.
- A helper file is still imported "just in case," but nothing actually calls it.

This dead weight is a real cost:

- **Confusion** — new developers waste time understanding code that doesn't matter.
- **Bugs** — people maintain, test, and "fix" things that were already useless.
- **Bloat** — bigger bundles, slower builds, more to read in every review.
- **Risk** — nobody dares delete it because they're not *sure* it's unused.

That last point is the key. People keep dead code because **they can't prove it's safe to
delete**. Orcas exists to give them that proof.

---

## 3. Who is it for?

- **App developers** (TypeScript or JavaScript) who want a cleaner codebase.
- **Library / package authors** who want to know which of their internal helpers are truly
  unused — while keeping their public API safe.
- **Open-source maintainers** drowning in years of accumulated code.
- **Teams** who want a check that runs in CI and flags new dead code in pull requests.

It works on a single project *or* a monorepo (a repository with many packages inside it).

---

## 4. What Orcas finds (the 9 capabilities, in plain English)

All nine ship in version 1. They split into two families: **reachability** (items 1–2 and
8–9 — *is this connected to the program at all?*) and **value-flow** (items 3–7 — *is the
value actually read?*). Each comes with a tiny example.

### 1. Dead imports
You import something but never use it.
```js
import { formatDate } from './utils'   // ← formatDate is never called
```

### 2. Exported but never used
You export something, but nothing anywhere imports it.
```js
export function helperNobodyCalls() { ... }   // ← dead across the whole project
```
*(For libraries, anything that's part of your public API is treated as "used" — see §6.)*

### 3–5. Unused keys inside nested objects and arrays
This is Orcas's signature feature — no popular tool does this today. Orcas looks *inside*
your data, even when objects and arrays are nested in each other.
```js
const users = [
  { id: 1, name: 'Ada', ssn: '...' },   // ← `ssn` is set on every user...
  { id: 2, name: 'Lin', ssn: '...' },
]
users.forEach(u => console.log(u.id, u.name))   // ...but nothing ever reads `ssn`
```
Orcas reports: *`ssn` is assigned but never read.*

### 6. Returned value that's thrown away
A function hands back a result and the caller ignores it.
```js
function computeTotal() { return a + b }   // pure: it only computes a value
computeTotal()                             // ← the result is dropped on the floor
```
Orcas is careful here: many functions are *meant* to be called for their side effect
(`array.push(x)`, `logger.log(x)`). Orcas will **not** nag about those — only about
"pure-looking" functions whose only point was the value you ignored.

### 7. A mutation nobody reads
You change a value, but nothing ever reads the changed result.
```js
const cart = []
cart.push(item)   // ← cart is never read again, so this change does nothing
```

### 8. Unused files
A file sits in your project but nothing ever imports it — directly or indirectly — starting
from your real entry points.
```js
// src/legacy/old-helpers.ts   ← not reached from any entry point, app, or config
```
Orcas reports the whole file as unused. (Anything reachable from your entry points, CLI, or
config files stays safe.)

### 9. Unused dependencies
A package is listed in your `package.json`, but your code never actually uses it.
```jsonc
// package.json
"dependencies": { "lodash": "^4", "left-pad": "^1" }   // ← nothing ever imports "left-pad"
```
Orcas also catches the **reverse** — an *unlisted* dependency: a package you import in code
but forgot to declare (a "works on my machine" bug waiting to happen).

> **The promise that sets Orcas apart here.** Finding unused files and packages is famously
> noisy — usage often hides inside config files or framework magic, and even the most popular
> tool's own docs treat *~40% false positives as "expected."* Orcas refuses that trade-off:
> it reads your config and entry points, and **when it can't be certain something is truly
> unused, it stays silent** (and shows the doubt under `--debug`). You may catch a little less
> than a noisier tool — but you can trust every single thing it flags.

---

## 5. How it's different from what exists today

| | ESLint | ts-prune | Knip | **Orcas** |
|---|:---:|:---:|:---:|:---:|
| Unused variables (in one file) | ✅ | – | ✅ | ✅ |
| Dead imports / exports (whole project) | – | ✅ | ✅ | ✅ |
| Unused files & dependencies | – | – | ✅ | ✅ *(conservative — see §4)* |
| **Unused keys in nested objects/arrays** | – | – | – | ✅ |
| **Discarded return values (smartly)** | partial/noisy | – | – | ✅ |
| **Mutations nobody reads** | – | – | – | ✅ |

The honest summary: **Knip already does imports, exports, files, and dependencies very
well.** Orcas covers that same ground so it can stand alone — but with a stricter,
certainty-first attitude (it would rather miss an unused file than wrongly flag a live one).
Its real reason to exist, though, is the deeper analysis — *property-level*, *return-value*,
and *mutation* dead code — which today is essentially an unsolved problem in everyday JS/TS
tooling. That deep layer is Orcas's identity; the rest is table stakes.

---

## 6. The principles that make Orcas trustworthy

These are promises, not nice-to-haves. They drive every design decision.

1. **It never touches your code.** Orcas only *reports*. It will never edit, delete, or
   "fix" your files. (Automatic fixing may come much later, and only opt-in.)

2. **Silent unless 100% certain.** JavaScript is a very dynamic language — sometimes it's
   genuinely impossible to prove a value is unused. By default, Orcas only reports findings
   it is *completely sure* about. If it isn't sure, it stays quiet. This means **when Orcas
   flags something, you can trust it.**

3. **Honest when asked.** Run with `--debug` (or turn it on in config) and Orcas opens up:
   it shows you everything it *skipped* and *why* ("I couldn't analyze `config` because it
   was sent over the network on line 40"). Nothing is hidden — it's just not noisy by
   default.

4. **Safe for libraries.** If you're building a package for others, your public API is meant
   to be used by people Orcas can't see. Orcas treats your public API (and CLI commands,
   config files, etc.) as "always used" so it never tells you to delete your own product.

5. **Fast and never runs away.** Orcas has strict built-in limits so it can't get stuck in
   an endless loop or crawl forever, even on large or circular code. It caches its work so
   the second run is quick.

---

## 7. How you use it

Install and run — one command:
```bash
npx orcas            # scan the current project, show only certain findings
npx orcas --debug    # also show what was skipped and why
npx orcas --json     # machine-readable output (for CI / dashboards)
```

Configure it like ESLint — a single, simple config file at the project root, with sensible
defaults so most people need almost no setup. You can turn individual checks on or off, set
which files to scan, and tell Orcas your entry points if it can't guess them.

In CI, Orcas exits with an error code if it finds dead code, so it can block or warn on pull
requests.

---

## 8. What Orcas is *not* (non-goals for v1)

Being clear about this keeps the project focused:

- **Not framework-magic-aware (yet).** Orcas understands standard entry points and config
  files, but it does **not** ship a large library of framework plugins in v1 the way some
  tools do. Where it can't see how a file or package is used, it stays silent rather than
  guess — so it may *under-report* unused files/deps until framework plugins land (roadmap).
- **Not a bundler or minifier.** We report dead code; we don't strip it from builds.
- **Not a code fixer (yet).** v1 is report-only by design.
- **Not a type checker or linter replacement.** Orcas does one job — finding unconsumed
  values — and aims to do it better than anyone.
- **Not an editor plugin (yet).** v1 is a command-line tool. Live/editor integration is on
  the roadmap, not in v1.

---

## 9. What success looks like

- A developer can run Orcas on a real project and **trust every default finding enough to
  delete it** without breaking anything.
- Orcas surfaces dead code that **no other tool catches** (the nested-property, return, and
  mutation cases).
- It runs comfortably on mid-to-large projects and monorepos in a reasonable time, and
  faster on repeat runs.
- Setup is so simple that most users run it with zero or near-zero configuration.
- For unused **files and dependencies**, Orcas's default findings carry **near-zero false
  positives** — the opposite of the "expect ~40% noise" industry norm — even if that means
  catching a little less.
- We hold ourselves to the same bar: **Orcas runs on its own codebase in CI** and must come
  back clean. (This is an internal engineering practice, not a feature you configure.)

---

## 10. Roadmap (after v1)

These are *deepenings of the same design*, not rewrites:

- Make the return-value and mutation checks smarter (catch more, still safely).
- Optional, explicitly opt-in auto-fix / codemods.
- Editor / watch mode for instant feedback while you type.
- A high-performance core (Rust) for very large repositories.
- **Framework & config plugins** — recognize framework entry points and config-referenced
  files/packages (Next.js, Vite, Jest, etc.) so Orcas can *safely* catch more unused files and
  dependencies, plus support Vue/Svelte single-file components.

---

*See the [Technical PRD](./technical-prd.md) for the architecture and the exact rules behind
each capability.*
