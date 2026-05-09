# Preserve Existing Attributes When Adding New Ones

- **Never replace an element's existing attributes when adding new ones.** When adding `ref`, `id`, `data-*`, or any new prop to an element, preserve ALL existing attributes — especially `className`.
- `<div className="relative">` + adding ref → `<div ref={myRef} className="relative">`, NOT `<div ref={myRef}>`.
- Before editing a JSX element, read the full opening tag. After editing, verify no attributes were dropped.
