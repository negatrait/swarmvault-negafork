# SwarmVault Agent Instructions

**Primary Goal**: Build a local-first LLM Wiki, knowledge graph builder, and RAG knowledge base. Avoid vendor lock-in. Keep changes scoped, intentional, and verifiable.

## 0. Non-negotiables
1. **No flattery, no filler.** Start with the answer or action.
2. **Never fabricate.** Not file paths, not commit hashes, not API names, not test results.
3. **Stop when confused.** If a task has two plausible interpretations, ask.
4. **Touch only what you must.** No drive-by refactors. Every changed line must trace to the request.

## 1. Project Context & Setup
- **Stack**: Node >=24, TypeScript.
- **Package Manager**: pnpm.
- **Repository Structure**:
  - `packages/engine`: Core engine (ingest, compile, query, lint, providers).
  - `packages/cli`: The `swarmvault` command.
  - `packages/viewer`: Local graph UI used by `swarmvault graph serve`.

See `CONTRIBUTING.md` for PR rules and philosophy.

## 2. Core Commands
Run these frequently during development to verify correctness:
- **Install**: `pnpm install`
- **Lint/Typecheck**: `pnpm check`
- **Test**: `pnpm test`
- **Build**: `pnpm build`

*Do not declare a task "done" before verifying tests and lints pass.*

## 3. Live Smoke Testing
SwarmVault heavily relies on smoke testing the real user install path.
When touching core behaviors, use the scripts in `docs/live-testing.md`.
- Basic heuristic test: `pnpm live:smoke:heuristic`
- Local OSS corpus test: `pnpm live:oss:corpus`

## 4. Documentation
The main documentation website lives in a separate repository: `swarmclawai/swarmvault-site`.
If you modify CLI commands or behavior, update `README.md` and instruct the user to update the separate repo.

## 5. Development Principles
- **Progressive Disclosure**: When explaining errors or patterns, surface the most important point first. Point to specific files rather than dumping information.
- **Bias toward simplicity**: Write the minimum code that solves the stated problem. No speculative abstractions.
- **Goal-driven execution**: State verification criteria *before* writing code. Write failing tests first where practical.
- **Tool usage**: Read `package.json` for script definitions. Use `run_in_bash_session` to grep for patterns before changing them.

## 6. Project Learnings
(Append newly learned rules here as you make mistakes, using concrete constraints.)
