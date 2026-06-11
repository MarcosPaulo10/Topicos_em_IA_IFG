import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session

from database import (
    clear_session_context,
    create_session,
    delete_session,
    get_db,
    get_session,
    init_db,
    list_sessions,
    save_message,
    update_session_context,
    update_user_name,
)
from llm import (
    FALLBACK_REPLY,
    OllamaError,
    chat_with_ollama,
    extract_name_from_message,
    is_contaminated,
    is_valid_user_name,
)
from memory import build_messages_array
from schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    MessageInfo,
    SessionContextRequest,
    SessionContextResponse,
    SessionDetail,
    SessionInfo,
)

load_dotenv()

APP_PORT = int(os.getenv("APP_PORT", "8000"))

app = FastAPI(title="Assistente IA Local", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger(__name__)


@app.on_event("startup")
def on_startup():
    data_dir = Path(__file__).parent / "data"
    data_dir.mkdir(exist_ok=True)
    init_db()


def _generate_title(message: str) -> str:
    words = message.strip().split()[:5]
    title = " ".join(words)
    return title if title else "Nova conversa"


@app.api_route("/health", methods=["GET", "HEAD"], response_model=HealthResponse)
def health(request: Request):
    if request.method == "HEAD":
        return Response(status_code=200)
    return HealthResponse(status="ok")


@app.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
):
    session = None

    if request.session_id:
        session = get_session(db, request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")
        if request.context_text and not session.context_text:
            update_session_context(
                db,
                session.id,
                request.context_type or "pdf",
                request.context_text,
                request.context_filename or "documento.pdf",
            )
            session = get_session(db, session.id)
    else:
        title = _generate_title(request.message)
        context_type = request.context_type or ("pdf" if request.context_text else "chat")
        session = create_session(db, request.model, title, context_type=context_type)

        if request.context_text:
            update_session_context(
                db,
                session.id,
                context_type,
                request.context_text,
                request.context_filename or "documento.pdf",
            )
            session = get_session(db, session.id)

    messages_array, brief = build_messages_array(db, session, request.message)

    try:
        reply = await chat_with_ollama(messages_array, session.model, brief=brief)
    except OllamaError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    if not reply.strip() or is_contaminated(reply):
        reply = FALLBACK_REPLY

    save_message(db, session.id, "user", request.message)
    save_message(db, session.id, "assistant", reply)

    if not is_valid_user_name(session.user_name):
        name = extract_name_from_message(request.message)
        if name:
            update_user_name(db, session.id, name)

    session = get_session(db, session.id)
    return ChatResponse(
        session_id=session.id,
        reply=reply,
        session_title=session.title,
    )


@app.get("/sessions", response_model=list[SessionInfo])
def get_sessions(db: Session = Depends(get_db)):
    sessions = list_sessions(db)
    return [SessionInfo.model_validate(s) for s in sessions]


@app.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session_detail(session_id: str, db: Session = Depends(get_db)):
    session = get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    return SessionDetail(
        id=session.id,
        title=session.title,
        model=session.model,
        user_name=session.user_name,
        context_type=session.context_type,
        context_filename=session.context_filename,
        context_text=session.context_text,
        updated_at=session.updated_at,
        messages=[MessageInfo.model_validate(m) for m in session.messages],
    )


@app.delete("/sessions/{session_id}", status_code=204)
def remove_session(session_id: str, db: Session = Depends(get_db)):
    if not delete_session(db, session_id):
        raise HTTPException(status_code=404, detail="Sessão não encontrada")


@app.post("/sessions/{session_id}/context", response_model=SessionContextResponse)
def set_session_context(
    session_id: str,
    body: SessionContextRequest,
    db: Session = Depends(get_db),
):
    session = get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    update_session_context(
        db,
        session_id,
        body.context_type,
        body.context_text,
        body.context_filename,
    )
    return SessionContextResponse(
        id=session_id,
        context_type=body.context_type,
        context_filename=body.context_filename,
    )


@app.delete("/sessions/{session_id}/context", status_code=204)
def remove_session_context(session_id: str, db: Session = Depends(get_db)):
    session = get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    clear_session_context(db, session_id)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=APP_PORT, reload=True)
