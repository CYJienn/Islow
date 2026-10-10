import json
from pathlib import Path

from fastapi.testclient import TestClient

from marketing_agent import sentiment
from marketing_agent.api import app
from marketing_agent.competitor_search import normalize
from marketing_agent.config import get_settings
from marketing_agent.graph import analyze
from marketing_agent.schemas import AnalyzeRequest, DraftCampaign, Finding, SentimentReport
from marketing_agent.ranking import rank
from app.main import app as backend_app
from marketing_agent.strategy import generate
from marketing_agent.config import Settings


FIXTURES = Path(__file__).parents[1] / "marketing_agent" / "fixtures"


def request():
    return AnalyzeRequest.model_validate_json((FIXTURES / "demo_request.json").read_text(encoding="utf-8"))


def test_health_and_demo_missing_model(monkeypatch):
    monkeypatch.setenv("SENTIMENT_MODEL_PATH", "missing-model")
    get_settings.cache_clear()
    client = TestClient(app)
    assert client.get("/health").json() == {"status": "ok", "service": "growthlab-marketing", "version": "1"}
    response = client.post("/marketing/analyze", json=request().model_dump(mode="json"))
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "partial"
    assert len(body["ranked_campaigns"]) == 3
    assert body["execution"]["sentiment_engine"] == "unavailable"
    assert body["execution"]["research_engine"] == "fixture"
    assert body["execution"]["strategy_engine"] == "fixture"
    assert body["execution"]["search_calls"] == body["execution"]["llm_calls"] == 0
    assert body["sentiment"]["positive_pct"] is None
    assert body["generated_at"]


def test_unified_backend_exposes_marketing_routes():
    client = TestClient(backend_app)
    assert client.get("/api/v1/health").status_code == 200
    assert client.get("/health").json()["service"] == "growthlab-marketing"
    assert client.post("/marketing/analyze", json=request().model_dump(mode="json")).status_code == 200


def test_shared_gemini_key_setting(monkeypatch):
    monkeypatch.setenv("GOOGLE_API_KEY", "shared-test-key")
    assert Settings(_env_file=None).google_api_key == "shared-test-key"


def test_auth_and_invalid_request(monkeypatch):
    monkeypatch.setenv("MARKETING_API_TOKEN", "test-secret")
    get_settings.cache_clear()
    client = TestClient(app)
    assert client.post("/marketing/analyze", json=request().model_dump(mode="json")).status_code == 401
    assert client.post("/marketing/analyze", json=request().model_dump(mode="json"), headers={"Authorization": "Bearer bad"}).status_code == 401
    assert client.post("/marketing/analyze", json={"task_id": "x"}, headers={"Authorization": "Bearer test-secret"}).status_code == 422
    monkeypatch.delenv("MARKETING_API_TOKEN")
    get_settings.cache_clear()


def test_live_never_uses_fixtures(monkeypatch):
    for key in ("TAVILY_API_KEY", "GOOGLE_API_KEY", "GEMINI_MODEL"):
        monkeypatch.setenv(key, "")
    get_settings.cache_clear()
    payload = request().model_copy(update={"research_mode": "live", "reviews": []})
    report = analyze(payload)
    assert report.status == "partial"
    assert report.competitor_findings == [] and report.ranked_campaigns == []
    assert report.execution.research_engine == "unavailable"
    assert report.execution.strategy_engine == "unavailable"


def test_sentiment_aggregation_and_exclusions(monkeypatch):
    monkeypatch.setattr(sentiment, "predict_stars", lambda texts, path: ([1, 5], 1))
    reviews = request().reviews + [request().reviews[0], request().reviews[0].model_copy(update={"language": "ms"})]
    report, warnings, count = sentiment.analyze_reviews(reviews, "unused")
    assert count == 2 and report.excluded_count == 2
    assert report.negative_pct == 50 and report.positive_pct == 50
    assert report.five_star_counts["1_star"] == 1
    assert warnings


def test_duplicate_urls_and_budget_filter():
    raw = [{"url": "https://example.com/promo?campaign=a", "title": "Example", "content": "An offer"},
           {"url": "https://example.com/promo?campaign=b", "title": "Example", "content": "Same offer"}]
    findings, _ = normalize(raw, "live")
    assert len(findings) == 1
    draft = DraftCampaign.model_validate(json.loads((FIXTURES / "demo_campaigns.json").read_text(encoding="utf-8"))[0])
    ranked, warnings = rank([draft], 1, SentimentReport(), findings)
    assert not ranked and any("over-budget" in w for w in warnings)


