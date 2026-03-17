"use client";

import { useEffect, useState } from "react";
import { Download, Film, Tv, HardDrive } from "lucide-react";
import StatsCard from "@/components/Dashboard/StatsCard";
import { api } from "@/lib/api";

export default function Dashboard() {
  const [downloads, setDownloads] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [dl, cfg] = await Promise.all([
          api.getDownloads(),
          api.getSettings(),
        ]);
        setDownloads(dl.downloads);
        setSettings(cfg);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeDownloads = downloads.filter((d) => d.status === "downloading").length;
  const completedDownloads = downloads.filter((d) => d.status === "done").length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">AI-powered media management platform</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Active Downloads"
          value={activeDownloads}
          subtitle="Currently downloading"
          icon={<Download size={20} className="text-white" />}
          color="bg-blue-600"
        />
        <StatsCard
          title="Completed"
          value={completedDownloads}
          subtitle="Ready to organize"
          icon={<Film size={20} className="text-white" />}
          color="bg-green-600"
        />
        <StatsCard
          title="Total Torrents"
          value={downloads.length}
          subtitle="All time"
          icon={<HardDrive size={20} className="text-white" />}
          color="bg-purple-600"
        />
        <StatsCard
          title="Services"
          value={settings ? [
            settings.has_prowlarr_key,
            settings.has_jellyfin_key,
            settings.has_tmdb_key,
          ].filter(Boolean).length : 0}
          subtitle="Configured"
          icon={<Tv size={20} className="text-white" />}
          color="bg-orange-600"
        />
      </div>

      {/* Recent Downloads */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl">
        <div className="p-5 border-b border-dark-700">
          <h2 className="font-semibold text-white">Recent Downloads</h2>
        </div>
        <div className="p-5">
          {loading ? (
            <p className="text-slate-500 text-sm">Loading...</p>
          ) : downloads.length === 0 ? (
            <p className="text-slate-500 text-sm">No active downloads. Go to the Requests page to download media.</p>
          ) : (
            <div className="space-y-3">
              {downloads.slice(0, 5).map((d) => (
                <div key={d.hash} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{d.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{d.status}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-medium text-white">{d.progress}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Service Status */}
      {settings && (
        <div className="mt-4 bg-dark-800 border border-dark-700 rounded-xl">
          <div className="p-5 border-b border-dark-700">
            <h2 className="font-semibold text-white">Service Status</h2>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "AI Agent", ok: settings.has_anthropic_key },
              { name: "Prowlarr", ok: settings.has_prowlarr_key },
              { name: "TMDB", ok: settings.has_tmdb_key },
              { name: "Jellyfin", ok: settings.has_jellyfin_key },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${svc.ok ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-sm text-slate-400">{svc.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
