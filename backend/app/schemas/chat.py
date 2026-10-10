from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatDocument(BaseModel):
    source: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=20000)


class ChatRequest(BaseModel):
    text: str = Field(min_length=1, max_length=6000)
    documents: list[ChatDocument] = Field(default_factory=list, max_length=5)


class ChatResponse(BaseModel):
    type: Literal["text", "widget", "error"]
    message: str
    spec: dict[str, Any] | None = None
