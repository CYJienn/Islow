from datetime import datetime, timezone
from functools import lru_cache
from time import monotonic

from langgraph.graph import END, START, StateGraph

from .competitor_search import normalize, search
from .config import get_settings
from .ranking import rank
from .schemas import AnalyzeRequest, Execution, Finding, Report, SentimentReport
from .sentiment import analyze_reviews
from .state import MarketingState
from .strategy import generate


def validate_input(state: MarketingState) -> dict:
    AnalyzeRequest.model_validate(state["request"])
    return {}


def load_reviews(state: MarketingState) -> dict:
    request = AnalyzeRequest.model_validate(state["request"])
    warnings = [] if request.reviews else ["No reviews supplied; sentiment percentages unavailable."]
    return {"clean_reviews": [r.model_dump(mode="json") for r in request.reviews], "review_warnings": warnings}


def analyze_sentiment(state: MarketingState) -> dict:
    from .schemas import Review
    reviews = [Review.model_validate(r) for r in state["clean_reviews"]]
    settings = get_settings()
    model_ref = settings.sentiment_model_id if settings.sentiment_model_source == "hub" else str(settings.sentiment_model_path)
    sentiment, warnings, count = analyze_reviews(reviews, model_ref)
    engine = "huggingface_distilbert" if settings.sentiment_model_source == "hub" else "local_distilbert"
    return {"sentiment": sentiment.model_dump(), "sentiment_engine": engine if sentiment.model_status == "available" and count else "unavailable", "sentiment_inference_count": count, "review_warnings": state["review_warnings"] + warnings}


def search_competitors(state: MarketingState) -> dict:
    request = AnalyzeRequest.model_validate(state["request"])
    raw, engine, calls, warnings = search(request, get_settings())
    return {"competitor_raw": raw, "research_engine": engine, "search_calls": calls, "search_warnings": warnings}


def analyze_competitors(state: MarketingState) -> dict:
    request = AnalyzeRequest.model_validate(state["request"])
    findings, warnings = normalize(state["competitor_raw"], request.research_mode, get_settings().max_search_results, request.business)
    findings = request.document_evidence + findings
    return {"competitor_findings": [f.model_dump() for f in findings], "competitor_warnings": state["search_warnings"] + warnings}


def generate_campaigns(state: MarketingState) -> dict:
    request = AnalyzeRequest.model_validate(state["request"])
    sentiment = SentimentReport.model_validate(state["sentiment"])
    findings = [Finding.model_validate(f) for f in state["competitor_findings"]]
    drafts, engine, calls, warnings, tokens = generate(request, sentiment, findings, get_settings())
    return {"draft_campaigns": [d.model_dump() for d in drafts], "strategy_engine": engine, "llm_calls": calls, "llm_tokens": tokens, "strategy_warnings": warnings}


def rank_campaigns(state: MarketingState) -> dict:
    from .schemas import DraftCampaign
    request = AnalyzeRequest.model_validate(state["request"])
    drafts = [DraftCampaign.model_validate(d) for d in state["draft_campaigns"]]
    findings = [Finding.model_validate(f) for f in state["competitor_findings"]]
    ranked, warnings = rank(drafts, request.business.marketing_budget_rm, SentimentReport.model_validate(state["sentiment"]), findings)
    return {"ranked_campaigns": [c.model_dump() for c in ranked], "ranking_warnings": warnings}


def build_report(state: MarketingState) -> dict:
    request = AnalyzeRequest.model_validate(state["request"])
    warnings = state["review_warnings"] + state["competitor_warnings"] + state["strategy_warnings"] + state["ranking_warnings"]
    engines = (state["sentiment_engine"], state["research_engine"], state["strategy_engine"])
    fixtures = "fixture" in engines
    real = any(e in engines for e in ("local_distilbert", "huggingface_distilbert", "tavily_live", "configured_llm"))
    mode = "mixed" if fixtures and real else "demo" if fixtures else "live" if request.research_mode == "live" else "demo"
    complete = (len(state["ranked_campaigns"]) == 3
                and state["research_engine"] != "unavailable"
                and state["strategy_engine"] != "unavailable"
                and state["sentiment_engine"] != "unavailable"
                and (request.research_mode != "live" or (bool(state["competitor_findings"]) and not state["search_warnings"])))
    report = Report(task_id=request.task_id, status="completed" if complete else "partial", data_mode=mode,
                    business_name=request.business.name, sentiment=SentimentReport.model_validate(state["sentiment"]),
                    competitor_findings=[Finding.model_validate(f) for f in state["competitor_findings"] if f["evidence_type"] != "provided_document"],
                    document_evidence=request.document_evidence,
                    ranked_campaigns=state["ranked_campaigns"], warnings=warnings,
                    execution=Execution(sentiment_engine=state["sentiment_engine"], research_engine=state["research_engine"],
                                        strategy_engine=state["strategy_engine"], search_calls=state["search_calls"],
                                        llm_calls=state["llm_calls"], sentiment_inference_count=state["sentiment_inference_count"],
                                        elapsed_ms=max(0, round((monotonic() - state["started_at"]) * 1000)), llm_tokens=state["llm_tokens"]),
                    generated_at=datetime.now(timezone.utc))
    return {"report": report.model_dump(mode="json")}


@lru_cache(maxsize=1)
def graph():
    builder = StateGraph(MarketingState)
    for name, fn in (("validate_input", validate_input), ("load_reviews", load_reviews),
                     ("analyze_sentiment", analyze_sentiment), ("search_competitors", search_competitors),
                     ("analyze_competitors", analyze_competitors), ("generate_campaigns", generate_campaigns),
                     ("rank_campaigns", rank_campaigns), ("build_report", build_report)):
        builder.add_node(name, fn)
    builder.add_edge(START, "validate_input")
    builder.add_edge("validate_input", "load_reviews")
    builder.add_edge("validate_input", "search_competitors")
    builder.add_edge("load_reviews", "analyze_sentiment")
    builder.add_edge("search_competitors", "analyze_competitors")
    builder.add_edge(["analyze_sentiment", "analyze_competitors"], "generate_campaigns")
    builder.add_edge("generate_campaigns", "rank_campaigns")
    builder.add_edge("rank_campaigns", "build_report")
    builder.add_edge("build_report", END)
    return builder.compile()


def analyze(request: AnalyzeRequest) -> Report:
    result = graph().invoke({"request": request.model_dump(mode="json"), "started_at": monotonic()})
    return Report.model_validate(result["report"])
