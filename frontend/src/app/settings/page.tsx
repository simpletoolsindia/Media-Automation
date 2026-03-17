"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Save, RefreshCw } from "lucide-react";

const AI_PROVIDERS = [
  { id: "anthropic", name: "Anthropic Claude", requiresKey: true, models: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"] },
  { id: "openai", name: "OpenAI", requiresKey: true, models: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { id: "deepseek", name: "DeepSeek", requiresKey: true, models: ["deepseek-chat", "deepseek-reasoner"] },
  { id: "openrouter", name: "OpenRouter", requiresKey: true, models: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "google/gemini-pro"] },
  { id: "ollama", name: "Ollama (Local)", requiresKey: false, models: ["llama3.2", "llama3.1", "mistral", "phi3"] },
  { id: "lmstudio", name: "LM Studio (Local)", requiresKey: false, models: ["local-model"] },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState("");
  const [saved, setSaved] = useState("");

  // AI Provider form
  const [provider, setProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("claude-opus-4-6");
  const [baseUrl, setBaseUrl] = useState("");

  // Services form
  const [prowlarrUrl, setProwlarrUrl] = useState("");
  const [prowlarrKey, setProwlarrKey] = useState("");
  const [jellyfinUrl, setJellyfinUrl] = useState("");
  const [jellyfinKey, setJellyfinKey] = useState("");
  const [tmdbKey, setTmdbKey] = useState("");
  const [mediaRoot, setMediaRoot] = useState("/media");
  const [downloadsPath, setDownloadsPath] = useState("/downloads");

  const load = async () => {
    const s = await fetch("/api/settings/").then((r) => r.json());
    setSettings(s);
    setProvider(s.ai_provider || "anthropic");
    setModel(s[`${s.ai_provider}_model`] || "claude-opus-4-6");
    setProwlarrUrl(s.prowlarr_url || "");
    setJellyfinUrl(s.jellyfin_url || "");
    setMediaRoot(s.media_root || "/media");
    setDownloadsPath(s.downloads_path || "/downloads");
  };

  useEffect(() => { load(); }, []);

  const saveProvider = async () => {
    setSaving("provider");
    await fetch("/api/settings/ai-provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, api_key: apiKey || undefined, model, base_url: baseUrl || undefined }),
    });
    setSaving("");
    setSaved("provider");
    setApiKey("");
    load();
    setTimeout(() => setSaved(""), 2000);
  };

  const saveGeneral = async () => {
    setSaving("general");
    await fetch("/api/settings/general", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prowlarr_url: prowlarrUrl,
        prowlarr_api_key: prowlarrKey || undefined,
        jellyfin_url: jellyfinUrl,
        jellyfin_api_key: jellyfinKey || undefined,
        tmdb_api_key: tmdbKey || undefined,
        media_root: mediaRoot,
        downloads_path: downloadsPath,
      }),
    });
    setSaving("");
    setSaved("general");
    setTimeout(() => setSaved(""), 2000);
  };

  const providerInfo = AI_PROVIDERS.find((p) => p.id === provider);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Configure your AI provider and services</p>
      </div>

      {/* AI Provider */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl mb-6">
        <div className="p-5 border-b border-dark-700 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-white">AI Provider</h2>
            {settings && (
              <p className="text-xs text-accent-400 mt-0.5">
                Current: {settings.ai_provider} — {settings[`${settings.ai_provider}_model`] || settings.anthropic_model}
              </p>
            )}
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm text-slate-400 block mb-2">Provider</label>
            <select
              value={provider}
              onChange={(e) => { setProvider(e.target.value); setModel(""); }}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent-500"
            >
              {AI_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-2">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent-500"
            >
              {(providerInfo?.models || []).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {providerInfo?.requiresKey && (
            <div>
              <label className="text-sm text-slate-400 block mb-2">
                API Key {settings?.[`has_${provider}_key`] && <span className="text-green-400 text-xs">✓ configured</span>}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={settings?.[`has_${provider}_key`] ? "Leave blank to keep existing" : "Enter API key"}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500"
              />
            </div>
          )}
          {(provider === "ollama" || provider === "lmstudio") && (
            <div>
              <label className="text-sm text-slate-400 block mb-2">Local URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={provider === "ollama" ? "http://localhost:11434" : "http://localhost:1234/v1"}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500"
              />
            </div>
          )}
          <button
            onClick={saveProvider}
            disabled={saving === "provider"}
            className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {saving === "provider" ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saved === "provider" ? "Saved!" : "Save Provider"}
          </button>
        </div>
      </div>

      {/* Services */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl mb-6">
        <div className="p-5 border-b border-dark-700">
          <h2 className="font-semibold text-white">Services</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 block mb-2">Prowlarr URL</label>
              <input type="text" value={prowlarrUrl} onChange={(e) => setProwlarrUrl(e.target.value)} placeholder="http://localhost:9696" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Prowlarr API Key {settings?.has_prowlarr_key && <span className="text-green-400 text-xs">✓</span>}</label>
              <input type="password" value={prowlarrKey} onChange={(e) => setProwlarrKey(e.target.value)} placeholder="Leave blank to keep" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Jellyfin URL</label>
              <input type="text" value={jellyfinUrl} onChange={(e) => setJellyfinUrl(e.target.value)} placeholder="http://localhost:8096" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Jellyfin API Key {settings?.has_jellyfin_key && <span className="text-green-400 text-xs">✓</span>}</label>
              <input type="password" value={jellyfinKey} onChange={(e) => setJellyfinKey(e.target.value)} placeholder="Leave blank to keep" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">TMDB API Key {settings?.has_tmdb_key && <span className="text-green-400 text-xs">✓</span>}</label>
              <input type="text" value={tmdbKey} onChange={(e) => setTmdbKey(e.target.value)} placeholder="Leave blank to keep" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 block mb-2">Media Root</label>
              <input type="text" value={mediaRoot} onChange={(e) => setMediaRoot(e.target.value)} className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent-500" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-2">Downloads Path</label>
              <input type="text" value={downloadsPath} onChange={(e) => setDownloadsPath(e.target.value)} className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent-500" />
            </div>
          </div>
          <button
            onClick={saveGeneral}
            disabled={saving === "general"}
            className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {saving === "general" ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saved === "general" ? "Saved!" : "Save Services"}
          </button>
        </div>
      </div>

      {/* Service Status */}
      {settings && (
        <div className="bg-dark-800 border border-dark-700 rounded-xl">
          <div className="p-5 border-b border-dark-700">
            <h2 className="font-semibold text-white">Status</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            {[
              { name: "Anthropic", ok: settings.has_anthropic_key },
              { name: "OpenAI", ok: settings.has_openai_key },
              { name: "DeepSeek", ok: settings.has_deepseek_key },
              { name: "OpenRouter", ok: settings.has_openrouter_key },
              { name: "TMDB", ok: settings.has_tmdb_key },
              { name: "Prowlarr", ok: settings.has_prowlarr_key },
              { name: "Jellyfin", ok: settings.has_jellyfin_key },
            ].map((s) => (
              <div key={s.name} className="flex items-center gap-2">
                {s.ok ? <CheckCircle size={16} className="text-green-500" /> : <XCircle size={16} className="text-slate-600" />}
                <span className={`text-sm ${s.ok ? "text-slate-300" : "text-slate-600"}`}>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
