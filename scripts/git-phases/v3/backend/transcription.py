import logging
import os
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

TEMP_DIR = Path(__file__).parent / "temp"
MAX_FILE_BYTES = 100 * 1024 * 1024
ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".mp4"}
WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
MAX_CONTEXT_TOKENS = int(os.getenv("MAX_CONTEXT_TOKENS", "3000"))
MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * 4

_model = None
_model_load_error: str | None = None


def cleanup_orphan_temp_files(max_age_seconds: int = 3600) -> None:
    TEMP_DIR.mkdir(exist_ok=True)
    now = time.time()
    for path in TEMP_DIR.iterdir():
        if not path.is_file():
            continue
        try:
            if now - path.stat().st_mtime > max_age_seconds:
                path.unlink()
                logger.info("Arquivo temporário removido: %s", path.name)
        except OSError as exc:
            logger.warning("Não foi possível remover %s: %s", path, exc)


def load_whisper_model() -> None:
    global _model, _model_load_error
    if _model is not None or _model_load_error is not None:
        return
    try:
        import whisper

        logger.info("Carregando modelo Whisper '%s'...", WHISPER_MODEL_NAME)
        _model = whisper.load_model(WHISPER_MODEL_NAME)
        logger.info("Modelo Whisper carregado.")
    except Exception as exc:
        _model_load_error = str(exc)
        logger.exception("Falha ao carregar Whisper")


def is_whisper_ready() -> bool:
    return _model is not None


def get_model():
    if _model is None and _model_load_error is None:
        load_whisper_model()
    return _model


def save_temp_file(filename: str, content: bytes) -> Path:
    TEMP_DIR.mkdir(exist_ok=True)
    safe_name = Path(filename).name
    dest = TEMP_DIR / f"{uuid.uuid4().hex}_{safe_name}"
    dest.write_bytes(content)
    return dest


def delete_temp_file(file_path: str | Path) -> None:
    try:
        Path(file_path).unlink(missing_ok=True)
    except OSError as exc:
        logger.warning("Não foi possível deletar %s: %s", file_path, exc)


def _truncate_text(text: str) -> tuple[str, bool, str | None]:
    if len(text) <= MAX_CONTEXT_CHARS:
        return text, False, None
    truncated = text[:MAX_CONTEXT_CHARS]
    warning = (
        f"Transcrição truncada para {MAX_CONTEXT_CHARS:,} caracteres "
        "(áudio muito longo para o contexto do modelo)."
    )
    return truncated + "\n[Conteúdo truncado — áudio muito longo]", True, warning


def transcribe_audio(file_path: str | Path) -> dict:
    model = get_model()
    if model is None:
        err = _model_load_error or "Modelo não carregado"
        if "ffmpeg" in err.lower() or "No such file" in err:
            raise RuntimeError("FFmpeg não está instalado. Verifique a instalação.")
        raise RuntimeError("Serviço de transcrição indisponível.")

    path = str(file_path)
    try:
        result = model.transcribe(path, language=None)
    except FileNotFoundError as exc:
        if "ffmpeg" in str(exc).lower():
            raise RuntimeError("FFmpeg não está instalado. Verifique a instalação.") from exc
        raise
    except Exception as exc:
        msg = str(exc).lower()
        if "ffmpeg" in msg:
            raise RuntimeError("FFmpeg não está instalado. Verifique a instalação.") from exc
        raise RuntimeError("Não foi possível processar o arquivo de áudio.") from exc

    text = (result.get("text") or "").strip()
    if not text:
        raise RuntimeError("Não foi possível processar o arquivo de áudio.")

    language = result.get("language") or "unknown"
    segments = result.get("segments") or []
    duration_seconds = 0.0
    if segments:
        duration_seconds = float(segments[-1].get("end", 0))

    text, was_truncated, warning = _truncate_text(text)
    word_count = len(text.split())

    preview_lines = text.splitlines()[:3]
    if not preview_lines:
        preview_lines = [text[:200]]

    return {
        "text": text,
        "language": language,
        "duration_seconds": duration_seconds,
        "word_count": word_count,
        "truncated": was_truncated,
        "warning": warning,
        "preview_lines": preview_lines,
    }
