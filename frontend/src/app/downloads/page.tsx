"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import DownloadItem from "@/components/Downloads/DownloadItem";
import { api } from "@/lib/api";
import type { Download } from "@/lib/types";

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDownloads = async () => {
    try {
      const res = await api.getDownloads();
      setDownloads(res.downloads);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDownloads();
    const interval = setInterval(loadDownloads, 5000);
    return () => clearInterval(interval);
  }, []);

  const removeDownload = async (hash: string) => {
    if (!confirm("Remove this download?")) return;
    await api.removeDownload(hash);
    loadDownloads();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Downloads</h1>
          <p className="text-slate-400 mt-1">{downloads.length} torrents</p>
        </div>
        <button
          onClick={loadDownloads}
          className="p-2 text-slate-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading downloads...</p>
      ) : downloads.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500">No active downloads</p>
          <p className="text-slate-600 text-sm mt-1">Go to Requests to start downloading</p>
        </div>
      ) : (
        <div className="space-y-3">
          {downloads.map((dl) => (
            <DownloadItem key={dl.hash} download={dl} onRemove={removeDownload} />
          ))}
        </div>
      )}
    </div>
  );
}
