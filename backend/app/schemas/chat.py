from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    text: str = Field(min_length=1, max_length=6000)


class ChatResponse(BaseModel):
    type: Literal["text", "widget", "error"]
    message: str
    spec: dict[str, Any] | None = None
