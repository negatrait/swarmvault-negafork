# Daily Porting Scope: chat.ts

## 1. Goal
The goal of this scope is to port the `packages/engine/src/chat.ts` module to Go. This module manages chat sessions, including creating, reading, listing, deleting, and asking questions within a session. The port will maintain exact structural parity and test correctness.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/chat.ts`
- **Source Export:** `listChatSessions`, `readChatSession`, `deleteChatSession`, `askChatSession`
- **Target File:** `internal/chat/chat.go`
- **Target Export:** `func ListChatSessions(...)`, `func ReadChatSession(...)`, `func DeleteChatSession(...)`, `func AskChatSession(...)`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native chat`
- **TS Delegation Call:** Update `packages/engine/src/chat.ts` to route execution through `child_process.spawnSync` to our native CLI if `process.env.USE_GO_PORT === 'true'`.

## 4. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 500 Lines of Code. Split structs to `types.go` or sub-functions to separate files if approaching this limit.
- **Function Limit:** Max 80 Lines of Code. Helper functions must be extracted if exceeded.
- **Nesting Limit:** Maximum of 3 levels deep. Use early exits and guard clauses.

## 5. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
