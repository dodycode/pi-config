---
name: animations
description: Use when adding or reviewing UI animations in React. Covers when to use Tailwind animate-in vs Framer Motion, duration guidelines, and anti-patterns.
---

# UI Animation Patterns

## When to Use What

| Scenario | Use | Why |
|----------|-----|-----|
| Page/section mount | Tailwind `animate-in` | CSS-only, no JS overhead |
| Sidebar/panel entrance | Tailwind `animate-in` + `slide-in-from-*` | Directional, CSS-only |
| List items (static mount) | Framer Motion stagger | Needs per-item delay calculation |
| Conditional show/hide | Framer Motion AnimatePresence | Needs exit animation |
| Tab content switching | Framer Motion AnimatePresence `mode="wait"` | Needs exit-before-enter |
| Active indicator (tabs/pills) | Framer Motion `layoutId` | Smooth position interpolation |

## Patterns

### Pattern 1: Page/Section Fade-In (Tailwind)
```tsx
<div className="animate-in fade-in duration-300">
  {/* page content */}
</div>
```

### Pattern 2: Sidebar Slide-In (Tailwind)
```tsx
// Left sidebar
<div className="animate-in fade-in slide-in-from-left-2 duration-300">

// Right sidebar
<div className="animate-in fade-in slide-in-from-right-2 duration-300">
```

### Pattern 3: List Item Stagger (Framer Motion)
```tsx
import { motion } from "motion/react";

{items.map((item, idx) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.15, delay: Math.min(idx * 0.03, 0.3) }}
  >
    {/* item content */}
  </motion.div>
))}
```

### Pattern 4: Height Collapse (Framer Motion)
```tsx
import { AnimatePresence, motion } from "motion/react";

<AnimatePresence>
  {show && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      {/* collapsible content */}
    </motion.div>
  )}
</AnimatePresence>
```

### Pattern 5: Tab Cross-Fade (Framer Motion)
```tsx
import { AnimatePresence, motion } from "motion/react";

<AnimatePresence mode="wait">
  <motion.div
    key={activeTab}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
  >
    {activeTab === "overview" && <Overview />}
    {activeTab === "jobs" && <Jobs />}
  </motion.div>
</AnimatePresence>
```

### Pattern 6: Active Indicator (Framer Motion layoutId)
```tsx
import { motion } from "motion/react";

{tabs.map((tab) => (
  <button key={tab.id} className="relative">
    {tab.label}
    {activeTab === tab.id && (
      <motion.div
        layoutId="activeTab"
        className="absolute inset-0 bg-primary/10 rounded-lg"
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      />
    )}
  </button>
))}
```

## Duration Guidelines

| Type | Duration | Example |
|------|----------|---------|
| Micro-interaction | 100-150ms | Button press, tooltip, hover |
| UI transition | 200-300ms | Page fade, sidebar slide, tab switch |
| Stagger per item | 30ms delay | List items, chips, cards |
| Spring damping | 20-25 | Active indicators, layout shifts |
| Spring stiffness | 200-300 | Active indicators, layout shifts |

## Anti-Patterns

- **No bounce/elastic on form elements.** Forms should feel snappy, not playful.
- **No animation on data table rows.** Tables load too many rows — stagger makes them feel slow.
- **No animation on loading skeletons.** Skeletons already pulse (`animate-pulse`). Adding fade-in on top looks glitchy.
- **No animation on error/validation states.** Error messages should appear instantly so users notice them.
- **No `transition-all` on large containers.** It animates every CSS property including layout — use specific transitions (`transition-colors`, `transition-opacity`).
