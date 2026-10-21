"use client";

import { canUseLocalAi, localAiOrigin, localModelName, type AiConfig } from "./config";
export interface VisionRequest {
  system: string;
  userText: string;
  images: string[];
  maxTokens: number;
  preferTextModel?: boolean;
}

export async function callVision(config: AiConfig, request: VisionRequest): Promise<string> {
  if (config.provider !== "ollama") throw new Error("Local AI is off. The geometry report works without it.");
  if (!canUseLocalAi()) throw new Error("Local AI is available only in your localhost installation. The hosted geometry report works without it.");
  const origin = localAiOrigin(config.ollamaUrl);
  const model = localModelName(request.images.length === 0 && request.preferTextModel
    ? config.ollamaTextModel : config.ollamaModel);
  const installed = await installedLocalModels(origin);
  if (!installed.includes(model)) throw new Error("The selected model is not installed locally, or it points to a cloud model. Choose a local model in Settings.");
  const response = await fetch(`${origin}/api/chat`, {
    method: "POST", redirect: "error", credentials: "omit",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model, stream: false,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.userText, ...(request.images.length ? { images: request.images } : {}) },
      ],
      options: { temperature: 0, seed: 7, num_predict: request.maxTokens },
    }),
  });
  if (!response.ok) throw new Error(`Local Ollama returned HTTP ${response.status}. Check the model and connection in Settings.`);
  const json = await response.json() as { message?: { content?: string } };
  if (!json.message?.content) throw new Error("The local model returned an empty response.");
  return json.message.content;
}

export type OllamaPreflight =
  | { ok: true; visionModels: string[]; hasConfiguredModel: boolean }
  | { ok: false; problem: "unreachable" | "no-vision-model" | "http-error"; detail: string; fix: string };

async function installedLocalModels(origin: string): Promise<string[]> {
  const response = await fetch(`${origin}/api/tags`, {
    redirect: "error", credentials: "omit", signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Local Ollama returned HTTP ${response.status}.`);
  const data = await response.json() as { models?: Array<{ name: string; remote_host?: string; remote_model?: string }> };
  return (data.models ?? []).filter(model => typeof model.name === "string" && !model.remote_host && !model.remote_model && !/cloud/i.test(model.name)).map(model => model.name);
}

export async function preflightOllama(config: AiConfig): Promise<OllamaPreflight> {
  try {
    if (!canUseLocalAi()) throw new Error("Local Ollama is available only when running the app on localhost.");
    const origin = localAiOrigin(config.ollamaUrl);
    const names = await installedLocalModels(origin);
    const vision = names.filter(name => /vl|vision|llava|gemma3|gemma4|moondream|minicpm/i.test(name));
    if (!vision.length) return { ok: false, problem: "no-vision-model", detail: "No installed local vision model was found.", fix: "Optional: install a local vision model in Ollama. Facial measurements do not need one." };
    return { ok: true, visionModels: vision, hasConfiguredModel: names.includes(config.ollamaModel) };
  } catch (error) {
    return { ok: false, problem: "unreachable", detail: error instanceof Error ? error.message : "Local Ollama could not be reached.", fix: "Ollama is optional and is not installed by this app. If you already use it, start it and allow http://127.0.0.1:3000 in OLLAMA_ORIGINS." };
  }
}
