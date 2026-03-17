"use client";

import { useState } from "react";
import { Search, Download, Users, HardDrive } from "lucide-react";
import { api } from "@/lib/api";

function formatBytes(bytes: number): string {
  if (!bytes) return "?";
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(0)} MB`;
}

export default function RequestsPage() {
  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState("auto");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await api.searchMedia(query, mediaType);
      setResults(res.results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const download = async (result: any) => {
    setDownloading(result.title);
    try {
      await api.addDownload(result.magnet, result.title);
      alert(`Started downloading: ${result.title}`);
    } catch (e) {
      alert("Failed to start download");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Search & Request</h1>
        <p className="text-slate-400 mt-1">Search for movies and TV shows to download</p>
      </div>

      {/* Search Bar */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 mb-6">
        <div className="flex gap-3">
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value)}
            className="bg-dark-700 border border-dark-600 text-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent-500"
          >
            <option value="auto">Auto</option>
            <option value="movie">Movie</option>
            <option value="tv">TV Show</option>
          </select>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Search for movies or TV shows..."
            className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent-500"
          />
          <button
            onClick={search}
            disabled={loading}
            className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Search size={16} />
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((result, idx) => (
            <div key={idx} className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{result.title}</p>
                <div className="flex items-center gap-4 mt-1.5">
                  <span className="text-xs bg-dark-700 text-accent-400 px-2 py-0.5 rounded">
                    {result.quality}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Users size={12} />
                    {result.seeders} seeders
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <HardDrive size={12} />
                    {formatBytes(result.size)}
                  </span>
                  <span className="text-xs text-slate-600">{result.indexer}</span>
                </div>
              </div>
              <button
                onClick={() => download(result)}
                disabled={!!downloading}
                className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 flex-shrink-0"
              >
                <Download size={14} />
                {downloading === result.title ? "Adding..." : "Download"}
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && query && (
        <p className="text-slate-500 text-center py-12">No results found. Try a different search.</p>
      )}
    </div>
  );
}
