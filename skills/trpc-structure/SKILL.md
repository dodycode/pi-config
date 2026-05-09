---
name: trpc-structure
description: Use when adding or reviewing tRPC routers and handlers. Covers folder structure, thin handlers, and the shared operations layer pattern.
---

# API Router Structure

- **Never put all logic in a single router file.** When a router has more than 2-3 simple procedures, split it into a folder:
  - `router/<domain>/_router.ts` — imports and re-exports all handlers
  - `router/<domain>/<procedureName>.handler.ts` — one handler per file
  - `router/<domain>/<procedureName>.schema.ts` — validation schemas (optional, only if complex)
- **Handlers should be thin.** Validation + calling an operation function. Business logic lives in a shared operations layer — this keeps logic testable without needing a framework context.
- **Follow the existing pattern** in the project. Check how other routers are structured before adding new procedures.
