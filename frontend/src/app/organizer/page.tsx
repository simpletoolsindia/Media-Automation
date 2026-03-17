"use client";

import { useState, useEffect } from "react";
import { FolderOpen, RefreshCw, Zap } from "lucide-react";
import { api } from "@/lib/api";

export default function OrganizerPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [organizing, setOrganizing] = useState<string | null>(null);

  const scan = async () => {
    setLoading(true);
    try {
      const res = await api.scanDownloads();
      setFiles(res.files);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scan();
  }, []);

  const organize = async (file: any) => {
    setOrganizing(file.original);
    try {
      const result = await api.organizeFile(file.original, file.proposed);
      if (result.success) {
        setFiles((prev) => prev.filter((f) => f.original !== file.original));
        alert(`Organized: ${result.new_path}`);
      } else {
        alert(`Error: ${result.error}`);
      }
    } finally {
      setOrganizing(null);
    }
  };

  const organizeAll = async () => {
    for (const file of files) {
      await organize(file);
    }
    await api.triggerJellyfinScan();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">File Organizer</h1>
          <p className="text-slate-400 mt-1">Rename and organize media files for Jellyfin</p>
        </div>
        <div className="flex gap-2">
          <button onClick={scan} className="p-2 text-slate-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors">
            <RefreshCw size={18} />
          </button>
          {files.length > 0 && (
            <button
              onClick={organizeAll}
              className="bg-accent-500 hover:bg-accent-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Zap size={16} />
              Organize All
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Scanning downloads...</p>
      ) : files.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen size={48} className="text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500">No files to organize</p>
          <p className="text-slate-600 text-sm mt-1">Complete downloads will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((file, idx) => (
            <div key={idx} className="bg-dark-800 border border-dark-700 rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Original</p>
                  <p className="text-sm text-slate-300 break-all">{file.original}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Proposed</p>
                  <p className="text-sm text-green-400 break-all">{file.proposed}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-dark-700 text-accent-400 px-2 py-0.5 rounded capitalize">
                    {file.type}
                  </span>
                  <span className="text-xs text-slate-500">
                    {Math.round(file.confidence * 100)}% confidence
                  </span>
                </div>
                <button
                  onClick={() => organize(file)}
                  disabled={organizing === file.original}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {organizing === file.original ? "Organizing..." : "Organize"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
