export interface Download {
  hash: string;
  name: string;
  progress: number;
  status: "downloading" | "done" | "paused" | "error" | "stalled" | "checking";
  size: number;
  dlspeed: number;
  eta: number;
  save_path: string;
}

export interface SearchResult {
  title: string;
  magnet: string;
  download_url: string;
  size: number;
  seeders: number;
  leechers: number;
  quality: string;
  indexer: string;
  publish_date: string;
}

export interface MediaMetadata {
  tmdb_id: number;
  title: string;
  year: string;
  overview: string;
  rating: string;
  poster_url: string | null;
  backdrop_url: string | null;
  genres: string;
  media_type: "movie" | "tv";
}

export interface OrganizePreview {
  original: string;
  proposed: string;
  type: "movie" | "tv";
  title: string;
  confidence: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface Settings {
  prowlarr_url: string;
  qbittorrent_url: string;
  jellyfin_url: string;
  media_root: string;
  downloads_path: string;
  has_anthropic_key: boolean;
  has_tmdb_key: boolean;
  has_prowlarr_key: boolean;
  has_jellyfin_key: boolean;
}
