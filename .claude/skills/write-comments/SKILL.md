---
name: write-comments
description: Write, review, or audit code comments. Use when adding JSDoc, reviewing whether comments are needed, removing AI-style or redundant comments, or enforcing the project comment standard.
---

## Purpose

Produce comments that belong in a professional codebase. The bar is simple: if a senior engineer would delete the comment on review, do not write it. If the code already communicates the fact, do not repeat it in prose.

---

## Rules

### 1. Only comment the WHY, never the WHAT

Code names describe what. Comments explain why — a hidden constraint, a non-obvious invariant, a workaround for a specific bug, or behavior that would surprise the reader. If removing the comment would not confuse anyone, do not write it.

**Do not write:**
```ts
// Convert the string to lowercase
const key = input.toLowerCase()

// Loop through all files
for (const file of files) {
```

**Write only when the reason is non-obvious:**
```ts
// oxc-resolver follows the real path, so we must canonicalise before storing.
absToRel.set(realpathSync(abs), rel)
```

---

### 2. No mid-code inline narration

Never add comments in the middle of a function body that explain steps, transitions, or control flow. A well-named function and well-named variables make those comments redundant.

**Never:**
```ts
// Step 1: validate input
if (!input) return

// Now build the result
const result = build(input)

// Return
return result
```

**No comment needed** — the code is self-explanatory.

---

### 3. JSDoc only on exported public API

Reserve `/** */` JSDoc for exported symbols: functions, classes, interfaces, and types that cross a module boundary and whose signature alone is insufficient. Do not write JSDoc on internal helpers, private members, or obvious wrappers.

When writing JSDoc:

- First line: one declarative sentence. No subject ("Returns…" not "This function returns…"). No hedging.
- `@param` only when the parameter's purpose or constraint is not clear from its type and name.
- `@returns` only when the return value's semantics are non-obvious.
- No `e.g.`, no `i.e.`, no `Note:`, no `See also:`.

**Do not write:**
```ts
/**
 * This function takes a file path and returns its contents.
 * @param path - The path to the file (e.g. "./config.json")
 * @returns The file contents as a string
 */
export function readFile(path: string): string
```

**Write:**
```ts
/** Read a file's contents, resolving symlinks before opening. */
export function readFile(path: string): string
```

---

### 4. Ownership — the definer documents, importers do not

A type, function, or constant is documented exactly once: in the file that defines it. Files that import it do not re-describe it. If a re-export needs a comment, the original definition is the right place.

**Never repeat across files:**
```ts
// In user.ts — correct location
/** A resolved user record, post-authentication. */
export interface User { ... }

// In handler.ts — wrong, delete this
/** A resolved user record, post-authentication. */
import type { User } from './user'
```

---

### 5. Forbidden markers and prose patterns

These patterns signal AI-generated or low-quality comments. Delete them on sight.

| Pattern | Reason |
|---------|--------|
| ` –` (em dash mid-sentence) | AI prose style |
| Parenthetical asides `(like this)` in comment text | Padding, adds no information |
| `e.g.`, `i.e.`, `Note:`, `Example:` | Prefer precision over hedged examples |
| `// TODO: remove this` / `// FIXME: temp` | Commit debt, not markers |
| `// This x -> y` transformation annotations | Narration, not documentation |
| Multi-line `/* */` blocks for non-JSDoc | Use `//` for inline, `/** */` for JSDoc |
| "we", "our", "this function", "this method" | Impersonal: drop the subject |

---

### 6. When to write nothing

These always need zero comments:

- A function whose name and signature are self-documenting (`sortByDate`, `isValid`, `toJSON`)
- Error handling that follows from the types (`if (!user) throw new NotFoundError()`)
- Simple delegation wrappers (`return inner.resolve(...)`)
- Constants whose names are definitions (`const MAX_RETRIES = 3`)
- Test helpers and fixture code

---

## Applying this skill

When asked to **add comments**: write only what passes all six rules above.

When asked to **review comments**: flag any comment that violates a rule and state which one. Do not rewrite unless asked.

When asked to **audit a file**: list every comment, mark each Keep / Delete / Rewrite, give the rule number for each deletion.

When asked to **remove AI comments**: delete everything matching rule 5's forbidden patterns, delete all mid-code narration (rule 2), delete all JSDoc on non-exported symbols (rule 3). Do not delete genuine invariant comments (rule 1).
