import type { ProviderAdapter, ProviderCapability } from "../types.js";

/**
 * Canonical capability matrix for the OpenAI-compatible provider family.
 *
 * OpenAI-compatible implementations differ substantially in which endpoints
 * they support, how strict their structured-output adherence is, and whether
 * they can handle vision or audio tasks. This matrix records the community
 * consensus so downstream code can query support before issuing requests
 * instead of discovering the gap via a runtime error.
 *
 * Entries are normative defaults, not contractual guarantees — a user who
 * configures `capabilities: [...]` on a `ProviderConfig` always wins over
 * the defaults.
 */
export interface ProviderPresetCapability {
  readonly presetId: string;
  readonly apiStyle: "chat" | "responses";
  readonly capabilities: readonly ProviderCapability[];
  readonly notes: string;
}

export const OPENAI_COMPATIBLE_CAPABILITY_MATRIX: Readonly<Record<string, ProviderPresetCapability>> = Object.freeze({
  openai: {
    presetId: "openai",
    apiStyle: "responses",
    capabilities: ["responses", "chat", "structured", "tools", "vision", "embeddings", "streaming", "image_generation", "audio"],
    notes:
      "Reference implementation. Supports responses API, strict structured output, tool calling, vision, image generation, and Whisper transcription."
  },
  "openai-compatible": {
    presetId: "openai-compatible",
    apiStyle: "responses",
    capabilities: ["chat", "structured", "embeddings", "audio"],
    notes: "Generic fallback for self-hosted backends. Structured output adherence varies; verify capability flags per deployment."
  },
  openrouter: {
    presetId: "openrouter",
    apiStyle: "chat",
    capabilities: ["chat", "structured", "embeddings"],
    notes: "Router of upstream models. No responses API, no vision at the gateway level, structured output requires model-specific care."
  },
  groq: {
    presetId: "groq",
    apiStyle: "chat",
    capabilities: ["chat", "structured", "embeddings", "audio"],
    notes: "Fast chat completions, Whisper-compatible audio endpoint, no vision, no responses API."
  },
  together: {
    presetId: "together",
    apiStyle: "chat",
    capabilities: ["chat", "structured", "embeddings"],
    notes: "Chat completions with mixed structured-output reliability across hosted models. No vision or audio."
  },
  xai: {
    presetId: "xai",
    apiStyle: "chat",
    capabilities: ["chat", "structured", "embeddings"],
    notes: "Grok API. Chat and structured output; no vision or audio in the open surface."
  },
  cerebras: {
    presetId: "cerebras",
    apiStyle: "chat",
    capabilities: ["chat", "structured", "embeddings"],
    notes: "High-throughput inference. No vision, no audio, no image generation."
  },
  ollama: {
    presetId: "ollama",
    apiStyle: "chat",
    capabilities: ["chat", "structured", "tools", "vision", "embeddings", "streaming", "local", "audio"],
    notes: "Local-first. Capabilities depend on which models are installed; structured output is best-effort."
  }
});

export type OpenAiCompatiblePresetId = keyof typeof OPENAI_COMPATIBLE_CAPABILITY_MATRIX;

/**
 * Look up the canonical capability list for a known preset id. Returns `null`
 * when the preset is unknown (e.g., `custom` adapters) so callers can decide
 * whether to trust the adapter's declared capability set instead.
 */
export function lookupPresetCapabilities(presetId: string): ProviderPresetCapability | null {
  return OPENAI_COMPATIBLE_CAPABILITY_MATRIX[presetId] ?? null;
}

export type DegradeReason = "unsupported" | "unknown";

export interface DegradationOutcome<T> {
  readonly supported: boolean;
  readonly reason: DegradeReason | null;
  readonly value: T | null;
}

/**
 * Safe-degradation helper: if the provider advertises the requested
 * capability, run `run()`. Otherwise return the caller-supplied fallback
 * and explain why.
 *
 * This is intentionally a thin wrapper — the cost of misusing it is a
 * silent failure, so it forces the caller to supply an explicit fallback
 * and logs the reason so callers can surface a warning instead of
 * hallucinating a result.
 */
export async function withCapabilityFallback<T>(
  provider: Pick<ProviderAdapter, "capabilities" | "type">,
  capability: ProviderCapability,
  run: () => Promise<T>,
  fallback: () => T | Promise<T>
): Promise<DegradationOutcome<T>> {
  if (provider.capabilities.has(capability)) {
    return { supported: true, reason: null, value: await run() };
  }
  const fallbackValue = await fallback();
  return { supported: false, reason: "unsupported", value: fallbackValue };
}
