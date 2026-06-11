from datetime import datetime

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    session_id: str | None = None
    message: str
    model: str = "phi3"


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    session_title: str


class SessionInfo(BaseModel):
    id: str
    title: str
    model: str
    user_name: str | None
    context_type: str
    context_filename: str | None = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageInfo(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionDetail(BaseModel):
    id: str
    title: str
    model: str
    user_name: str | None
    context_type: str
    context_filename: str | None = None
    updated_at: datetime
    messages: list[MessageInfo] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class HealthResponse(BaseModel):
    status: str
