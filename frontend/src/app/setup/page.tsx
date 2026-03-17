"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle, ChevronRight, Tv, HardDrive,
  Loader2, AlertCircle, Wifi, WifiOff, Download, SkipForward,
} from "lucide-react";

// ── AI Providers ─────────────────────────────────────────────────────────────

const AI_PROVIDERS = [
  { id: "anthropic", name: "Anthropic Claude", desc: "claude-opus-4-6, claude-sonnet", requiresKey: true, keyPlaceholder: "sk-ant-...", models: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"], defaultModel: "claude-opus-4-6" },
  { id: "openai",    name: "OpenAI",            desc: "GPT-4o, GPT-4 Turbo",           requiresKey: true, keyPlaceholder: "sk-...",     models: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],                      defaultModel: "gpt-4o" },
  { id: "deepseek",  name: "DeepSeek",           desc: "Cost-effective reasoning",      requiresKey: true, keyPlaceholder: "sk-...",     models: ["deepseek-chat", "deepseek-reasoner"],                            defaultModel: "deepseek-chat" },
  { id: "openrouter",name: "OpenRouter",         desc: "100+ models, one key",          requiresKey: true, keyPlaceholder: "sk-or-...", models: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "google/gemini-pro"], defaultModel: "anthropic/claude-3.5-sonnet" },
  { id: "ollama",    name: "Ollama",             desc: "Local — no API key needed",     requiresKey: false, urlPlaceholder: "http://localhost:11434", models: ["llama3.2", "llama3.1", "mistral", "codellama"], defaultModel: "llama3.2" },
  { id: "lmstudio", name: "LM Studio",           desc: "Local LM Studio server",        requiresKey: false, urlPlaceholder: "http://localhost:1234/v1", models: ["local-model"],                                defaultModel: "local-model" },
];

// ── Service cards ─────────────────────────────────────────────────────────────

type SvcState = {
  mode: "detecting" | "found" | "not_found" | "manual" | "installing" | "done" | "skipped";
  url: string;
  username: string;
  password: string;
  error: string;
  validating: boolean;
  connected: boolean;
};

const SVC_DEFS = [
  { id: "qbittorrent", label: "qBittorrent", desc: "Download client for torrents", needsCreds: true,  defaultUrl: "http://localhost:1116" },
  { id: "prowlarr",    label: "Prowlarr",    desc: "Indexer / search aggregator",   needsCreds: false, defaultUrl: "http://localhost:1118" },
  { id: "jellyfin",    label: "Jellyfin",    desc: "Media server & player",         needsCreds: false, defaultUrl: "http://localhost:1119" },
];

