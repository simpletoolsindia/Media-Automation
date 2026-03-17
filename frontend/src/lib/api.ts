const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  // Search
  searchMedia: (query: string, mediaType = "auto") =>
    fetchAPI<{ results: any[]; count: number }>("/api/media/search", {
      method: "POST",
      body: JSON.stringify({ query, media_type: mediaType }),
    }),

  getMetadata: (title: string, mediaType = "movie", year?: string) =>
    fetchAPI<{ results: any[] }>(
      `/api/media/metadata/${encodeURIComponent(title)}?media_type=${mediaType}${year ? `&year=${year}` : ""}`
    ),

  // Downloads
  getDownloads: () =>
    fetchAPI<{ downloads: any[] }>("/api/downloads/"),

  addDownload: (magnet: string, title: string, mediaType = "movie") =>
    fetchAPI<{ success: boolean }>("/api/downloads/add", {
      method: "POST",
      body: JSON.stringify({ magnet, title, media_type: mediaType }),
    }),

  removeDownload: (hash: string, deleteFiles = false) =>
    fetchAPI<{ success: boolean }>(
      `/api/downloads/${hash}?delete_files=${deleteFiles}`,
      { method: "DELETE" }
    ),

  // Organizer
  scanDownloads: () =>
    fetchAPI<{ files: any[]; count: number }>("/api/organizer/scan"),

  previewRename: (inputPath: string) =>
    fetchAPI<any>("/api/organizer/preview", {
      method: "POST",
      body: JSON.stringify({ input_path: inputPath }),
    }),

  organizeFile: (inputPath: string, outputPath?: string) =>
    fetchAPI<any>("/api/organizer/organize", {
      method: "POST",
      body: JSON.stringify({ input_path: inputPath, output_path: outputPath }),
    }),

  triggerJellyfinScan: (library?: string) =>
    fetchAPI<any>(
      `/api/organizer/jellyfin/scan${library ? `?library=${library}` : ""}`,
      { method: "POST" }
    ),

  // Settings
  getSettings: () =>
    fetchAPI<any>("/api/settings/"),

  healthCheck: () =>
    fetchAPI<{ status: string }>("/api/settings/health"),

  // Agent
  sendChatMessage: async (message: string, onChunk: (chunk: string) => void) => {
    const res = await fetch(`${API_BASE}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) throw new Error(`Chat error: ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          onChunk(data);
        }
      }
    }
  },

  resetChat: () =>
    fetchAPI<{ status: string }>("/api/agent/reset", { method: "POST" }),
};
