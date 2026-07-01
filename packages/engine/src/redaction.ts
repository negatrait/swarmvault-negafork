import { runGoSidecarSync } from "./subprocess.js";

export interface RedactionPattern {
  id: string;
  pattern: RegExp | string;
  placeholder?: string;
  description?: string;
}

export interface RedactionMatch {
  patternId: string;
  count: number;
}

export interface Redactor {
  redact(text: string): { text: string; matches: RedactionMatch[] };
}

const DEFAULT_PLACEHOLDER = "[REDACTED]";

/**
 * Built-in safety-by-default patterns. These cover common cloud, SaaS, and
 * cryptographic credentials that should never be captured verbatim into the
 * immutable `raw/` store or compiled wiki pages. Each pattern is expressed as
 * a named regex literal so readability is preserved when auditing what gets
 * scrubbed.
 */
export const DEFAULT_REDACTION_PATTERNS: RedactionPattern[] = [
  {
    id: "aws_access_key_id",
    pattern: /AKIA[0-9A-Z]{16}/g,
    description: "AWS Access Key ID"
  },
  {
    id: "aws_secret_access_key",
    // The secret itself (40 base64-ish characters) following the canonical
    // "aws_secret_access_key" label used in shared credentials files and env
    // declarations. We keep the label visible and only scrub the value.
    pattern: /(aws_secret_access_key["'\s:=]+)[A-Za-z0-9/+=]{40}/gi,
    description: "AWS Secret Access Key"
  },
  {
    id: "stripe_live_key",
    pattern: /sk_live_[0-9a-zA-Z]{24,}/g,
    description: "Stripe live secret key"
  },
  {
    id: "github_personal_access_token",
    pattern: /ghp_[A-Za-z0-9]{36}/g,
    description: "GitHub personal access token (classic)"
  },
  {
    id: "github_fine_grained_token",
    pattern: /github_pat_[A-Za-z0-9_]{82}/g,
    description: "GitHub fine-grained personal access token"
  },
  {
    id: "jwt",
    pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    description: "JSON Web Token"
  },
  {
    id: "authorization_bearer",
    // `Authorization: Bearer <token>` headers are a high-recall sink for
    // arbitrary credentials that don't match a specific format.
    pattern: /(Authorization:\s*Bearer\s+)[A-Za-z0-9._~+/=-]+/gi,
    description: "Authorization Bearer header token"
  },
  {
    id: "openai_api_key",
    pattern: /sk-[A-Za-z0-9]{32,}/g,
    description: "OpenAI-style API key"
  },
  {
    id: "private_key_block",
    // Catch the PEM headers for RSA, EC, OpenSSH, DSA, and generic private
    // keys. The body is usually very large; we redact the whole block from
    // the BEGIN header through the matching END marker.
    pattern:
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/g,
    description: "PEM private key block"
  }
];

function ensureGlobalRegExp(pattern: RegExp): RegExp {
  if (pattern.flags.includes("g")) {
    return pattern;
  }
  return new RegExp(pattern.source, `${pattern.flags}g`);
}

/**
 * Build a redactor from a list of patterns. Callers should construct this
 * once per ingest run and reuse it across prepared inputs so regex compilation
 * and global-flag normalization happen only once.
 */
export function buildRedactor(patterns: RedactionPattern[], defaultPlaceholder: string = DEFAULT_PLACEHOLDER): Redactor {
  const compiled = patterns.map((entry) => {
    const regex = entry.pattern instanceof RegExp ? ensureGlobalRegExp(entry.pattern) : null;
    return {
      id: entry.id,
      regex,
      raw: entry.pattern,
      placeholder: entry.placeholder ?? defaultPlaceholder
    };
  });

  return {
    redact(text: string) {
      if (!text || !compiled.length) {
        return { text, matches: [] };
      }
      let current = text;
      const matches: RedactionMatch[] = [];
      for (const entry of compiled) {
        const regex = entry.regex;
        if (!regex) {
          // Build-time validation already rejects non-regex patterns, but we
          // keep this guard so a buggy direct call can't crash the pipeline.
          continue;
        }
        let count = 0;
        current = current.replace(regex, (...args) => {
          count += 1;
          // The Bearer and aws_secret_access_key patterns use a capture group
          // to preserve the literal prefix (e.g. `Authorization: Bearer `)
          // so audit output and log text remain readable after redaction.
          // `String.replace` passes captures as positional arguments starting
          // at index 1; the last two entries are offset and whole string.
          const prefix = typeof args[1] === "string" ? args[1] : undefined;
          if (prefix) {
            return `${prefix}${entry.placeholder}`;
          }
          return entry.placeholder;
        });
        if (count > 0) {
          matches.push({ patternId: entry.id, count });
        }
      }
      return { text: current, matches };
    }
  };
}

export interface ConfiguredRedactionPattern {
  id: string;
  pattern: string;
  flags?: string;
  placeholder?: string;
  description?: string;
}

export interface RedactionConfig {
  enabled?: boolean;
  placeholder?: string;
  useDefaults?: boolean;
  patterns?: ConfiguredRedactionPattern[];
}

/**
 * Compile a possibly-absent `redaction` config block into a concrete
 * pattern list. Missing config means "enabled with defaults" — this is
 * safety-by-default so a fresh 0.9.0 vault upgrades without silently losing
 * redaction coverage.
 *
 * Invalid user-supplied regex sources throw eagerly with a helpful message
 * so the failure is surfaced at ingest start instead of silently skipped.
 */
export function resolveRedactionPatterns(config?: RedactionConfig | null): {
  enabled: boolean;
  placeholder: string;
  patterns: RedactionPattern[];
} {
  if (process.env.USE_GO_PORT === "true") {
    // Note: The Go side returns plain string patterns. We must convert them to RegExp
    // objects with the "g" flag, exactly matching legacy logic, so the caller receives the expected types.
    type GoResult = {
      enabled: boolean;
      placeholder: string;
      patterns: { id: string; pattern: string; placeholder?: string; description?: string; flags?: string }[];
    };
    const goResult = runGoSidecarSync<GoResult>("redaction", {
      action: "resolveRedactionPatterns",
      args: [config ?? null]
    });
    const parsedPatterns: RedactionPattern[] = goResult.patterns.map((entry) => {
      let regex: RegExp;
      try {
        regex = new RegExp(entry.pattern, entry.flags ?? "g");
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid redaction pattern \`${entry.id}\`: ${reason}`);
      }
      return {
        id: entry.id,
        pattern: regex,
        placeholder: entry.placeholder,
        description: entry.description
      };
    });
    return {
      enabled: goResult.enabled,
      placeholder: goResult.placeholder,
      patterns: parsedPatterns
    };
  }

  const enabled = config?.enabled ?? true;
  const placeholder = config?.placeholder ?? DEFAULT_PLACEHOLDER;
  const useDefaults = config?.useDefaults ?? true;

  if (!enabled) {
    return { enabled: false, placeholder, patterns: [] };
  }

  const patterns: RedactionPattern[] = [];
  if (useDefaults) {
    patterns.push(...DEFAULT_REDACTION_PATTERNS);
  }
  for (const entry of config?.patterns ?? []) {
    const flags = entry.flags ?? "g";
    let regex: RegExp;
    try {
      regex = new RegExp(entry.pattern, flags);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid redaction pattern \`${entry.id}\`: ${reason}`);
    }
    patterns.push({
      id: entry.id,
      pattern: regex,
      placeholder: entry.placeholder,
      description: entry.description
    });
  }

  return { enabled, placeholder, patterns };
}

/**
 * Convenience helper used by the ingest pipeline: build the redactor once
 * from config, or return `null` if redaction is disabled. Returning `null`
 * makes the caller's fast-path trivial (skip bytes/string work entirely).
 */
export function buildConfiguredRedactor(config?: RedactionConfig | null): Redactor | null {
  const resolved = resolveRedactionPatterns(config);
  if (!resolved.enabled || !resolved.patterns.length) {
    return null;
  }
  return buildRedactor(resolved.patterns, resolved.placeholder);
}
