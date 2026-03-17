"""Tool definitions for the AI orchestrator agent."""
from typing import Any
import json


TOOLS = [
    {
        "name": "search_media",
        "description": "Search for movies or TV shows across configured indexers. Returns a list of available torrents with quality and seeder info.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The title to search for (e.g., 'Interstellar', 'Breaking Bad')"
                },
                "media_type": {
                    "type": "string",
                    "enum": ["movie", "tv", "auto"],
                    "description": "Type of media to search for. Use 'auto' if unsure."
                },
                "year": {
                    "type": "string",
                    "description": "Optional release year to narrow search"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "rank_results",
        "description": "Rank and filter search results to find the best quality option. Considers seeders, quality, and file size.",
        "input_schema": {
            "type": "object",
            "properties": {
                "results": {
                    "type": "array",
                    "description": "List of search results to rank",
                    "items": {"type": "object"}
                },
                "preferred_quality": {
                    "type": "string",
                    "enum": ["1080p", "720p", "4K", "any"],
                    "description": "Preferred quality level"
                }
            },
            "required": ["results"]
        }
    },
    {
        "name": "download_media",
        "description": "Send a torrent to qBittorrent for downloading.",
        "input_schema": {
            "type": "object",
            "properties": {
                "magnet": {
                    "type": "string",
                    "description": "Magnet link or torrent URL"
                },
                "title": {
                    "type": "string",
                    "description": "Title of the media being downloaded"
                },
                "media_type": {
                    "type": "string",
                    "enum": ["movie", "tv"],
                    "description": "Type of media"
                }
            },
            "required": ["magnet", "title"]
        }
    },
    {
        "name": "track_download",
        "description": "Check the current download status and progress.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Title to check download status for"
                }
            },
            "required": []
        }
    },
    {
        "name": "organize_files",
        "description": "Scan downloads folder and organize/rename media files into proper Jellyfin-compatible structure.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_path": {
                    "type": "string",
                    "description": "Specific file path to organize. Leave empty to scan all downloads."
                },
                "dry_run": {
                    "type": "boolean",
                    "description": "If true, show proposed changes without executing them"
                }
            },
            "required": []
        }
    },
    {
        "name": "fetch_metadata",
        "description": "Fetch metadata (title, year, poster, overview) from TMDB for a media item.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Media title to look up"
                },
                "year": {
                    "type": "string",
                    "description": "Release year to narrow search"
                },
                "media_type": {
                    "type": "string",
                    "enum": ["movie", "tv"],
                    "description": "Type of media"
                }
            },
            "required": ["title"]
        }
    },
    {
        "name": "sync_jellyfin",
        "description": "Trigger a Jellyfin library scan to pick up newly organized media.",
        "input_schema": {
            "type": "object",
            "properties": {
                "library": {
                    "type": "string",
                    "description": "Library name to scan (e.g., 'Movies', 'TV Shows'). Leave empty to scan all."
                }
            },
            "required": []
        }
    },
    {
        "name": "llm_disambiguation",
        "description": "When there is ambiguity about which media the user wants, present options and ask for clarification.",
        "input_schema": {
            "type": "object",
            "properties": {
                "options": {
                    "type": "array",
                    "description": "List of possible media options",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "year": {"type": "string"},
                            "type": {"type": "string"}
                        }
                    }
                },
                "question": {
                    "type": "string",
                    "description": "The clarifying question to ask the user"
                }
            },
            "required": ["options", "question"]
        }
    }
]


async def execute_tool(tool_name: str, tool_input: dict) -> Any:
    """Execute a tool and return the result."""
    from app.services.search import SearchService
    from app.services.downloader import DownloadService
    from app.services.organizer import OrganizerService
    from app.services.metadata_service import MetadataService
    from app.services.jellyfin import JellyfinService

    if tool_name == "search_media":
        service = SearchService()
        results = await service.search(
            query=tool_input["query"],
            media_type=tool_input.get("media_type", "auto"),
        )
        return json.dumps(results[:10])

    elif tool_name == "rank_results":
        results = tool_input.get("results", [])
        preferred_quality = tool_input.get("preferred_quality", "1080p")

        # Simple ranking: prefer preferred quality, then by seeders
        def score(r):
            quality_score = 0
            q = r.get("quality", "").lower()
            if preferred_quality.lower() in q:
                quality_score = 100
            elif "1080p" in q:
                quality_score = 80
            elif "720p" in q:
                quality_score = 60
            return quality_score + r.get("seeders", 0)

        ranked = sorted(results, key=score, reverse=True)
        return json.dumps(ranked[:5])

    elif tool_name == "download_media":
        service = DownloadService()
        result = await service.add_torrent(
            magnet=tool_input["magnet"],
        )
        return json.dumps(result)

    elif tool_name == "track_download":
        service = DownloadService()
        torrents = await service.get_torrents()
        return json.dumps(torrents)

    elif tool_name == "organize_files":
        service = OrganizerService()
        if input_path := tool_input.get("input_path"):
            preview = service.get_rename_preview(input_path)
            if not tool_input.get("dry_run") and "proposed" in preview:
                result = service.organize_file(input_path, preview["proposed"])
                return json.dumps(result)
            return json.dumps(preview)
        else:
            files = service.scan_downloads()
            return json.dumps(files)

    elif tool_name == "fetch_metadata":
        service = MetadataService()
        media_type = tool_input.get("media_type", "movie")
        if media_type == "tv":
            results = await service.search_tv(tool_input["title"])
        else:
            results = await service.search_movie(
                tool_input["title"],
                tool_input.get("year"),
            )
        return json.dumps(results)

    elif tool_name == "sync_jellyfin":
        service = JellyfinService()
        result = await service.trigger_library_scan(tool_input.get("library"))
        return json.dumps(result)

    elif tool_name == "llm_disambiguation":
        return json.dumps({
            "action": "requires_user_input",
            "question": tool_input["question"],
            "options": tool_input["options"],
        })

    return json.dumps({"error": f"Unknown tool: {tool_name}"})
