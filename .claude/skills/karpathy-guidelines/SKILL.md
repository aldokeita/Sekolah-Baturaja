---
name: karpathy-guidelines
description: Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria.
license: MIT
---

# Karpathy Guidelines

Behavioral guidelines to reduce common LLM coding mistakes, derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## How this repo applies the four principles

Everything above is upstream text, unchanged. This section is local: it says how the
principles land on *this* codebase, where a generic instruction would otherwise be
ambiguous or unachievable.

**Principle 4 has no component test framework here.** `npm test` runs 277 unit tests over
`src/lib/*.test.js` only — pure functions, adapters, palette derivation. There is no
renderer, no component test, no end-to-end suite. So "write a failing test first" applies
only to work that lands in `src/lib/`. For everything else, the verifiable goal is the
validation chain this repo already uses, and it is not optional:

```
npm run lint  →  npm test  →  npm run build  →  observe it in the browser preview
```

The last step is the one that actually catches defects here. A field counts as done only
when it can be created, saved, edited, and survives a refresh — see CLAUDE.md.

**Principle 1 must not turn into a blocking question.** "If uncertain, ask" is right about
*surfacing* the uncertainty, not about stopping. In this repo: do every part that does not
depend on the answer, state the assumption you took, and ask at the point where the answer
would actually change the work. Stop with nothing delivered only when proceeding either way
would be unsafe or would waste the work.

**Principle 3 is already binding here, and stricter.** `docs/HANDOFF.md` records decisions
that look like defects but are deliberate — the `'pentashih'` role value, RLS policies that
do not gate live requests, the `supabase/` directory name, the white-on-gradient contrast
the owner chose to keep. Read the relevant HANDOFF section before "fixing" anything that
looks wrong, or Principle 3 gets violated in the name of Principle 2.

**Principle 2 has one carve-out: comments explaining a trap.** This codebase deliberately
carries comments that explain why a line is the way it is — which colour token was wrong
and why, which CSS rule silently overrides an inline style. Those are not bloat and the
"minimum code" rule does not authorise deleting them.

## Provenance

Upstream: <https://github.com/multica-ai/andrej-karpathy-skills> (MIT, author
`forrestchang`), installed from commit `2c60614` (2026-04-20). The four principles are verbatim
from `skills/karpathy-guidelines/SKILL.md` in that repo.

Installed as a project-scoped skill rather than merged as a git branch: the upstream repo
carries its own root `CLAUDE.md`, which would collide with this project's `CLAUDE.md`, plus
a `README`, `EXAMPLES.md`, and `.cursor/` rules that have nothing to do with the school
website. To take upstream changes, re-read that file and update this one by hand.
