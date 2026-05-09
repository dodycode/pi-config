# Name Magic Numbers — Don't Force Readers to Know the Convention

When code compares against a literal value that carries non-obvious meaning, extract it to a named const.

## Rule

If you see (or are about to write) a comparison like `if (x === -2)` or `if (status === 418)` or `if (flags & 0x80)`, ask: **does the literal carry meaning a reader has to look up?** If yes → extract to a named const.

## Anti-pattern

```ts
const result = await redisClient.eval(script, [key], []) as number;
return result === -2 ? null : result;  // why -2?
```

## Fix

```ts
const COUNTER_GONE_SIGNAL = -2; // matches Redis's own "key not found" convention

const result = await redisClient.eval(script, [key], []) as number;
return result === COUNTER_GONE_SIGNAL ? null : result;
```

## When NOT to apply

- True math constants: `0`, `1`, `-1` for empty / first / last when context is obvious.
- Loop indices and array indices in tight scopes.
- One-off coordinates: `width / 2`, `padding * 4`.
- Test data values where the value itself IS the test fixture.

## How to apply

1. **Writing code:** when reaching for a literal in a comparison, ask "does this number CARRY meaning beyond its numeric value?"
2. **Naming convention:** SCREAMING_SNAKE_CASE. Name describes WHAT IT MEANS, not the value (`COUNTER_GONE_SIGNAL`, not `MINUS_TWO`).
3. **Scope:** local `const` if used once. Module-scope if reused. Named export if multi-file.
