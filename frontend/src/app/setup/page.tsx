"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ChevronRight, Server, Key, Tv, FolderOpen } from "lucide-react";

const AI_PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Most capable — claude-opus-4-6, claude-sonnet",
    requiresKey: true,
    keyLabel: "API Key",
    keyPlaceholder: "sk-ant-...",
    models: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
    defaultModel: "claude-opus-4-6",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4 Turbo and more",
    requiresKey: true,
    keyLabel: "API Key",
    keyPlaceholder: "sk-...",
    models: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
    defaultModel: "gpt-4o",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Cost-effective DeepSeek models",
    requiresKey: true,
    keyLabel: "API Key",
    keyPlaceholder: "sk-...",
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access 100+ models via one API",
    requiresKey: true,
    keyLabel: "API Key",
    keyPlaceholder: "sk-or-...",
    models: ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "google/gemini-pro"],
    defaultModel: "anthropic/claude-3.5-sonnet",
  },
  {
    id: "ollama",
    name: "Ollama",
    description: "Local models — no API key needed",
    requiresKey: false,
    urlLabel: "Ollama URL",
    urlPlaceholder: "http://localhost:11434",
    models: ["llama3.2", "llama3.1", "mistral", "phi3", "codellama"],
    defaultModel: "llama3.2",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    description: "Local LM Studio server — no API key needed",
    requiresKey: false,
    urlLabel: "LM Studio URL",
    urlPlaceholder: "http://localhost:1234/v1",
    models: ["local-model"],
    defaultModel: "local-model",
  },
];

