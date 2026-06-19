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
- Performance benchmarking: Use `cd packages/viewer && pnpm exec tsx benchmark.ts` to measure `embeddedGraphQuery` performance.

### Porting TypeScript to Go ("Structural Port")
- **Never swallow errors in the TS Bridge.** `try/catch` fallbacks to TS hide Go runtime panics in CI. If `USE_GO_PORT=true` is set, explicit failures must crash the process to surface issues.
- **Timestamp Parity:** Go structs parsing exact TS `generatedAt` strings usually fail differential testing due to millisecond discrepancies. Override the specific generated timestamps in the TS bridge wrapper locally to ensure tests check structural parity perfectly.
- **CI/CD Execution Validation:** A module ported to Go is useless if it's not tested in CI. Every module port MUST ensure that `go build` is run and that tests are run BOTH with and without `USE_GO_PORT=true` inside `.github/workflows/ci.yml` and `.github/workflows/live-smoke.yml`.
- **Install Script Reliability:** The app must be installable and runnable with `curl install.sh | bash` at all times. End-user binaries should be reliably built via Go (or precompiled binaries pulled) as part of this process. Never commit `swarmvault-native` binary files.

## 12. Code Volume & Complexity Restrictions (Hard Rules)

1. **File Lines of Code (LOC) Ceiling:**
   - **Soft Limit:** 200 Lines of Code (excluding tests and comments).
   - **Hard Limit:** 400 Lines of Code. Any file reaching 500 lines *must* be split into smaller, dedicated files within the same package directory (e.g., moving structures to `types.go`, helper utilities to `utils.go`, or splitting subcommands into individual files).

2. **Function Lines of Code (LOC) Ceiling:**
   - **Soft Limit:** 50 Lines of Code.
   - **Hard Limit:** 80 Lines of Code. If a function exceeds 80 lines, you must extract its internal blocks into private, testable helper functions (e.g., `func parseNode(...)` or `func processEdge(...)`).

3. **Cognitive & Cyclomatic Complexity Limits:**
   - **Maximum Cyclomatic Complexity:** 10 per function.
   - **Nesting Level Ceiling:** Avoid nesting loops and conditionals deeper than 3 levels (e.g., a `for` loop, containing an `if` statement, containing another `for` loop is your maximum). Use guard clauses and early returns (`return err` or `continue`) to keep the code flat.

4. **Package/File Composition Rules:**
   - **One CLI Subcommand per File:** Every CLI subcommand must live in its own isolated file under `internal/cmd/` (e.g., `internal/cmd/detect_communities.go`).
   - **One Primary Struct per File:** Core business logic files must only implement one primary data structure or concept. If multiple large structs are needed, split them into separate files within the same package.
   - **Zero Relative Import Overhead:** Remember that in Go, files in the same directory share package scope. Do not hesitate to split a file; you do not need to write imports to reference types or functions in the same package.