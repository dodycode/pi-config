# Enum Usage

- **Never use string literals for values that have a defined enum/constant.** Always import and use the enum object (e.g., `StatusEnum.PENDING`, not `"PENDING"`). String literals bypass type safety and are invisible to refactoring tools.
- **When touching a file that has existing string literals for enum values, fix those too** — don't leave a mix of enum refs and string literals in the same file.
