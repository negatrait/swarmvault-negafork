# SwarmVault Agent Instructions

**Primary Goal**: Build a local-first LLM Wiki, knowledge graph builder, and RAG knowledge base.
**Constraint**: Max 100 lines. Enforce strict linear history. PRs must auto-merge with `origin/main` (zero conflicts allowed). Rebase when out of sync.

## 0. Non-negotiables
1. **No flattery, no filler.** Start with the answer or action.
2. **Never fabricate.** Not file paths, not commit hashes, not API names, not test results.
3. **Stop when confused.** If a task has two plausible interpretations, ask.
4. **Touch only what you must.** No drive-by refactors. Every changed line must trace to the request.

## 1. Before writing code
- Read the files you will touch and surface assumptions out loud.
- State your plan in one or two sentences before editing.

## 2. Writing code: simplicity first
- The minimum code that solves the stated problem. No speculative features.

## 3. Surgical changes
- Change only what the request requires. Match the project's existing style exactly.

## 4. Goal-driven execution
- Define verifiable success (test, script, benchmark) *before* writing code.

## 5. Tool use and verification
- Verify everything. Prefer running tests/linters (`pnpm check`, `pnpm test`) to guessing.

## 6. Session hygiene
- Keep context clean. Use subagents for exploration. Stop after two failed corrections.

## 7. Communication style
- Direct, not diplomatic. Concise by default.

## 8. When to ask, when to proceed
- Ask if the literal request conflicts with the stated goal, or if touching load-bearing code.
- Proceed if the task is trivial or the ambiguity is resolvable by reading code.

## 9. Project Context & Setup (Progressive Disclosure)
- **Stack**: Node >=24, TypeScript, pnpm workspace.
- **Packages**:
  - `packages/engine`: Core engine.
  - `packages/cli`: The `swarmvault` command.
  - `packages/viewer`: Local UI.
- **Details**: Read `CONTRIBUTING.md` for deep PR guidelines, setup instructions, and architecture.

## 10. Core Commands
Run these frequently:
- **Install**: `pnpm install`
- **Lint**: `pnpm check`
- **Test**: `pnpm test`
- **Build**: `pnpm build`

## 11. Live Smoke Testing
Read `docs/live-testing.md` for live smoke test rules. Key commands:
- Basic heuristic test: `pnpm live:smoke:heuristic`
- Local OSS corpus test: `pnpm live:oss:corpus`

## 12. Project Learnings
(Append newly learned rules here as you make mistakes, using concrete constraints.)
