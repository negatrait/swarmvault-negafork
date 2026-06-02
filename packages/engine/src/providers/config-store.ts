import { defaultVaultConfig, initWorkspace, loadVaultConfig } from "../config.js";
import {
  type ProviderConfig,
  type ProviderConfigAddOptions,
  type ProviderConfigAddResult,
  type ProviderConfigEntry,
  type ProviderConfigRemoveOptions,
  type ProviderConfigRemoveResult,
  type ProviderTaskKey,
  providerCapabilitySchema,
  providerTypeSchema
} from "../types.js";
import { readJsonFile, writeJsonFile } from "../utils.js";

type RawVaultConfig = Record<string, unknown> & {
  providers?: Record<string, ProviderConfig>;
  tasks?: Partial<Record<ProviderTaskKey, string>>;
};

const PROVIDER_TASK_KEYS: ProviderTaskKey[] = [
  "compileProvider",
  "queryProvider",
  "lintProvider",
  "visionProvider",
  "imageProvider",
  "embeddingProvider",
  "audioProvider"
];

async function loadRawConfig(rootDir: string): Promise<{ configPath: string; raw: RawVaultConfig }> {
  await initWorkspace(rootDir);
  const { paths } = await loadVaultConfig(rootDir);
  const raw = (await readJsonFile<RawVaultConfig>(paths.configPath)) ?? (defaultVaultConfig() as unknown as RawVaultConfig);
  return { configPath: paths.configPath, raw };
}

function ensureProviders(raw: RawVaultConfig): Record<string, ProviderConfig> {
  if (!raw.providers || typeof raw.providers !== "object" || Array.isArray(raw.providers)) {
    raw.providers = {};
  }
  return raw.providers;
}

function ensureTasks(raw: RawVaultConfig): Partial<Record<ProviderTaskKey, string>> {
  if (!raw.tasks || typeof raw.tasks !== "object" || Array.isArray(raw.tasks)) {
    raw.tasks = {};
  }
  return raw.tasks;
}

function normalizeProvider(provider: ProviderConfig): ProviderConfig {
  providerTypeSchema.parse(provider.type);
  if (!provider.model.trim()) {
    throw new Error("Provider model cannot be empty.");
  }
  const rawProvider = provider as unknown as Record<string, unknown>;
  if (typeof rawProvider.apiKey === "string") {
    throw new Error("Provider configs must reference secrets through apiKeyEnv, not literal apiKey values.");
  }
  return JSON.parse(
    JSON.stringify({
      ...provider,
      model: provider.model.trim(),
      capabilities: provider.capabilities?.map((capability) => providerCapabilitySchema.parse(capability))
    })
  ) as ProviderConfig;
}

function assignedTasks(raw: RawVaultConfig, providerId: string): ProviderTaskKey[] {
  const tasks = ensureTasks(raw);
  return PROVIDER_TASK_KEYS.filter((taskKey) => tasks[taskKey] === providerId);
}

function toEntry(raw: RawVaultConfig, id: string, provider: ProviderConfig): ProviderConfigEntry {
  return {
    id,
    type: provider.type,
    model: provider.model,
    baseUrl: provider.baseUrl,
    apiKeyEnv: provider.apiKeyEnv,
    capabilities: provider.capabilities ?? [],
    assignedTasks: assignedTasks(raw, id),
    provider
  };
}

function assertTaskKeys(tasks: ProviderTaskKey[] | undefined): ProviderTaskKey[] {
  const requested = tasks ?? [];
  const valid = new Set(PROVIDER_TASK_KEYS);
  for (const task of requested) {
    if (!valid.has(task)) {
      throw new Error(`Unknown provider task ${String(task)}.`);
    }
  }
  return [...new Set(requested)];
}

export async function addProviderConfig(options: ProviderConfigAddOptions): Promise<ProviderConfigAddResult> {
  const { configPath, raw } = await loadRawConfig(options.rootDir);
  const providers = ensureProviders(raw);
  const tasks = ensureTasks(raw);
  const provider = normalizeProvider(options.provider);
  const existing = providers[options.providerId];
  const added = !existing;
  const updated = !added && JSON.stringify(existing) !== JSON.stringify(provider);
  providers[options.providerId] = provider;

  const updatedTasks = assertTaskKeys(options.tasks);
  for (const taskKey of updatedTasks) {
    tasks[taskKey] = options.providerId;
  }

  await writeJsonFile(configPath, raw);
  return {
    providerId: options.providerId,
    configPath,
    added,
    updated,
    updatedTasks
  };
}

export async function listProviderConfigEntries(rootDir: string): Promise<ProviderConfigEntry[]> {
  const { raw } = await loadRawConfig(rootDir);
  const providers = ensureProviders(raw);
  return Object.entries(providers)
    .map(([id, provider]) => toEntry(raw, id, provider))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function getProviderConfigEntry(rootDir: string, providerId: string): Promise<ProviderConfigEntry | null> {
  const { raw } = await loadRawConfig(rootDir);
  const providers = ensureProviders(raw);
  const provider = providers[providerId];
  return provider ? toEntry(raw, providerId, provider) : null;
}

export async function removeProviderConfig(options: ProviderConfigRemoveOptions): Promise<ProviderConfigRemoveResult> {
  const { configPath, raw } = await loadRawConfig(options.rootDir);
  const providers = ensureProviders(raw);
  const tasks = ensureTasks(raw);
  const removed = Boolean(providers[options.providerId]);
  delete providers[options.providerId];

  const fallbackProviderId =
    options.fallbackProviderId ?? (providers.local ? "local" : Object.keys(providers).sort((left, right) => left.localeCompare(right))[0]);
  const updatedTasks: ProviderTaskKey[] = [];
  for (const taskKey of PROVIDER_TASK_KEYS) {
    if (tasks[taskKey] === options.providerId) {
      if (!fallbackProviderId) {
        delete tasks[taskKey];
      } else {
        tasks[taskKey] = fallbackProviderId;
      }
      updatedTasks.push(taskKey);
    }
  }

  await writeJsonFile(configPath, raw);
  return {
    providerId: options.providerId,
    configPath,
    removed,
    updatedTasks
  };
}
