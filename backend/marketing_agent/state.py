from typing import TypedDict


class MarketingState(TypedDict, total=False):
    request: dict
    started_at: float
    clean_reviews: list[dict]
    review_warnings: list[str]
    sentiment: dict
    sentiment_engine: str
    sentiment_inference_count: int
    competitor_raw: list[dict]
    research_engine: str
    search_calls: int
    search_warnings: list[str]
    competitor_findings: list[dict]
    competitor_warnings: list[str]
    draft_campaigns: list[dict]
    strategy_engine: str
    llm_calls: int
    llm_tokens: int | None
    strategy_warnings: list[str]
    ranked_campaigns: list[dict]
    ranking_warnings: list[str]
    report: dict