def test_document_evidence_id_is_traceable_and_validated():
    from datetime import datetime, timezone

    draft = DraftCampaign.model_validate(json.loads((FIXTURES / "demo_campaigns.json").read_text(encoding="utf-8"))[0])
    draft.evidence_ids = ["document-001"]
    document = Finding(evidence_id="document-001", competitor="Cafe", fact="Provided document [Owner notes]: Friday sales",
                       retrieved_at=datetime.now(timezone.utc).isoformat(), evidence_type="provided_document", title="Owner notes")
    ranked, warnings = rank([draft], 500, SentimentReport(), [document])
    assert len(ranked) == 1 and ranked[0].evidence_ids == ["document-001"]
    assert ranked[0].score_breakdown["evidence_quality"] == 2
    assert not any("unknown evidence" in warning for warning in warnings)
    draft.evidence_ids = ["document-999"]
    rejected, warnings = rank([draft], 500, SentimentReport(), [document])
    assert not rejected and any("unknown evidence" in warning for warning in warnings)


def test_competitor_directory_and_group_are_not_claims():
    raw = [
        {"url": "https://m.yelp.com/search?find_desc=cafe", "title": "Best cafes", "content": "A list of cafes"},
        {"url": "https://www.facebook.com/groups/local/posts/123", "title": "Discussion", "content": "A new cafe discussion"},
        {"url": "https://example.com/offer", "title": "Cafe offer", "content": "A coffee bundle"},
    ]
    findings, _ = normalize(raw, "live")
    assert len(findings) == 1 and findings[0].source_url == "https://example.com/offer"


def test_invalid_llm_json_is_partial(monkeypatch):
    import langchain_google_genai

    class BadLLM:
        def __init__(self, **kwargs):
            pass

        def invoke(self, prompt):
            return type("Response", (), {"content": "not JSON"})()

    monkeypatch.setattr(langchain_google_genai, "ChatGoogleGenerativeAI", BadLLM)
    live_request = request().model_copy(update={"research_mode": "live"})
    drafts, engine, calls, warnings, _ = generate(live_request, SentimentReport(), [], Settings(google_api_key="test", gemini_model="gemini-2.5-flash"))
    assert drafts == [] and engine == "unavailable" and calls == 2
    assert len(warnings) == 2


def test_demo_uses_fixture_even_with_gemini_key():
    drafts, engine, calls, _, _ = generate(request(), SentimentReport(), [], Settings(google_api_key="test", gemini_model="gemini-2.5-flash"))
    assert len(drafts) == 3 and engine == "fixture" and calls == 0


def test_llm_accepts_wrapped_three_campaigns(monkeypatch):
    import langchain_google_genai

    class GoodLLM:
        def __init__(self, **kwargs):
            assert kwargs["api_key"] == "test"
            assert kwargs["model"] == "gemini-2.5-flash"

        def invoke(self, prompt):
            drafts = json.loads((FIXTURES / "demo_campaigns.json").read_text(encoding="utf-8"))
            return type("Response", (), {"content": json.dumps({"campaigns": drafts}), "usage_metadata": {"total_tokens": 100}})()

    monkeypatch.setattr(langchain_google_genai, "ChatGoogleGenerativeAI", GoodLLM)
    live_request = request().model_copy(update={"research_mode": "live"})
    drafts, engine, calls, warnings, tokens = generate(live_request, SentimentReport(), [], Settings(google_api_key="test", gemini_model="gemini-2.5-flash"))
    assert len(drafts) == 3 and engine == "configured_llm" and calls == 1 and not warnings and tokens == 100


def test_live_search_failure_has_no_fixture(monkeypatch):
    import langchain_tavily
    from marketing_agent.competitor_search import search

    class FailedSearch:
        def __init__(self, **kwargs):
            pass

        def invoke(self, payload):
            raise RuntimeError("offline")

    monkeypatch.setattr(langchain_tavily, "TavilySearch", FailedSearch)
    live = request().model_copy(update={"research_mode": "live"})
    raw, engine, calls, warnings = search(live, Settings(tavily_api_key="test"))
    assert raw == [] and calls == 1 and engine == "tavily_live" and warnings
