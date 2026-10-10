from typing import Any, Literal

from marketing_agent.schemas import Review

from pydantic import BaseModel, Field


class ChatDocument(BaseModel):
    source: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=20000)


class ChatRequest(BaseModel):
    text: str = Field(min_length=1, max_length=6000)
    documents: list[ChatDocument] = Field(default_factory=list, max_length=5)
    marketing: "ChatMarketing | None" = None


class ChatMarketing(BaseModel):
    business: dict[str, Any] | None = None
    reviews: list[Review] = Field(default_factory=list, max_length=200)
    research_mode: Literal["live", "demo"] = "live"


class ChatResponse(BaseModel):
    type: Literal["text", "widget", "error"]
    message: str
    spec: dict[str, Any] | None = None
