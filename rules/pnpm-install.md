# pnpm Install Rule

**NEVER run `pnpm install` silently.** If a task or workflow requires `pnpm install` (including via `new-worktree` or any skill):

1. Tell the user: "This requires `pnpm install` — it takes ~2-3 min on this monorepo. Confirm to proceed."
2. Wait for their "yes" before running.
3. Use `--prefer-offline` flag to speed it up when possible.