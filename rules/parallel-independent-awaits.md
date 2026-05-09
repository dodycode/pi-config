# Parallel Independent Awaits — Don't Sequential When You Don't Have To

When two or more `await` expressions don't depend on each other's results, run them in parallel with `await Promise.all([...])` (or `Promise.allSettled` if partial failures are acceptable).

## Rule

If you have multiple awaits in a row and:
- None of them needs the result of any earlier one in the chain, AND
- They don't share a database transaction (`db.transaction(async (tx) => { ... })`), AND
- They don't intentionally serialize for ordering / rate-limit reasons,

then the awaits MUST be parallelized with `Promise.all`.

## Anti-pattern

```ts
// BAD — three round-trips serialized for no reason
await redisClient.del(activeKey);
await redisClient.del(countKey);
await redisClient.del(progressKey);
```

## Anti-pattern variant — write left outside an existing `Promise.all`

```ts
// BAD — hincrby left sequential before a Promise.all
await redisClient.hincrby(progressKey, "leadsProcessed", 1);
await Promise.all([
  redisClient.expire(progressKey, TTL),
  redisClient.expire(syncKey, TTL),
]);
```

**Fix:** pull the leftover into the same `Promise.all`:
```ts
await Promise.all([
  redisClient.hincrby(progressKey, "leadsProcessed", 1),
  redisClient.expire(progressKey, TTL),
  redisClient.expire(syncKey, TTL),
]);
```

## Hard exclusions — keep sequential

- **Inside `db.transaction(async (tx) => ...)` callbacks.** Transactions are bound to a single connection; parallel awaits inside break isolation and risk deadlocks.
- **When op B genuinely needs op A's result.**
- **When a sequence is intentionally ordered for retry / rate-limit reasons.** Document with a 1-line comment.
- **When errors must be handled per-op with different recovery paths.** `Promise.all` rejects on the first failure.

## How to apply

When writing or reviewing a sequence of awaits, ask: *"does B depend on A's result?"* If no → wrap in `Promise.all`.

For mixed dependent/independent groups, split the chain at the dependency boundary:

```ts
const row = await db.query.lead.findFirst({ ... });
if (!row) return;

await Promise.all([
  notifyAdmin(row.orgId),
  redisClient.del(getSyncProgressKey(row.orgId)),
]);
```
