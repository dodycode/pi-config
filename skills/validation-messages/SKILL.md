---
name: validation-messages
description: Use when writing or reviewing Zod / validation schemas. Covers when to add user-facing error messages vs leaving default errors for debugging.
---

# Validation & Error Messages

There are two categories of validation. **Always determine which category a field belongs to before writing custom messages.**

## User-input validation (form fields, user-typed data)
- Fields: phone, email, company name, business number, addresses, etc.
- `.message("Please enter a valid phone number")` — specific, actionable, plain language
- Raw validation errors like "Expected number, received string" are unacceptable for end users.
- **Rule:** Would a user ever type this value directly? → Specific, actionable message.
- **Use `.superRefine()` for conditional field requirements** (e.g., "companyName required when isCompany is true").

## Don't add custom messages to (skip entirely)
- **System IDs and FK refs** (`companyId`, `leadId`, `orgId`, etc.) — code-generated, never user-typed. If validation fails, it's a code bug. The raw error in logs is more useful for debugging.
- **Pagination params** (`page`, `limit`, `cursor`) — code-controlled, users never see these errors.
- **Enum/tab selectors** — code-controlled. If validation fails, it's a code bug.
- **Sort/filter params** — same reason.
- **Webhook payloads, internal API params** — same as system IDs.
- **Rule:** If the field is not a user-facing form field, skip the custom message. The default error is more useful for debugging.
