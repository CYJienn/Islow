from typing import Any, Literal

from marketing_agent.schemas import Review

from pydantic import BaseModel, Field, model_validator
import json


class ChatDocument(BaseModel):
    source: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=20000)


class ChatRequest(BaseModel):
    text: str = Field(min_length=1, max_length=6000)
    documents: list[ChatDocument] = Field(default_factory=list, max_length=5)
    seated: list[str] | None = None  # agents at the round table; the manager only calls these
    marketing: "ChatMarketing | None" = None
    finance: "ChatFinance | None" = None


class ChatMarketing(BaseModel):
    optional: bool = False  # True: only used if the manager itself picks marketing (does not force it)
    business: dict[str, Any] | None = None
    reviews: list[Review] = Field(default_factory=list, max_length=200)
    research_mode: Literal["live", "demo"] = "live"


class ChatFinance(BaseModel):
    mode: Literal["configured", "demo"] = "configured"
    report: dict[str, Any] | None = None

    @model_validator(mode="after")
    def validate_report(self):
        if self.report is not None:
            if len(json.dumps(self.report)) > 40000:
                raise ValueError("Finance report preview exceeds 40 KB")
            if not isinstance(self.report.get("report_id"), str) or not isinstance(self.report.get("batch_results"), dict):
                raise ValueError("Attach a generated finance report with report_id and batch_results")
        return self


class ChatTurn(BaseModel):
    agent: str
    text: str


class ChatResponse(BaseModel):
    type: Literal["text", "widget", "error"]
    message: str
    spec: dict[str, Any] | None = None
    council: bool = False  # True when the manager needed several specialists: the UI opens the round table
    turns: list[ChatTurn] = Field(default_factory=list)  # one entry per specialist, then the manager: the round table plays these
