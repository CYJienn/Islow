from __future__ import annotations

from datetime import date as Date, datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator


class Business(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    industry: str = Field(min_length=1, max_length=80)
    location: str = Field(min_length=1, max_length=120)
    products: list[str] = Field(min_length=1, max_length=20)
    target_customers: str = Field(min_length=1, max_length=200)
    marketing_budget_rm: float = Field(gt=0)
    objective: str = Field(min_length=1, max_length=300)
    channels: list[str] = Field(min_length=1, max_length=10)
    competitor_names: list[str] = Field(default_factory=list, max_length=3)


class Review(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    language: str = "en"
    source: str = "provided"
    date: Date | None = None

    @field_validator("text")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("review text is empty")
        return value


class AnalyzeRequest(BaseModel):
    task_id: str = Field(min_length=1, max_length=100)
    business: Business
    reviews: list[Review] = Field(default_factory=list, max_length=200)
    research_mode: Literal["demo", "live"] = "demo"
    document_evidence: list[Finding] = Field(default_factory=list, max_length=5)


class SentimentReport(BaseModel):
    processed_count: int = 0
    excluded_count: int = 0
    positive_count: int = 0
    neutral_count: int = 0
    negative_count: int = 0
    positive_pct: float | None = None
    neutral_pct: float | None = None
    negative_pct: float | None = None
    model_status: Literal["available", "unavailable"] = "unavailable"
    five_star_counts: dict[str, int] = Field(default_factory=dict)
    representative_reviews: list[dict] = Field(default_factory=list)
    inference_latency_ms: int = 0
    batch_count: int = 0


class Finding(BaseModel):
    evidence_id: str
    competitor: str
    fact: str
    source_url: str | None = None
    retrieved_at: str
    evidence_type: str
    threat_level: Literal["low", "medium", "high", "unknown"] = "unknown"
    publication_date: str | None = None
    title: str | None = None


class DraftCampaign(BaseModel):
    name: str = Field(min_length=1)
    objective: str = Field(min_length=1)
    target_audience: str = Field(min_length=1)
    channel: str = Field(min_length=1)
    idea: str = Field(min_length=1)
    sample_caption: str = Field(min_length=1)
    duration_days: int = Field(gt=0, le=365)
    estimated_budget_rm: float = Field(gt=0)
    kpi: str = Field(min_length=1)
    evidence_ids: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    customer_alignment: int = Field(ge=0, le=5)
    differentiation: int = Field(ge=0, le=5)
    feasibility: int = Field(ge=0, le=5)
    customer_alignment_reason: str = "Subjective assessment"
    differentiation_reason: str = "Subjective assessment"
    feasibility_reason: str = "Subjective assessment"


class RankedCampaign(BaseModel):
    rank: int
    name: str
    objective: str
    target_audience: str
    channel: str
    idea: str
    sample_caption: str
    duration_days: int
    estimated_budget_rm: float
    kpi: str
    evidence_ids: list[str]
    assumptions: list[str]
    suitability_score: float
    score_breakdown: dict[str, int]
    customer_alignment_reason: str
    differentiation_reason: str
    feasibility_reason: str
    ranking_rationale: str
    approval_required: bool = True


class Execution(BaseModel):
    sentiment_engine: str = "unavailable"
    research_engine: str = "unavailable"
    strategy_engine: str = "unavailable"
    search_calls: int = 0
    llm_calls: int = 0
    sentiment_inference_count: int = 0
    elapsed_ms: int = 0
    llm_tokens: int | None = None


class Report(BaseModel):
    task_id: str
    status: Literal["completed", "partial"]
    data_mode: Literal["demo", "live", "mixed"]
    business_name: str
    sentiment: SentimentReport
    competitor_findings: list[Finding]
    document_evidence: list[Finding] = Field(default_factory=list)
    ranked_campaigns: list[RankedCampaign]
    unavailable_metrics: list[str] = ["competitor_conversion_rate", "checkout_rate", "actual_sales_uplift"]
    warnings: list[str]
    execution: Execution
    generated_at: datetime
