import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canUseLocalAi, DEFAULT_AI_CONFIG, loadAiConfig, localAiOrigin, localModelName } from "./config";
import { callVision } from "./providers";

beforeEach(() => { vi.stubGlobal("window", { location: { hostname: "127.0.0.1" } }); vi.stubEnv("NEXT_PUBLIC_HOSTED_EDITION", "0"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("local-only AI boundary", () => {
  it.each(["facelab.vercel.app", "facelab.example", "localhost.evil.example"])("blocks local-service requests from hosted origins: %s", async hostname => {
    vi.stubGlobal("window", { location: { hostname } });
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(canUseLocalAi()).toBe(false);
    expect(loadAiConfig().provider).toBe("none");
    await expect(callVision({ ...DEFAULT_AI_CONFIG, provider: "ollama" }, { system: "test", userText: "test", images: ["photo"], maxTokens: 10 })).rejects.toThrow("localhost installation");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps the Vercel edition isolated even when previewed on localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_HOSTED_EDITION", "1");
    expect(canUseLocalAi("127.0.0.1")).toBe(false);
  });
  it.each(["https://api.anthropic.com", "http://192.168.1.10:11434", "http://localhost.evil.example:11434", "http://127.0.0.1:11434/redirect", "http://user:password@localhost:11434", "http://localhost:3000", "http://localhost:11434?target=remote"])("rejects a remote or ambiguous service address: %s", value => {
    expect(() => localAiOrigin(value)).toThrow();
  });
  it("accepts only the two explicit loopback origins", () => {
    expect(localAiOrigin("http://localhost:11434/")).toBe("http://localhost:11434");
    expect(localAiOrigin("http://127.0.0.1:11434")).toBe("http://127.0.0.1:11434");
  });
  it.each(["qwen3:cloud", "some-cloud-model", "https://remote/model", ""])("blocks a cloud model or invalid tag: %s", value => expect(() => localModelName(value)).toThrow());
  it("makes no request while local AI is disabled", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(callVision(DEFAULT_AI_CONFIG, { system: "test", userText: "test", images: [], maxTokens: 10 })).rejects.toThrow("off");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects redirects and never attaches browser credentials to local AI calls", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ name: "gemma3:4b" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: { content: "local result" } }) });
    vi.stubGlobal("fetch", fetch);
    await callVision({ ...DEFAULT_AI_CONFIG, provider: "ollama" }, { system: "test", userText: "test", images: [], maxTokens: 10 });
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:11434/api/chat", expect.objectContaining({ redirect: "error", credentials: "omit" }));
  });
  it("does not send a photo to a locally named alias backed by a remote model", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ models: [{ name: "gemma3:4b", remote_host: "https://remote.example", remote_model: "cloud" }] }) });
    vi.stubGlobal("fetch", fetch);
    await expect(callVision({ ...DEFAULT_AI_CONFIG, provider: "ollama" }, { system: "test", userText: "test", images: ["photo"], maxTokens: 10 })).rejects.toThrow("cloud model");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
