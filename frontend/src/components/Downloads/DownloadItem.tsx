import { Trash2 } from "lucide-react";
import type { Download as DownloadType } from "@/lib/types";

interface DownloadItemProps {
  download: DownloadType;
  onRemove: (hash: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

const statusColors: Record<string, string> = {
  downloading: "text-blue-400",
  done: "text-green-400",
  paused: "text-yellow-400",
  error: "text-red-400",
  stalled: "text-orange-400",
};

export default function DownloadItem({ download, onRemove }: DownloadItemProps) {
  const statusColor = statusColors[download.status] || "text-slate-400";

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">{download.name}</p>
          <div className="flex items-center gap-4 mt-1">
            <span className={`text-xs font-medium ${statusColor} capitalize`}>
              {download.status}
            </span>
            <span className="text-xs text-slate-500">{formatBytes(download.size)}</span>
            {download.status === "downloading" && (
              <span className="text-xs text-slate-500">{formatSpeed(download.dlspeed)}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => onRemove(download.hash)}
          className="text-slate-500 hover:text-red-400 transition-colors p-1"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{download.progress}%</span>
          {download.status === "downloading" && download.eta > 0 && (
            <span>ETA: {Math.round(download.eta / 60)}min</span>
          )}
        </div>
        <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              download.status === "done" ? "bg-green-500" :
              download.status === "error" ? "bg-red-500" :
              "bg-accent-500"
            }`}
            style={{ width: `${download.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
