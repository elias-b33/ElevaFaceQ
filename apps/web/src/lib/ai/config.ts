"use client";

export type AiProviderKind = "none" | "ollama";
export interface AiConfig {
  provider: AiProviderKind;
  ollamaUrl: string;
  ollamaModel: string;
  ollamaTextModel: string;
}
const KEY = "faceiq.ai.v1";
export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: "none",
  ollamaUrl: "http://127.0.0.1:11434",
  ollamaModel: "gemma3:4b",
  ollamaTextModel: "gemma3:4b",
};

/** Public deployments never contact a visitor's local services. */
export function canUseLocalAi(hostname?: string): boolean {
  const host = hostname ?? (typeof window !== "undefined" ? window.location?.hostname : undefined);
  return process.env.NEXT_PUBLIC_HOSTED_EDITION !== "1" && (host === "localhost" || host === "127.0.0.1");
}

// Both the URL and model are checked again at the request boundary. Stored
// settings are untrusted, including backups and earlier cloud-provider configs.
export function localAiOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)
    || url.port !== "11434" || url.username || url.password
    || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Local AI must use http://127.0.0.1:11434 or http://localhost:11434.");
  }
  return url.origin;
}
export function localModelName(value: string): string {
  const model = value.trim();
  if (!model || model.length > 150 || /cloud|https?:|\/\//i.test(model)) {
    throw new Error("Choose an installed local model. Cloud model tags are disabled.");
  }
  return model;
}
function sanitize(value: Partial<AiConfig>): AiConfig {
  const config: AiConfig = {
    provider: value.provider === "ollama" ? "ollama" : "none",
    ollamaUrl: localAiOrigin(value.ollamaUrl ?? DEFAULT_AI_CONFIG.ollamaUrl),
    ollamaModel: localModelName(value.ollamaModel ?? DEFAULT_AI_CONFIG.ollamaModel),
    ollamaTextModel: localModelName(value.ollamaTextModel ?? DEFAULT_AI_CONFIG.ollamaTextModel),
  };
  return config;
}
export function loadAiConfig(): AiConfig {
  if (!canUseLocalAi()) return { ...DEFAULT_AI_CONFIG };
  try { return sanitize(JSON.parse(localStorage.getItem(KEY) ?? "{}")); }
  catch { return { ...DEFAULT_AI_CONFIG }; }
}
export function saveAiConfig(config: AiConfig): void {
  if (config.provider === "ollama" && !canUseLocalAi()) throw new Error("Local Ollama is available in a localhost installation. This hosted edition uses browser-based measurements.");
  localStorage.setItem(KEY, JSON.stringify(sanitize(config)));
}
