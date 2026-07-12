# Daily Porting Scope: providers/base.ts (BaseProviderAdapter structure)

## 1. Goal
Port the abstract base class and utility structures from `packages/engine/src/providers/base.ts` to `internal/providers/base.go`. This is a foundational file (Leaf Node, Depth 0) that provides the `BaseProvider` struct (which other Go provider implementations will embed) and handles common utility methods like capability tracking.
  - **Success Metrics:** The Go package `internal/providers` provides a `BaseProvider` struct with a `Capabilities` set (represented idiomatically as `map[types.ProviderCapability]struct{}`) and default implementations for the provider interface matching `BaseProviderAdapter`.
  - **Identified Pitfalls:** Go does not have abstract classes or inheritance, so we will use struct embedding (composition). We must port the default methods that return generic errors (`generateImage`, `embedTexts`, `transcribeAudio`) so that structs embedding `BaseProvider` get these default error returns. The JSON Schema stringification from Zod cannot be perfectly replicated in a simple Go base file without dependencies, so the Go translation of `generateStructured` should be structurally similar (taking a schema description string) or rely on `types.ProviderAdapter` method signatures.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/providers/base.ts`
- **Source Export(s):** `BaseProviderAdapter`
- **Target File:** `internal/providers/base.go`
- **Target Export:** `BaseProvider`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** N/A (This is an internal core structure, not exposed directly via CLI)
- **TS Delegation Call:** We won't bridge this abstract base class natively via CLI. This is a foundational port to unblock the rest of the `/providers` folder. Note: `PORTING_PROGRESS.json` tracks it as `subcommand: null`.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** `swarmvault-native/internal/types` for the `GenerationRequest`, `GenerationResponse`, `ImageGenerationRequest`, `ImageGenerationResponse`, `AudioTranscriptionRequest`, `AudioTranscriptionResponse` structs.
- **Go-to-Go Native Imports:** `swarmvault-native/internal/types`.
- **Transitive Blocks:** The file is small and has no internal TS dependencies other than types.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. `base.go` will be very short.
- **Function Limit:** Max 80 Lines of Code.
- **Nesting Limit:** Max 3 levels deep.

## 6. Parity Expectations
- Provides a Go struct that can be embedded by other Go providers to satisfy the `ProviderAdapter` interface.
- Returns explicit errors (instead of throwing) for unsupported methods like `EmbedTexts`, `GenerateImage`, and `TranscribeAudio`.
