# AGENTS.md

**Working code only. Finish the job. Plausibility is not correctness.**

## 0. Non-negotiables
1. **Avoid flattery/filler.** Start with the answer.
2. **Disagree when wrong.** If user premise is false, say so.
3. **Never fabricate.** Don't guess paths, hashes, APIs. Check them.
4. **Stop when confused.** Ask if there's ambiguity.
5. **Touch only what you must.** No drive-by refactors.
6. **Strictly linear history.** Maintain strictly linear history (e.g., use rebase over merge).

## 1. Before writing code
- Read files before editing. Use subagents to explore if needed.
- State your plan concisely. Surface assumptions out loud.
- Match existing project patterns. Present tradeoffs for ambiguous tasks.

## 2. Writing code: simplicity first
- Minimal code. No extra features, abstractions, or "future proofing".
- Handle only realistic failures. Bias toward deleting code.
- Simplify overcomplicated diffs.

## 3. Surgical changes
- Change only what is requested. Match existing style exactly.
- Don't improve adjacent formatting/imports. Clean up only your orphans.

## 4. Goal-driven execution
- Define verifiable success criteria first (tests, scripts, benchmarks).
- Run verification, don't guess it works. Fix causes, not tests.

## 5. Tool use and verification
- Run tests, linters (`pnpm check`), and type checkers.
- Address root causes. Read entire stack traces. Verify UI visually.

## 6. Session hygiene
- Stop after 2 failed attempts; ask user to reset.
- Write descriptive commit messages.

## 7. Communication style
- Direct, concise. Short paragraphs. No unprompted structure/emoji.

## 8. When to ask vs. proceed
- **Ask:** Conflicting interpretations, load-bearing code, missing secrets.
- **Proceed:** Trivial tasks, readable ambiguity, previously answered questions.

## 9. Self-improvement loop
- Keep this file short. Prune unused rules.

## 10. Project context
### Stack
- Language/Runtime: TypeScript, Node >=24
- Framework(s): SwarmVault Workspace (CLI, Engine, Viewer, Obsidian plugin)
- Package manager: pnpm

### Commands
- Install: `pnpm install`
- Build: `pnpm build`
- Test: `pnpm test`
- Lint/Format/Typecheck: `pnpm check`

### Layout
- Source lives in: `packages/*` and `scripts/`
- Do not modify: `dist/`, `node_modules/` or generated build artifacts.

### Conventions specific to this repo
- Workspace scripts are defined in the root `package.json`.
- Testing leverages Node's native test runner or vitest.

## 11. Project Learnings
- Direct pushes to main are blocked.
- Development must happen on feature branches.
- Tasks must always conclude with a pull request to main.
