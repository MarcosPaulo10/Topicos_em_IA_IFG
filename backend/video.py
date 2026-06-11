import json
import logging
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

MAX_VIDEO_BYTES = 500 * 1024 * 1024
VIDEO_EXTENSION = ".mp4"

FFMPEG_CANDIDATES = [
    "ffmpeg",
    r"C:\ffmpeg\bin\ffmpeg.exe",
    r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
]

FFPROBE_CANDIDATES = [
    "ffprobe",
    r"C:\ffmpeg\bin\ffprobe.exe",
    r"C:\Program Files\ffmpeg\bin\ffprobe.exe",
]

_ffmpeg_path: str | None = None
_ffprobe_path: str | None = None


def _resolve_binary(candidates: list[str]) -> str | None:
    for candidate in candidates:
        if Path(candidate).suffix and Path(candidate).is_file():
            return candidate
        found = shutil.which(candidate)
        if found:
            return found
    return None


def get_ffmpeg() -> str:
    global _ffmpeg_path
    if _ffmpeg_path is None:
        _ffmpeg_path = _resolve_binary(FFMPEG_CANDIDATES)
    if not _ffmpeg_path:
        raise RuntimeError("FFmpeg não está instalado. Veja o README.")
    return _ffmpeg_path


def get_ffprobe() -> str:
    global _ffprobe_path
    if _ffprobe_path is None:
        _ffprobe_path = _resolve_binary(FFPROBE_CANDIDATES)
    if not _ffprobe_path:
        raise RuntimeError("FFmpeg não está instalado. Veja o README.")
    return _ffprobe_path


def get_video_duration(video_path: str | Path) -> float:
    video_path = Path(video_path)
    cmd = [
        get_ffprobe(),
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        str(video_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        return 0.0
    try:
        data = json.loads(result.stdout or "{}")
        return float(data.get("format", {}).get("duration", 0))
    except (ValueError, TypeError):
        return 0.0


def extract_audio_from_video(video_path: str | Path) -> Path:
    video_path = Path(video_path)
    audio_path = video_path.parent / f"{video_path.stem}_audio.mp3"

    cmd = [
        get_ffmpeg(),
        "-i",
        str(video_path),
        "-vn",
        "-acodec",
        "libmp3lame",
        "-q:a",
        "4",
        str(audio_path),
        "-y",
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    stderr = (result.stderr or "").lower()

    if result.returncode != 0:
        if "does not contain any stream" in stderr or "no audio" in stderr:
            raise RuntimeError("Este vídeo não contém áudio.")
        if "invalid data" in stderr or "could not find codec" in stderr:
            raise RuntimeError("Não foi possível processar o arquivo de vídeo.")
        logger.error("FFmpeg stderr: %s", result.stderr)
        raise RuntimeError("Não foi possível processar o arquivo de vídeo.")

    if not audio_path.is_file() or audio_path.stat().st_size == 0:
        raise RuntimeError("Este vídeo não contém áudio.")

    return audio_path
