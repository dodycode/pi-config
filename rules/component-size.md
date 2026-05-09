# Component Size & Split Discipline

React component files over ~300 LoC are hard to read, hard to review, and almost always hide re-render and prop-drilling problems.

## Hard ceiling

- **300 LoC** per `.tsx` file with a top-level component export. Counted by `wc -l` including blank lines and imports.
- A parent/root component can exceed 300 by up to 50 LoC if further splitting would fragment a tightly-coupled cluster. Document the exemption in a JSDoc block on the component.

## Extraction triggers (any one of these)

- Render function (JSX + inline logic inside `return (...)`) > 80 LoC.
- Local React state + effects > 5 hooks in a single component.
- `useMemo` + `useCallback` count > 8 combined in a single component.
- A single `.map()` inside the render that emits ≥ 30 LoC of JSX per item — extract the item renderer.

## Strategy

- Render chunks ≥ 50 LoC with a clear semantic name → sub-component in a `_components/<feature>/` subfolder.
- State + effects + derived data ≥ 30 LoC that share a concern → custom hook in `_hooks/`.
- Hooks + sub-components form the composition layer; the parent ends up as orchestration.

## Prop-drilling ban (state-library-agnostic)

Sub-components MUST NOT accept props for anything available via the project's shared state store. This applies to **every** client-state mechanism (Zustand, Redux, Jotai, React Context, etc.).

The invariant: **state flows INTO a sub-component via its own subscription, never via a parent's prop**.

Exceptions (still fine as props):
- Event handlers (`onClick`, `onSubmit`, `onDrop`)
- Primitive identifiers (`itemId`, `dayKey`, `rowIndex`)
- Layout-only values that aren't store-owned

Never fine as props: color sets, user records, full list data, full map data, anything derived from the store.

## Re-render guards

- Every state subscription in a list-rendered sub-component uses a **slice-scoped equality function**.
- Sub-components rendered inside `.map()` are wrapped in `React.memo` with an explicit `displayName`.
- Sub-components key on a **stable identity primitive** — not on array index.
- No `useMemo` around primitive returns or identities React already stabilizes.
- No inline object/array literals passed as props — extract to a `useMemo` or to a module-level const.
- Callbacks passed down wrapped in `useCallback` at the declaration site, with deps = refs + primitives only.

## Verification checklist before merging a split

- `wc -l` on the parent + every new child file — all under 300 (or 350 with documented exemption).
- `grep` for prop names that should be store-sourced across extracted children — zero hits that aren't primitive identifiers.
- Every child subscribes to the store with an `equalityFn` when returning non-primitives.
- Every list-rendered child wrapped in `React.memo`.
- Dev-tools profiler shows re-renders stay scoped.
