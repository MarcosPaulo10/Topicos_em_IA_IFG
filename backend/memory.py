import os
import re

from dotenv import load_dotenv
from sqlalchemy.orm import Session

from database import SessionModel, get_history
from llm import is_contaminated, is_valid_user_name

load_dotenv()

MAX_HISTORY_MESSAGES = int(os.getenv("MAX_HISTORY_MESSAGES", "10"))
MAX_CONTEXT_TOKENS = int(os.getenv("MAX_CONTEXT_TOKENS", "3000"))
MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * 4

_BRIEF_KEYWORDS = re.compile(
    r"\b(curta?s?|concis[ao]|rápid[ao]|breve|resum[oa]|objetiv[ao])\b",
    re.I,
)


def _user_wants_brief(message: str, history: list) -> bool:
    if _BRIEF_KEYWORDS.search(message):
        return True
    for msg in reversed(history[-6:]):
        if msg.role == "user" and _BRIEF_KEYWORDS.search(msg.content):
            return True
    return False


def build_system_prompt(session: SessionModel, *, brief: bool = False) -> str:
    parts = [
        "Você é um assistente local simples, sem marca, sem produto, sem persona fictícia.",
        "Responda SOMENTE em português do Brasil.",
        "Nunca invente empresas, marcas (WiseBotica, TechHub, etc.), fóruns ou personagens.",
        "Nunca escreva em espanhol. Nunca faça roleplay. Nunca repita perguntas entre aspas.",
    ]

    if brief:
        parts.append("O usuário pediu respostas CURTAS: máximo 1-2 frases diretas.")

    if is_valid_user_name(session.user_name):
        parts.append(f"O nome do usuário é {session.user_name}.")

    if session.context_text:
        context = session.context_text
        if len(context) > MAX_CONTEXT_CHARS:
            context = context[:MAX_CONTEXT_CHARS] + "\n[Conteúdo truncado — arquivo muito longo]"
        parts.append(
            "Conteúdo fornecido pelo usuário para consulta:\n"
            f"---\n{context}\n---"
        )

    return " ".join(parts)


def build_messages_array(
    db: Session,
    session: SessionModel,
    new_user_message: str,
) -> tuple[list[dict[str, str]], bool]:
    history = get_history(db, session.id, MAX_HISTORY_MESSAGES)
    brief = _user_wants_brief(new_user_message, history)

    messages: list[dict[str, str]] = [
        {"role": "system", "content": build_system_prompt(session, brief=brief)},
    ]

    for msg in history:
        if is_contaminated(msg.content):
            continue
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": new_user_message})
    return messages, brief
