import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/chat.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False, default="Nova conversa")
    user_name = Column(String, nullable=True)
    model = Column(String, nullable=False, default="phi3")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    context_type = Column(String, nullable=False, default="chat")
    context_text = Column(Text, nullable=True)
    context_filename = Column(String, nullable=True)

    messages = relationship(
        "MessageModel",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="MessageModel.created_at",
    )


class MessageModel(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("SessionModel", back_populates="messages")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)


def create_session(db: Session, model: str, title: str, context_type: str = "chat") -> SessionModel:
    session = SessionModel(model=model, title=title, context_type=context_type)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_session(db: Session, session_id: str) -> SessionModel | None:
    return db.query(SessionModel).filter(SessionModel.id == session_id).first()


def list_sessions(db: Session) -> list[SessionModel]:
    return db.query(SessionModel).order_by(SessionModel.updated_at.desc()).all()


def delete_session(db: Session, session_id: str) -> bool:
    session = get_session(db, session_id)
    if not session:
        return False
    db.delete(session)
    db.commit()
    return True


def save_message(db: Session, session_id: str, role: str, content: str) -> MessageModel:
    message = MessageModel(session_id=session_id, role=role, content=content)
    db.add(message)
    session = get_session(db, session_id)
    if session:
        session.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(message)
    return message


def get_history(db: Session, session_id: str, limit: int) -> list[MessageModel]:
    messages = (
        db.query(MessageModel)
        .filter(MessageModel.session_id == session_id)
        .order_by(MessageModel.created_at.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(messages))


def update_user_name(db: Session, session_id: str, name: str) -> None:
    session = get_session(db, session_id)
    if session:
        session.user_name = name
        db.commit()


def update_session_title(db: Session, session_id: str, title: str) -> None:
    session = get_session(db, session_id)
    if session:
        session.title = title
        db.commit()


def update_session_context(
    db: Session,
    session_id: str,
    context_type: str,
    context_text: str,
    context_filename: str,
) -> None:
    session = get_session(db, session_id)
    if session:
        session.context_type = context_type
        session.context_text = context_text
        session.context_filename = context_filename
        db.commit()


def clear_session_context(db: Session, session_id: str) -> None:
    session = get_session(db, session_id)
    if session:
        session.context_type = "chat"
        session.context_text = None
        session.context_filename = None
        db.commit()
