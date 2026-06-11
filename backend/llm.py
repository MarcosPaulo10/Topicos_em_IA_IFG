import os
import re

import httpx
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_TIMEOUT = 120.0
OLLAMA_MAX_TOKENS = int(os.getenv("OLLAMA_MAX_TOKENS", "200"))

# Sinais de resposta degenerada (Phi-3 inventa marcas/personas do dataset de treino)
_CONTAMINATION_MARKERS = (
    "wisebotica",
    "techhub",
    "virtualização global",
    "virtualizacao global",
    "portal de engajamento",
    "pregunta de seguimiento",
    "si la respuesta",
    "instrucción",
    "™",
    "ecossistema digitalizador",
    "vgt ",
    " forum ",
    "fórum ",
    "null",
    "nome virtual",
    "pseudônimo",
    "pseudonimo",
)

_CUTOFF_PATTERNS = [
    r"\nPregunta de seguimiento",
    r"\nSi la respuesta",
    r"\nInstrucción",
    r"\nWiseBotica",
    r"\n#{1,3}\s*Instruc",
    r"<\|[^|]+\|>",
    r"\n---+\n",
    r"\nCordialmente,",
    r"\nCom licença,",
    r"\nOuça este aviso",
    r"\nMarcos Paulo é",
    r"\nNosso jogo virtual",
    r"\nAjam juntos",
    r"\nEmbora seu nome",
    r"\nÉ importante reconhecer",
    r"\nCom essa abordagem",
    r"\nSeu verdadeiro nome",
    r'"\w[^"]*"\s*–',  # padrão "pergunta?" – lixo roleplay
]

_NAME_PATTERNS = [
    re.compile(
        r"(?:meu nome (?:é|e)|me chame (?:de )?|pode me chamar de )"
        r"([A-Za-zÀ-ÿ]+(?: [A-Za-zÀ-ÿ]+){0,2})",
        re.I,
    ),
    re.compile(r"(?:sou o|sou a) ([A-Za-zÀ-ÿ]+(?: [A-Za-zÀ-ÿ]+){0,2})", re.I),
]


def is_contaminated(text: str) -> bool:
    if not text or len(text) > 1500:
        return True
    lower = text.lower()
    hits = sum(1 for m in _CONTAMINATION_MARKERS if m in lower)
    if hits >= 1 and len(text) > 120:
        return True
    if hits >= 2:
        return True
    if lower.count('"') >= 4 and len(text) > 200:
        return True
    return False


def is_valid_user_name(name: str | None) -> bool:
    if not name or len(name) > 50:
        return False
    if is_contaminated(name):
        return False
    if not re.match(r"^[A-Za-zÀ-ÿ]+( [A-Za-zÀ-ÿ]+){0,2}$", name.strip()):
        return False
    invalid = {"ok", "sim", "nao", "não", "null", "none", "usuario", "usuário"}
    return name.strip().lower() not in invalid


def clean_model_response(text: str) -> str:
    cleaned = text.strip()

    earliest = len(cleaned)
    for pattern in _CUTOFF_PATTERNS:
        match = re.search(pattern, cleaned, re.IGNORECASE)
        if match and match.start() < earliest:
            earliest = match.start()
    if earliest < len(cleaned):
        cleaned = cleaned[:earliest].strip()

    if is_contaminated(cleaned):
        sentences = re.split(r"(?<=[.!?])\s+", cleaned)
        safe = [s for s in sentences if s and not is_contaminated(s)]
        cleaned = " ".join(safe[:2]).strip()

    return cleaned


class OllamaError(Exception):
    def __init__(self, message: str, status_code: int = 503):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _ollama_options(model: str, brief: bool = False) -> dict:
    max_tokens = 80 if brief else OLLAMA_MAX_TOKENS
    opts = {
        "num_predict": max_tokens,
        "repeat_penalty": 1.25,
        "top_k": 40,
        "top_p": 0.85,
    }
    if model.startswith("phi3"):
        opts["temperature"] = 0.1
        opts["stop"] = [
            "WiseBotica",
            "TechHub",
            "Pregunta de seguimiento",
            "Instrucción",
            "Virtualização Global",
            "\n\n",
        ]
    else:
        opts["temperature"] = 0.5
    return opts


async def chat_with_ollama(
    messages: list[dict[str, str]],
    model: str,
    *,
    brief: bool = False,
) -> str:
    url = f"{OLLAMA_BASE_URL}/api/chat"
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": _ollama_options(model, brief=brief),
    }

    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            response = await client.post(url, json=payload)
    except httpx.ConnectError:
        raise OllamaError(
            "Ollama não está acessível. Verifique se está instalado e rodando.",
            status_code=503,
        )
    except httpx.TimeoutException:
        raise OllamaError(
            "Tempo de resposta excedido. Tente novamente.",
            status_code=504,
        )

    if response.status_code == 404:
        raise OllamaError(
            f"Modelo '{model}' não encontrado. Rode `ollama pull {model}` no terminal.",
            status_code=404,
        )

    if response.status_code != 200:
        raise OllamaError(
            f"Erro ao chamar Ollama: {response.text}",
            status_code=502,
        )

    data = response.json()
    content = data.get("message", {}).get("content", "")
    return clean_model_response(content)


def extract_name_from_message(message: str) -> str | None:
    """Extrai nome por regex — não usa LLM (evita lixo tipo NULL/WiseBotica)."""
    for pattern in _NAME_PATTERNS:
        match = pattern.search(message)
        if match:
            name = " ".join(w.capitalize() for w in match.group(1).split())
            if is_valid_user_name(name):
                return name
    return None


FALLBACK_REPLY = (
    "Desculpe, o modelo gerou uma resposta inválida. "
    "Inicie uma nova conversa e use LLaMA 3 (Phi-3 tende a degenerar)."
)
