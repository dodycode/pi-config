---
name: figma-fidelity
description: Use when implementing UI from a Figma design. Covers exact fidelity requirements and anti-patterns like adding extra embellishments.
---

# Figma Design Fidelity

- **Never add UI elements not present in the Figma design.** No extra icons, colors, borders, badges, or embellishments. Match the design exactly.
- **Always verify against the Figma screenshot before writing UI code.** If the Figma shows plain text, use plain text. If it shows an icon, use that specific icon. Don't "improve" the design.
- **When Figma returns raw code, cross-reference with the screenshot.** The code is a reference, not final — but the visual structure (what's visible vs hidden) is the source of truth.
