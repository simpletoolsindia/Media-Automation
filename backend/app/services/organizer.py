"""File organization service - rename and move media files."""
import os
import re
import shutil
from pathlib import Path
from typing import Optional
from app.config import get_settings

settings = get_settings()


class OrganizerService:
    MOVIE_EXTENSIONS = {".mkv", ".mp4", ".avi", ".mov", ".wmv", ".m4v", ".ts"}

    def __init__(self):
        self.media_root = Path(settings.media_root)
        self.movies_path = self.media_root / "movies"
        self.tv_path = self.media_root / "tv"

    def detect_media_type(self, filename: str) -> dict:
        """Detect if file is movie or TV show and extract metadata."""
        filename = Path(filename).stem

        # TV show patterns: S01E01, 1x01, etc.
        tv_patterns = [
            r"[Ss](\d{1,2})[Ee](\d{1,2})",  # S01E01
            r"(\d{1,2})x(\d{1,2})",           # 1x01
            r"[Ss]eason\s*(\d{1,2})",         # Season 1
        ]

        for pattern in tv_patterns:
            match = re.search(pattern, filename)
            if match:
                return {"type": "tv", "raw_name": filename}

        # Movie pattern: has year
        year_match = re.search(r"\b(19|20)\d{2}\b", filename)
        if year_match:
            return {"type": "movie", "year": year_match.group(), "raw_name": filename}

        return {"type": "movie", "raw_name": filename}

    def clean_title(self, title: str) -> str:
        """Clean up filename to extract clean title."""
        # Remove quality markers
        quality_markers = [
            r"\b(2160p|1080p|720p|480p|4K|HDR|SDR|HEVC|x264|x265|H\.264|H\.265)\b",
            r"\b(BluRay|BDRip|WEB-DL|WEBRip|HDTV|DVDRip|CAM|TS)\b",
            r"\b(AAC|AC3|DTS|DD5\.1|Atmos|TrueHD)\b",
            r"\b(EXTENDED|THEATRICAL|DIRECTORS\.CUT|REMASTERED)\b",
        ]
        result = title
        for pattern in quality_markers:
            result = re.sub(pattern, "", result, flags=re.IGNORECASE)

        # Replace dots and underscores with spaces
        result = re.sub(r"[._]", " ", result)
        # Clean up extra spaces
        result = re.sub(r"\s+", " ", result).strip()
        return result

    def generate_movie_path(self, title: str, year: Optional[str] = None) -> Path:
        """Generate Jellyfin-compatible movie path."""
        clean = self.clean_title(title)
        folder = f"{clean} ({year})" if year else clean
        return self.movies_path / folder / f"{folder}.mkv"

    def generate_tv_path(self, title: str, season: int, episode: int) -> Path:
        """Generate Jellyfin-compatible TV path."""
        clean = self.clean_title(title)
        season_str = f"Season {season:02d}"
        filename = f"{clean} - S{season:02d}E{episode:02d}.mkv"
        return self.tv_path / clean / season_str / filename

    def get_rename_preview(self, input_path: str) -> dict:
        """Preview what a file would be renamed to."""
        path = Path(input_path)
        if not path.exists():
            return {"error": f"File not found: {input_path}"}

        detection = self.detect_media_type(path.name)
        clean_title = self.clean_title(path.stem)

        if detection["type"] == "movie":
            year = detection.get("year")
            proposed = self.generate_movie_path(clean_title, year)
        else:
            # Default TV: S01E01
            proposed = self.generate_tv_path(clean_title, 1, 1)

        return {
            "original": str(path),
            "proposed": str(proposed),
            "type": detection["type"],
            "title": clean_title,
            "confidence": 0.8,
        }

    def organize_file(self, input_path: str, output_path: str) -> dict:
        """Move and rename a file."""
        src = Path(input_path)
        dst = Path(output_path)

        if not src.exists():
            return {"success": False, "error": f"Source not found: {input_path}"}

        dst.parent.mkdir(parents=True, exist_ok=True)

        # Change extension to match source
        dst = dst.with_suffix(src.suffix)

        shutil.move(str(src), str(dst))
        return {"success": True, "new_path": str(dst)}

    def scan_downloads(self) -> list[dict]:
        """Scan download directory for media files."""
        downloads = Path(settings.downloads_path)
        if not downloads.exists():
            return []

        files = []
        for path in downloads.rglob("*"):
            if path.is_file() and path.suffix.lower() in self.MOVIE_EXTENSIONS:
                # Skip small files (likely samples)
                if path.stat().st_size < 100_000_000:  # < 100MB
                    continue
                preview = self.get_rename_preview(str(path))
                files.append(preview)
        return files
