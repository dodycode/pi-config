# pnpm Timeout Rule

Enforce a 20-second timeout on all pnpm commands to prevent hanging processes.

## When to apply

Apply to EVERY bash call that runs:
- `pnpm`
- `pnpm install`
- `pnpm typecheck`
- `pnpm check`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- Any other pnpm script

## Rule

Always add `timeout: 20` parameter to every pnpm bash call.

## Example

❌ Wrong:
```typescript
bash({ command: "pnpm typecheck" })
```

✅ Correct:
```typescript
bash({ command: "pnpm typecheck", timeout: 20 })
```

## Why

- pnpm processes may appear to hang even after completion
- Long waits waste time without value
- 20 seconds is generous for typecheck, lint, and most operations
- If a command genuinely needs more time, user will re-run it manually

## Note

This rule overrides any default timeout behavior. Always use 20 seconds for pnpm.