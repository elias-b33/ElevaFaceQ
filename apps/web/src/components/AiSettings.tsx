"use client";

import { useEffect, useState } from "react";
import { canUseLocalAi, DEFAULT_AI_CONFIG, loadAiConfig, preflightOllama, saveAiConfig, type AiConfig, type OllamaPreflight } from "@/lib/ai";

export function AiSettings() {
  const [config, setConfig] = useState<AiConfig>(DEFAULT_AI_CONFIG);
  const [status, setStatus] = useState<OllamaPreflight | "testing" | null>(null);
  const [error, setError] = useState("");
  const [local, setLocal] = useState<boolean | null>(null);
  useEffect(() => { setConfig(loadAiConfig()); setLocal(canUseLocalAi()); }, []);
  const save = (next: AiConfig) => {
    setConfig(next);
    try { saveAiConfig(next); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Settings could not be saved."); }
  };
  return (
    <section className="card p-5 flex flex-col gap-4">
      <div><p className="label-caps">Optional local AI</p><p className="mt-2 text-sm text-ink-2 leading-relaxed">Your measurements and written explanations work without AI. If you already run Ollama, you can use a local model to review landmarks or expand a report. It cannot change the measured scores.</p></div>
      <div className="grid grid-cols-2 gap-2">{(["none", "ollama"] as const).map(provider => <button key={provider} disabled={provider === "ollama" && local !== true} onClick={() => save({ ...config, provider })} aria-pressed={config.provider === provider} className={`card py-3 text-sm ${config.provider === provider ? "border-gold/70 text-gold" : "text-ink-2"}`}>{provider === "none" ? "Off — geometry only" : "Local Ollama"}</button>)}</div>
      {local === false && <p className="text-xs text-ink-2">This hosted edition processes photos in your browser. Optional Ollama reports are available when you run your own copy on localhost.</p>}
      {config.provider === "ollama" && <>
        <label className="flex flex-col gap-2 text-xs text-ink-2">Local address<select value={config.ollamaUrl} onChange={event => save({ ...config, ollamaUrl: event.target.value })} className="rounded-chip border border-line bg-surface-raised px-3 py-2 text-sm"><option value="http://127.0.0.1:11434">127.0.0.1:11434</option><option value="http://localhost:11434">localhost:11434</option></select></label>
        <label className="flex flex-col gap-2 text-xs text-ink-2">Installed vision model<input value={config.ollamaModel} onChange={event => save({ ...config, ollamaModel: event.target.value })} spellCheck={false} className="rounded-chip border border-line bg-surface-raised px-3 py-2 text-sm"/></label>
        <label className="flex flex-col gap-2 text-xs text-ink-2">Installed text model<input value={config.ollamaTextModel} onChange={event => save({ ...config, ollamaTextModel: event.target.value })} spellCheck={false} className="rounded-chip border border-line bg-surface-raised px-3 py-2 text-sm"/></label>
        <button disabled={status === "testing" || !!error} onClick={async () => { setStatus("testing"); setStatus(await preflightOllama(config)); }} className="card py-3 text-sm text-gold">{status === "testing" ? "Checking this computer…" : "Check local connection"}</button>
        {status && status !== "testing" && <div className="card p-4 text-xs leading-relaxed" role="status">{status.ok ? <p className="text-gold">Connected. Local vision models: {status.visionModels.join(", ")}{!status.hasConfiguredModel && ". Choose one of these installed models above."}</p> : <><p className="text-work">{status.detail}</p><p className="mt-2 text-ink-2">{status.fix}</p></>}</div>}
      </>}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <p className="text-xs text-ink-3">Cloud providers, API keys, remote addresses and cloud model tags are disabled in this version. No AI software or models are installed automatically.</p>
    </section>
  );
}
