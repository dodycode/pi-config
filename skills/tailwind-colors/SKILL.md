---
name: tailwind-colors
description: Use when writing or reviewing Tailwind CSS classes. Covers design tokens, no hardcoded colors, and arbitrary value rules.
---

# Tailwind CSS: No Hardcoded Colors

## Rule

NEVER use arbitrary hex, oklch, rgb, or hsl values in Tailwind classes:

```tsx
// ❌ BLOCKED — hardcoded color values
className="bg-[#2D87B9] text-[#6B7280] border-[#E5E7EB]"

// ✅ CORRECT — design tokens
className="bg-primary text-gray-500 border-gray-200"
className="bg-brand-500 text-muted-foreground border-border"
```

This applies to ALL color-related utilities: `bg-`, `text-`, `border-`, `ring-`, `shadow-`, `from-`, `to-`, `via-`, `fill-`, `stroke-`, `outline-`, `divide-`, `decoration-`, `accent-`, `caret-`, `placeholder-`.

## Why

- Projects define design tokens (CSS custom properties) mapped to Tailwind utilities via `@theme` blocks
- Hardcoded values bypass the token system, breaking dark mode, theming, and consistency
- Design tools return raw hex values — these must be mapped to the nearest project token

## How to Find Tokens

Before writing any color class, check the project's theme:

1. **Search for `@theme` blocks** in CSS files
2. **Check `variables/` or `tokens/` directories**
3. **Read the project's design system docs**

### Common Semantic Tokens (shadcn/ui pattern)

| Token | Usage |
|-------|-------|
| `primary` / `primary-foreground` | Brand actions, links |
| `secondary` / `secondary-foreground` | Secondary actions |
| `muted` / `muted-foreground` | Subdued backgrounds/text |
| `accent` / `accent-foreground` | Hover states, highlights |
| `destructive` / `destructive-foreground` | Errors, delete actions |
| `background` / `foreground` | Page bg/text |
| `card` / `card-foreground` | Card bg/text |
| `popover` / `popover-foreground` | Popover bg/text |
| `border` | Borders |
| `input` | Input borders |
| `ring` | Focus rings |

## Arbitrary Values

- **Never use arbitrary pixel values when an equivalent Tailwind class exists.** `text-[14px]` → `text-sm`, `w-[100%]` → `w-full`, etc.
- **Use rem only for font sizes, not for height/width/spacing.** `text-[13px]` → `text-[0.8125rem]`. For non-font arbitrary values, keep px: `h-[72px]`, `w-[480px]`.

## Exempt Files

Raw color values ARE legitimate in theme definition files: `variables/`, `tokens/` directories and files named `colors.css`, `tailwind.css`, `globals.css`, `theme.css`, `tokens.css`, `colors.ts`.
