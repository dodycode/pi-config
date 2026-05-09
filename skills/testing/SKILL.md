---
name: testing
description: Apply when writing, reviewing, or refactoring unit and integration tests. Covers test structure, naming conventions, and how to phrase assertions so they survive refactors.
---

# Testing Patterns

Rules for structuring, naming, and phrasing tests so they are readable, maintainable, and resilient to implementation changes.

## Structure `describe` blocks by helper/function, not by flow

Don't use flat `describe("run — some scenario")` blocks. Group tests under the helper they exercise:

```ts
// ✅ GOOD
describe("buildUpdateData", () => {
  it("preserves createdAt when updatedAt is provided", () => { ... });
});

// ❌ BAD
describe("run — update with existing createdAt", () => {
  it("works", () => { ... });
});
```

## Never mix concerns in a single `describe`

If a test exercises logic that lives in `buildInsertData`, it belongs under `describe("buildInsertData")`, not under a scenario-level `describe`.

## Test names describe what's verified AT THE LAYER the test runs at

Don't put higher-level context (feature flag, environment, role, version) in the test name when that context doesn't change the outcome at the test's layer.

```ts
// ✅ GOOD — the layer under test doesn't care about the flag
describe("filter by companyId only")

// ❌ BAD — misleading; the tool layer never reads the flag
describe("V2 + companyId only")
```

## Test names follow the same plain-English rule as identifiers

No math jargon (`intersection`, `union`), no abstract operators (`A ∩ B`), no version codes (`v1`, `v2`), no domain jargon.

```ts
// ✅ GOOD
describe("both forwarded")

// ❌ BAD
describe("both forwarded (intersection)")
```

## Test names describe the guarantee, not the mechanical behavior

Phrase the name as the **invariant** the code protects, not the technical action it performs.

```ts
// ✅ GOOD — survives refactor from `return event` to `return { ...event }`
describe("preserves original event time when allDay is false")

// ❌ BAD — breaks if implementation shape changes
describe("returns event unchanged when allDay is false")
```

**Why:** the guarantee outlives implementation changes. If `return event` later becomes `return { ...event }` (defensive copy) or `return cached`, the "preserves time" name still holds — but "returns unchanged" becomes a lie.

### Words to prefer

| Preferred | Avoid (implementation-shape verbs) |
|-----------|-----------------------------------|
| `preserves` | `returns` |
| `keeps` | `calls` |
| `respects` | `sets` |
| `enforces` | `throws` (unless throw IS the contract) |
| `forwards` | `emits` |
| `falls back to` | `defaults to` |

**How to apply:** before writing the test name, ask "what's the user-visible promise this test pins down?" — write that.
