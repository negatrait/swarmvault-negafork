# Daily Porting Scope: providers/openai-compatible-capabilities.ts

## 1. Goal
Port the `openai-compatible-capabilities.ts` leaf file to Go under `internal/providers/capabilities.go`. This file is purely data and simple logic regarding provider capabilities (length 88 lines, 0 TS imports besides types), fitting perfectly within the "Stateless Utility Bundle" slicing decision for files under 150 lines.

  - Success metric: the `internal/providers` Go package exposes an equivalent capability matrix and `LookupPresetCapabilities` function. `WithCapabilityFallback` will also be ported as a generic Go function `WithCapabilityFallback[T any]`.
  - Identified pitfalls: The TS `withCapabilityFallback` function uses a callback function, so we cannot easily bridge it across the JSON boundary using `runGoSidecar`. Since `openai-compatible-capabilities.ts` is only used internally by other unported TS provider files, we will port the code into Go natively so Go code can use it, and we will *remove* the `// TODO: Port` comment from the TS file to mark it as complete. We won't physically delete the TS file yet because the unported TS code still relies on it natively (Frankenstein TS Clean-Cut rule applies later).

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/providers/openai-compatible-capabilities.ts`
- **Source Export(s):** `OPENAI_COMPATIBLE_CAPABILITY_MATRIX`, `lookupPresetCapabilities`, `withCapabilityFallback`
- **Target File:** `internal/providers/capabilities.go`
- **Target Export:** `CapabilityMatrix`, `LookupPresetCapabilities`, `WithCapabilityFallback[T any]`
- **Target Types File:** `internal/types/providers.go`
- **Target Types Export:** `ProviderCapability`, `DegradeReason`, `DegradationOutcome[T]`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** None
- **TS Delegation Call:** We will leave the original TS file intact (except removing the `TODO: Port` line) since bridging higher order functions (callbacks) across a JSON boundary is impossible/unidiomatic without complex RPC. The TS code will continue to use the TS version until those TS modules are ported. Go code will import the new Go package `internal/providers` directly.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** `swarmvault-native/internal/types`. We will need to define `ProviderCapability` in `internal/types/providers.go`.
- **Go-to-Go Native Imports:** `swarmvault-native/internal/types`.
- **Transitive Blocks:** None, as this is a true leaf file. Stubbing is forbidden. All provider capability matrix mappings must be implemented fully in Go.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 lines of Go code.
- **Function Limit:** Max 80 lines of Go code per function.
- **Nesting Limit:** Max 3 levels deep.

## 6. Parity Expectations
- The Go data structure `CapabilityMatrix` must exactly match `OPENAI_COMPATIBLE_CAPABILITY_MATRIX`.
- The `ProviderCapability` enum must map exactly to TS.