const STEPS = ["AI Provider", "Services", "Media Paths", "Done"];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 0 — AI Provider
  const [selectedProvider, setSelectedProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [providerUrl, setProviderUrl] = useState("");
  const [model, setModel] = useState("claude-opus-4-6");

  // Step 1 — Services
  const [qbtMode, setQbtMode] = useState<"existing" | "new">("existing");
  const [qbtUrl, setQbtUrl] = useState("http://localhost:8080");
  const [qbtUser, setQbtUser] = useState("admin");
  const [qbtPass, setQbtPass] = useState("adminadmin");
  const [prowlarrUrl, setProwlarrUrl] = useState("http://localhost:9696");
  const [prowlarrKey, setProwlarrKey] = useState("");
  const [jellyfinUrl, setJellyfinUrl] = useState("http://localhost:8096");
  const [jellyfinKey, setJellyfinKey] = useState("");

  // Step 2 — Paths
  const [mediaRoot, setMediaRoot] = useState("/media");
  const [downloadsPath, setDownloadsPath] = useState("/downloads");
  const [tmdbKey, setTmdbKey] = useState("");

  const provider = AI_PROVIDERS.find((p) => p.id === selectedProvider)!;

  const saveProviderStep = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/ai-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          api_key: apiKey || undefined,
          model: model || undefined,
          base_url: providerUrl || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to save provider");
      setStep(1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveServicesStep = async () => {
    setSaving(true);
    setError("");
    try {
      if (qbtMode === "existing") {
        const res = await fetch("/api/settings/qbittorrent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: qbtUrl, username: qbtUser, password: qbtPass, use_existing: true }),
        });
        const data = await res.json();
        if (!data.connected) {
          setError(data.message || "Could not connect to qBittorrent");
          setSaving(false);
          return;
        }
      }
      await fetch("/api/settings/general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prowlarr_url: prowlarrUrl,
          prowlarr_api_key: prowlarrKey || undefined,
          jellyfin_url: jellyfinUrl,
          jellyfin_api_key: jellyfinKey || undefined,
        }),
      });
      setStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const savePathsStep = async () => {
    setSaving(true);
    setError("");
    try {
      await fetch("/api/settings/general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_root: mediaRoot, downloads_path: downloadsPath, tmdb_api_key: tmdbKey || undefined }),
      });
      await fetch("/api/settings/complete-setup", { method: "POST" });
      setStep(3);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Tv size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Media Organizor</h1>
          <p className="text-slate-400 mt-2">AI-powered media management setup</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                i < step ? "bg-green-500 text-white" : i === step ? "bg-accent-500 text-white" : "bg-dark-700 text-slate-500"
              }`}>
                {i < step ? <CheckCircle size={16} /> : i + 1}
              </div>
              <span className={`text-sm ${i === step ? "text-white" : "text-slate-500"}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-dark-600 mx-1" />}
            </div>
          ))}
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6">
          {/* Step 0: AI Provider */}
          {step === 0 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Choose AI Provider</h2>
              <p className="text-slate-400 text-sm mb-6">Select which AI model will power your media assistant</p>

              <div className="grid grid-cols-1 gap-3 mb-6">
                {AI_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProvider(p.id); setModel(p.defaultModel); }}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedProvider === p.id
                        ? "border-accent-500 bg-accent-500/10"
                        : "border-dark-600 hover:border-dark-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{p.name}</p>
                        <p className="text-sm text-slate-400 mt-0.5">{p.description}</p>
                      </div>
                      {selectedProvider === p.id && <CheckCircle size={20} className="text-accent-400 flex-shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>

              {/* Provider config */}
              <div className="space-y-4">
                {provider.requiresKey ? (
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">{provider.keyLabel}</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={provider.keyPlaceholder}
                      className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">{(provider as any).urlLabel}</label>
                    <input
                      type="text"
                      value={providerUrl || (provider as any).urlPlaceholder}
                      onChange={(e) => setProviderUrl(e.target.value)}
                      placeholder={(provider as any).urlPlaceholder}
                      className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500"
                    />
                  </div>
                )}
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent-500"
                  >
                    {provider.models.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
              <button
                onClick={saveProviderStep}
                disabled={saving || (provider.requiresKey && !apiKey)}
                className="w-full mt-6 bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                {saving ? "Saving..." : "Continue"} <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* Step 1: Services */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Configure Services</h2>
              <p className="text-slate-400 text-sm mb-6">Connect your download and media services</p>

              {/* qBittorrent */}
              <div className="mb-6">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2"><Server size={16} /> qBittorrent</h3>
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => setQbtMode("existing")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${qbtMode === "existing" ? "border-accent-500 bg-accent-500/10 text-accent-400" : "border-dark-600 text-slate-400"}`}
                  >
                    Already running
                  </button>
                  <button
                    onClick={() => setQbtMode("new")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${qbtMode === "new" ? "border-accent-500 bg-accent-500/10 text-accent-400" : "border-dark-600 text-slate-400"}`}
                  >
                    Use Docker service
                  </button>
                </div>

                {qbtMode === "existing" ? (
                  <div className="space-y-3">
                    <input type="text" value={qbtUrl} onChange={(e) => setQbtUrl(e.target.value)} placeholder="http://localhost:8080" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" value={qbtUser} onChange={(e) => setQbtUser(e.target.value)} placeholder="Username" className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
                      <input type="password" value={qbtPass} onChange={(e) => setQbtPass(e.target.value)} placeholder="Password" className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-dark-700 rounded-lg p-4">
                    <p className="text-sm text-slate-400">qBittorrent will start automatically with Docker.</p>
                    <code className="text-xs text-accent-400 block mt-2">docker compose --profile full up -d</code>
                  </div>
                )}
              </div>

              {/* Prowlarr */}
              <div className="mb-4">
                <h3 className="text-white font-medium mb-3">Prowlarr (Search Indexer)</h3>
                <div className="space-y-3">
                  <input type="text" value={prowlarrUrl} onChange={(e) => setProwlarrUrl(e.target.value)} placeholder="http://localhost:9696" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
                  <input type="text" value={prowlarrKey} onChange={(e) => setProwlarrKey(e.target.value)} placeholder="Prowlarr API Key (optional)" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
                </div>
              </div>

              {/* Jellyfin */}
              <div className="mb-6">
                <h3 className="text-white font-medium mb-3">Jellyfin (Media Server)</h3>
                <div className="space-y-3">
                  <input type="text" value={jellyfinUrl} onChange={(e) => setJellyfinUrl(e.target.value)} placeholder="http://localhost:8096" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
                  <input type="text" value={jellyfinKey} onChange={(e) => setJellyfinKey(e.target.value)} placeholder="Jellyfin API Key (optional)" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
                </div>
              </div>

              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="px-5 py-3 rounded-xl border border-dark-600 text-slate-400 hover:text-white transition-colors text-sm">Back</button>
                <button onClick={saveServicesStep} disabled={saving} className="flex-1 bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                  {saving ? "Saving..." : "Continue"} <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Paths */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Media Paths</h2>
              <p className="text-slate-400 text-sm mb-6">Configure where media is stored</p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Media Root</label>
                  <input type="text" value={mediaRoot} onChange={(e) => setMediaRoot(e.target.value)} placeholder="/media" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
                  <p className="text-xs text-slate-600 mt-1">Organized movies and TV shows go here</p>
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Downloads Path</label>
                  <input type="text" value={downloadsPath} onChange={(e) => setDownloadsPath(e.target.value)} placeholder="/downloads" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
                  <p className="text-xs text-slate-600 mt-1">Where qBittorrent saves files</p>
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">TMDB API Key <span className="text-slate-600">(for metadata)</span></label>
                  <input type="text" value={tmdbKey} onChange={(e) => setTmdbKey(e.target.value)} placeholder="Get from themoviedb.org/settings/api" className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-500" />
                </div>
              </div>

              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-5 py-3 rounded-xl border border-dark-600 text-slate-400 hover:text-white transition-colors text-sm">Back</button>
                <button onClick={savePathsStep} disabled={saving} className="flex-1 bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                  {saving ? "Finishing..." : "Complete Setup"} <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} className="text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Setup Complete!</h2>
              <p className="text-slate-400 mb-8">Media Organizor is ready to use</p>
              <button
                onClick={() => router.push("/")}
                className="bg-accent-500 hover:bg-accent-400 text-white px-8 py-3 rounded-xl font-medium transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
