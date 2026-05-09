---
name: session-memory
description: Use when the user asks about past sessions, project history, previous work, decisions made in prior conversations, or says phrases like "do you recall", "like the last time we", "remember when we", "what did we do about", "what happened with", or references prior work. Also use when the user says "save this to memory" or "remember this".
---

# Session Memory

All session memories live in `~/.pi/agent/memory/`.

> ⚠️ **CRITICAL — Use `~/.pi/agent/memory/`. Do NOT use `~/.agents/skills/`.**

## Read a Memory

1. Read `~/.pi/agent/memory/MEMORY.md` to find the relevant file.
2. Read that memory file from `~/.pi/agent/memory/<file>`.
3. Answer based only on what's in the file. Do not hallucinate.
4. If no matching file exists, say so and offer to create one.

## Save a Memory

1. Ask the user what to name the file (or suggest one).
2. Write it to `~/.pi/agent/memory/<name>.md`.
3. Read `~/.pi/agent/memory/MEMORY.md`. If it doesn't exist, create it with:
   ```markdown
   # Session Memory Index

   ## Available Memory Files

   | File | Topic |
   |------|-------|
   ```
4. Add the new entry to the table.
5. Confirm: *"Saved to `~/.pi/agent/memory/<name>.md`"*.
