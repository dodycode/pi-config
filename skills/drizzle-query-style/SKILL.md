---
name: drizzle-query-style
description: Use when writing or reviewing Drizzle ORM queries. Covers relational query API vs raw selects, column-only projections, and EXISTS subqueries.
---

# Database Query Style (Drizzle ORM)

When reading from a database-backed table with Drizzle ORM, default to the relational-query API (`db.query.<table>.findMany` / `findFirst`) instead of raw `db.select(...).from(...)`. This applies even when you only need one or two columns — the relational API supports column-only fetches via `columns: { col: true }`.

## Rule

If the read fits any of these shapes, use `db.query`:

- Single row by ID / primary key → `db.query.X.findFirst`
- Multiple rows by filter → `db.query.X.findMany`
- Column-only projection (no relations) → `db.query.X.findMany({ columns: { col: true } })`
- Row + nested children → `db.query.X.findMany({ with: { relation: { ... } } })`

Reach for raw `db.select(...).from(...)` only when:
- You need raw SQL projections (e.g. `sql` count(*), aggregations, GROUP BY)
- You need a JOIN shape the relational graph doesn't model
- You need it as a SUBQUERY inside `exists(...)` / `inArray(...)` / `notInArray(...)`

## The column-only trap

Junior pattern: "I only need `referenceId`, so I'll use `db.select` to keep it minimal."

```ts
// BAD — raw db.select for a single-column projection
const rows = await db
  .select({ referenceId: schema.appointment.referenceId })
  .from(schema.appointment)
  .where(...);
```

This bloats the file with top-level imports and repeats `schema.appointment.X` on every column reference.

```ts
// GOOD — db.query with columns projection
const rows = await db.query.appointment.findMany({
  columns: { referenceId: true },
  where: (table, { and, eq, isNull }) =>
    and(eq(table.orgId, orgId), isNull(table.deletedAt)),
});
```

## EXISTS subquery is required regardless of API choice

`db.query.X.findMany` does NOT filter the parent by relation existence. The `with: { relation: { where: ... } }` shape JOINs the relation — every parent row still comes back, with an empty array if no relation row matched.

To say "appointments where AT LEAST ONE assignee has userId in [list]", you need an EXISTS subquery either way.

```ts
where: (table, { and, eq, exists, inArray }) =>
  and(
    eq(table.orgId, orgId),
    exists(
      db
        .select()
        .from(schema.appointmentAssignee)
        .where(
          and(
            eq(schema.appointmentAssignee.appointmentId, table.id),
            inArray(schema.appointmentAssignee.userId, userIds),
          ),
        ),
    ),
  ),
```

## How to apply

1. **Writing a new query**: ask "is this a SELECT-from-one-table read?" → if yes, `db.query`. If no (raw SQL aggregates, complex joins) → `db.select`.
2. **Column-only fetches**: never use raw `db.select` when you can use `columns: { col: true }`.
3. **Filtering by relation existence**: reach for `exists(db.select().from(relation).where(...))` inside the `where:` callback. `with:` does NOT filter the parent.