const STEPS = ["AI Provider", "Services", "Storage", "Done"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function Badge({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle size={10} /> Connected</span>
    : null;
}

function DiskBar({ pct }: { pct: number }) {
  const c = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-green-500";
  return <div className="w-full bg-dark-600 rounded-full h-1.5 mt-1"><div className={`${c} h-1.5 rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 0 — AI Provider
  const [provider, setProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [providerUrl, setProviderUrl] = useState("");
  const [model, setModel] = useState("claude-opus-4-6");

  // Step 1 — Services
  const [svcs, setSvcs] = useState<Record<string, SvcState>>(() =>
    Object.fromEntries(
      SVC_DEFS.map((s) => [s.id, { mode: "detecting", url: s.defaultUrl, username: "admin", password: "adminadmin", error: "", validating: false, connected: false }])
    )
  );

  // Step 2 — Storage
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [mediaRoot, setMediaRoot] = useState("/media");
  const [downloadsPath, setDownloadsPath] = useState("/downloads");
  const [tmdbKey, setTmdbKey] = useState("");

  const prov = AI_PROVIDERS.find((p) => p.id === provider)!;

  // ── Safe JSON fetch — never throws on non-JSON responses ──────────────────
  const safeJson = async (res: Response) => {
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { error: text.slice(0, 120) }; }
  };

  // ── Auto-detect all services when entering step 1 ──────────────────────────
  const detectAll = useCallback(async () => {
    for (const svc of SVC_DEFS) {
      setSvcs((prev) => ({ ...prev, [svc.id]: { ...prev[svc.id], mode: "detecting", error: "" } }));
      try {
        const res = await fetch(`/api/services/detect/${svc.id}`);
        const data = await safeJson(res);
        setSvcs((prev) => ({
          ...prev,
          [svc.id]: { ...prev[svc.id], mode: data.found ? "found" : "not_found", url: data.url || prev[svc.id].url },
        }));
      } catch {
        setSvcs((prev) => ({ ...prev, [svc.id]: { ...prev[svc.id], mode: "not_found" } }));
      }
    }
  }, []);

  useEffect(() => { if (step === 1) detectAll(); }, [step, detectAll]);
  useEffect(() => {
    if (step === 2) {
      fetch("/api/settings/storage").then((r) => r.json()).then((d) => {
        setStorageInfo(d);
        setMediaRoot(d.media_root || "/media");
        setDownloadsPath(d.downloads_path || "/downloads");
      }).catch(() => {});
    }
  }, [step]);

  // ── Service actions ────────────────────────────────────────────────────────

  const installSvc = async (id: string) => {
    setSvcs((p) => ({ ...p, [id]: { ...p[id], mode: "installing", error: "" } }));
    try {
      const res = await fetch(`/api/services/install/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.detail || data.error || "Install failed");
      setSvcs((p) => ({ ...p, [id]: { ...p[id], mode: "done", url: data.url, connected: true } }));
    } catch (e: any) {
      setSvcs((p) => ({ ...p, [id]: { ...p[id], mode: "not_found", error: e.message } }));
    }
  };

  const validateSvc = async (id: string) => {
    const s = svcs[id];
    setSvcs((p) => ({ ...p, [id]: { ...p[id], validating: true, error: "" } }));
    try {
      const res = await fetch(`/api/services/validate/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: s.url, username: s.username, password: s.password }),
      });
      const data = await safeJson(res);
      setSvcs((p) => ({ ...p, [id]: { ...p[id], validating: false, connected: !!data.connected, error: data.connected ? "" : (data.error || "Could not connect") } }));
    } catch (e: any) {
      setSvcs((p) => ({ ...p, [id]: { ...p[id], validating: false, error: e.message } }));
    }
  };

  const skipSvc = (id: string) =>
    setSvcs((p) => ({ ...p, [id]: { ...p[id], mode: "skipped", connected: false } }));

  const updateSvc = (id: string, patch: Partial<SvcState>) =>
    setSvcs((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  // ── Step savers ────────────────────────────────────────────────────────────

  const saveProvider = async () => {
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/settings/ai-provider", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, api_key: apiKey || undefined, model, base_url: providerUrl || undefined }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || "Failed to save"); }
      setStep(1);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const saveServices = async () => {
    setSaving(true); setError("");
    try {
      // Persist connected services
      for (const svc of SVC_DEFS) {
        const s = svcs[svc.id];
        if (s.mode === "skipped") continue;
        const updates: any = {};
        if (svc.id === "qbittorrent" && (s.connected || s.mode === "done"))
          updates.qbittorrent_url = s.url;
        if (svc.id === "prowlarr" && (s.connected || s.mode === "done"))
          updates.prowlarr_url = s.url;
        if (svc.id === "jellyfin" && (s.connected || s.mode === "done"))
          updates.jellyfin_url = s.url;
        if (Object.keys(updates).length) {
          await fetch("/api/settings/general", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });
        }
      }
      setStep(2);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const saveStorage = async () => {
    setSaving(true); setError("");
    try {
      await fetch("/api/settings/general", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_root: mediaRoot, downloads_path: downloadsPath, tmdb_api_key: tmdbKey || undefined }),
      });
      await fetch("/api/settings/complete-setup", { method: "POST" });
      setStep(3);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Tv size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Media Organizor</h1>
          <p className="text-slate-400 mt-1">AI-powered media management</p>
        </div>

        {/* Step bar */}
        <div className="flex items-center justify-center mb-8 gap-2 flex-wrap">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${i < step ? "bg-green-500 text-white" : i === step ? "bg-accent-500 text-white" : "bg-dark-700 text-slate-500"}`}>
                {i < step ? <CheckCircle size={16} /> : i + 1}
              </div>
              <span className={`text-sm ${i === step ? "text-white" : "text-slate-500"}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-dark-600 mx-1" />}
            </div>
          ))}
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6">

          {/* ═══ STEP 0: AI Provider ══════════════════════════════════════════ */}
          {step === 0 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Choose AI Provider</h2>
              <p className="text-slate-400 text-sm mb-5">Powers your media search assistant</p>

              <div className="grid grid-cols-1 gap-2 mb-5">
                {AI_PROVIDERS.map((p) => (
                  <button key={p.id} onClick={() => { setProvider(p.id); setModel(p.defaultModel); }}
                    className={`text-left p-3 rounded-xl border transition-all ${provider === p.id ? "border-accent-500 bg-accent-500/10" : "border-dark-600 hover:border-dark-500"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-white text-sm">{p.name}</span>
                        <span className="text-slate-500 text-xs ml-2">{p.desc}</span>
                      </div>
                      {provider === p.id && <CheckCircle size={18} className="text-accent-400 flex-shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {prov.requiresKey ? (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">API Key</label>
                    <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                      placeholder={prov.keyPlaceholder}
                      className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Server URL</label>
                    <input type="text" value={providerUrl} onChange={(e) => setProviderUrl(e.target.value)}
                      placeholder={(prov as any).urlPlaceholder}
                      className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Model</label>
                  <select value={model} onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500">
                    {prov.models.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
              <button onClick={saveProvider} disabled={saving || (prov.requiresKey && !apiKey)}
                className="w-full mt-5 bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <>Continue <ChevronRight size={18} /></>}
              </button>
            </div>
          )}

          {/* ═══ STEP 1: Services ════════════════════════════════════════════ */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Media Services</h2>
              <p className="text-slate-400 text-sm mb-5">
                We auto-detect what's already running. Skip anything you don't need.
              </p>

              <div className="space-y-4 mb-5">
                {SVC_DEFS.map((svc) => {
                  const s = svcs[svc.id];
                  return (
                    <div key={svc.id} className="border border-dark-600 rounded-xl p-4">
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-white font-medium text-sm">{svc.label}</p>
                          <p className="text-slate-500 text-xs">{svc.desc}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.connected && <Badge ok />}
                          {s.mode === "done" && !s.connected && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={10} />Installed</span>}
                          {s.mode === "skipped" && <span className="text-xs text-slate-500">Skipped</span>}
                        </div>
                      </div>

                      {/* Detecting spinner */}
                      {s.mode === "detecting" && (
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <Loader2 size={14} className="animate-spin" /> Checking if running…
                        </div>
                      )}

                      {/* Found — already running */}
                      {s.mode === "found" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-green-400 text-xs mb-2">
                            <Wifi size={12} /> Detected at {s.url}
                          </div>
                          <input type="text" value={s.url} onChange={(e) => updateSvc(svc.id, { url: e.target.value })}
                            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500" />
                          {svc.needsCreds && (
                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" placeholder="Username" value={s.username} onChange={(e) => updateSvc(svc.id, { username: e.target.value })}
                                className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500" />
                              <input type="password" placeholder="Password" value={s.password} onChange={(e) => updateSvc(svc.id, { password: e.target.value })}
                                className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500" />
                            </div>
                          )}
                          {s.error && <p className="text-red-400 text-xs">{s.error}</p>}
                          <div className="flex gap-2">
                            <button onClick={() => validateSvc(svc.id)} disabled={s.validating}
                              className="flex-1 bg-accent-500/20 hover:bg-accent-500/30 text-accent-400 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-1">
                              {s.validating ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
                              {s.connected ? "Re-test" : "Test connection"}
                            </button>
                            <button onClick={() => skipSvc(svc.id)} className="px-3 py-2 rounded-lg border border-dark-600 text-slate-400 hover:text-white text-sm transition-colors">
                              Skip
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Not found — offer install or manual URL */}
                      {s.mode === "not_found" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                            <WifiOff size={12} /> Not detected
                          </div>
                          {s.error && <p className="text-red-400 text-xs mb-2">{s.error}</p>}
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => installSvc(svc.id)}
                              className="bg-accent-500 hover:bg-accent-400 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1">
                              <Download size={14} /> Install with Docker
                            </button>
                            <button onClick={() => updateSvc(svc.id, { mode: "manual" })}
                              className="border border-dark-600 hover:border-dark-500 text-slate-400 hover:text-white py-2.5 rounded-lg text-sm transition-colors">
                              Enter URL manually
                            </button>
                          </div>
                          <button onClick={() => skipSvc(svc.id)} className="w-full flex items-center justify-center gap-1 text-slate-600 hover:text-slate-400 text-xs py-1 transition-colors">
                            <SkipForward size={12} /> Skip {svc.label}
                          </button>
                        </div>
                      )}

                      {/* Manual URL entry */}
                      {s.mode === "manual" && (
                        <div className="space-y-2">
                          <input type="text" value={s.url} onChange={(e) => updateSvc(svc.id, { url: e.target.value })}
                            placeholder={svc.defaultUrl}
                            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500" />
                          {svc.needsCreds && (
                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" placeholder="Username" value={s.username} onChange={(e) => updateSvc(svc.id, { username: e.target.value })}
                                className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500" />
                              <input type="password" placeholder="Password" value={s.password} onChange={(e) => updateSvc(svc.id, { password: e.target.value })}
                                className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500" />
                            </div>
                          )}
                          {s.error && <p className="text-red-400 text-xs">{s.error}</p>}
                          <div className="flex gap-2">
                            <button onClick={() => validateSvc(svc.id)} disabled={s.validating}
                              className="flex-1 bg-accent-500/20 hover:bg-accent-500/30 text-accent-400 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-1">
                              {s.validating ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
                              Test connection
                            </button>
                            <button onClick={() => skipSvc(svc.id)} className="px-3 py-2 rounded-lg border border-dark-600 text-slate-400 hover:text-white text-sm">Skip</button>
                          </div>
                        </div>
                      )}

                      {/* Installing */}
                      {s.mode === "installing" && (
                        <div className="flex items-center gap-3 text-slate-400 text-sm py-2">
                          <Loader2 size={16} className="animate-spin text-accent-400" />
                          <div>
                            <p className="text-white text-sm">Pulling Docker image…</p>
                            <p className="text-slate-500 text-xs">This may take a minute on first install</p>
                          </div>
                        </div>
                      )}

                      {/* Done (installed) */}
                      {s.mode === "done" && (
                        <div className="flex items-center gap-2 text-green-400 text-sm">
                          <CheckCircle size={16} /> Running at <code className="text-xs text-green-300">{s.url}</code>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="px-5 py-3 rounded-xl border border-dark-600 text-slate-400 hover:text-white text-sm transition-colors">Back</button>
                <button onClick={saveServices} disabled={saving || Object.values(svcs).some((s) => s.mode === "detecting" || s.mode === "installing")}
                  className="flex-1 bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <>Continue <ChevronRight size={18} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 2: Storage ═════════════════════════════════════════════ */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                <HardDrive size={20} /> Storage
              </h2>
              <p className="text-slate-400 text-sm mb-5">
                Your drive is mounted into the container automatically.
              </p>

              {/* Host path info */}
              {storageInfo && (
                <div className="bg-dark-700 rounded-xl p-4 mb-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Host drive path</p>
                  <code className="text-accent-400 font-mono">{storageInfo.storage_path}</code>
                  <p className="text-xs text-slate-600 mt-1">
                    To change: edit <code className="text-slate-500">STORAGE_PATH</code> in <code className="text-slate-500">.env</code> next to docker-compose.yml and restart.
                  </p>
                </div>
              )}

              {/* Disk cards */}
              {storageInfo && (
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { label: "Media", disk: storageInfo.media_disk },
                    { label: "Downloads", disk: storageInfo.downloads_disk },
                  ].map(({ label, disk }) => (
                    <div key={label} className="bg-dark-700 rounded-xl p-3">
                      <p className="text-xs text-slate-400 mb-1">{label}</p>
                      {disk?.accessible ? (
                        <>
                          <p className="text-white font-semibold">{disk.free_gb} GB free</p>
                          <p className="text-slate-500 text-xs">{disk.used_gb} / {disk.total_gb} GB</p>
                          <DiskBar pct={disk.used_pct} />
                        </>
                      ) : (
                        <p className="text-yellow-400 text-xs flex items-center gap-1"><AlertCircle size={11} /> Will be created on first use</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Media path (container)</label>
                  <input type="text" value={mediaRoot} onChange={(e) => setMediaRoot(e.target.value)} placeholder="/media"
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Downloads path (container)</label>
                  <input type="text" value={downloadsPath} onChange={(e) => setDownloadsPath(e.target.value)} placeholder="/downloads"
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">TMDB API Key <span className="text-slate-600">(optional, for metadata)</span></label>
                  <input type="text" value={tmdbKey} onChange={(e) => setTmdbKey(e.target.value)} placeholder="Get free key at themoviedb.org"
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-500" />
                </div>
              </div>

              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-5 py-3 rounded-xl border border-dark-600 text-slate-400 hover:text-white text-sm">Back</button>
                <button onClick={saveStorage} disabled={saving}
                  className="flex-1 bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <>Complete Setup <CheckCircle size={18} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 3: Done ════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} className="text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">All set!</h2>
              <p className="text-slate-400 mb-8">Media Organizor is ready to use</p>
              <button onClick={() => router.push("/")} className="bg-accent-500 hover:bg-accent-400 text-white px-8 py-3 rounded-xl font-medium transition-colors">
                Go to Dashboard
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
