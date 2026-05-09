# Writing Code for Other Devs (Reader-First Surface)

Every identifier, key, type signature, function shape, file layout, and abstraction you write will be read — over and over — by a teammate who has zero context on why you wrote it. Reader cost dominates writer cost over a codebase's lifetime. The rule: optimize for the next person reading this in 6 months, not the line you're typing now.

## 1. Top-level reader-first test

Read your identifier (or your design) in isolation, with nothing else open. Can a teammate who has never seen this file:

- Predict what kind of value/operation this represents?
- Predict how it differs from a sibling or pair?
- Predict where it lives / where to look for it?
- Predict whether it's the only source of truth for its concept, or whether it's coupled to a sibling?

If "no" to any → rename, collapse, or restructure.

## 2. Self-test before you ship a name (or a design)

Draft a one-sentence explanation that doesn't reference any other code. If the sentence requires "see also `X`" or "called by `Y`" or "paired with `Z`" to make sense — the name (or the design) is doing too little work.
