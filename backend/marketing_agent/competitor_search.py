import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from .schemas import AnalyzeRequest, Business, Finding
from .config import Settings

FIXTURES = Path(__file__).parent / "fixtures"


def search(request: AnalyzeRequest, settings: Settings) -> tuple[list[dict], str, int, list[str]]:
    if request.research_mode == "demo":
        return json.loads((FIXTURES / "demo_competitor_findings.json").read_text(encoding="utf-8")), "fixture", 0, ["Competitor observations are illustrative demo fixtures, not current market facts."]
    if not settings.tavily_api_key:
        return [], "unavailable", 0, ["TAVILY_API_KEY missing; live competitor research unavailable."]
    try:
        from langchain_tavily import TavilySearch
        tool = TavilySearch(max_results=min(5, settings.max_search_results), search_depth="basic", tavily_api_key=settings.tavily_api_key)
    except Exception as exc:
        return [], "unavailable", 0, [f"Tavily initialization failed: {type(exc).__name__}."]
    names = request.business.competitor_names[:3]
    queries = [f"{name} {request.business.location} promotion menu launch" for name in names]
    if not queries:
        queries = [f"{request.business.industry} {request.business.location} promotion new product {request.business.target_customers}"]
    results = []
    calls = 0
    warnings = []
    for query in queries[:max(0, min(3, settings.max_search_queries))]:
        calls += 1
        try:
            response = tool.invoke({"query": query})
            if isinstance(response, str):
                response = json.loads(response)
            items = response.get("results", []) if isinstance(response, dict) else response
            results.extend(items if isinstance(items, list) else [])
        except Exception as exc:
            warnings.append(f"Live Tavily query failed: {type(exc).__name__}.")
    return results[:settings.max_search_results], "tavily_live" if calls else "unavailable", calls, warnings


def normalize(raw: list[dict], mode: str, limit: int = 5, business: Business | None = None) -> tuple[list[Finding], list[str]]:
    findings = []
    seen = set()
    warnings = []
    for item in raw:
        if len(findings) >= limit:
            break
        if mode == "demo":
            candidate = Finding.model_validate(item)
            candidate.retrieved_at = datetime.now(timezone.utc).isoformat()
            findings.append(candidate)
            continue
        url = str(item.get("url") or "").strip()
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            continue
        domain = parsed.netloc.lower().removeprefix("www.").removeprefix("m.")
        path = parsed.path.lower()
        if (domain.endswith("yelp.com") and path.startswith("/search")) or (domain.endswith("facebook.com") and path.startswith("/groups/")):
            continue
        canonical = urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path.rstrip("/"), "", "", ""))
        if canonical in seen:
            continue
        seen.add(canonical)
        content = str(item.get("content") or item.get("snippet") or "").strip()[:450]
        if not content:
            continue
        title = str(item.get("title") or "").strip()[:150]
        lowered = content.casefold()
        product_overlap = bool(business and any(product.casefold() in lowered for product in business.products))
        documented_offer = any(word in lowered for word in ("promotion", "discount", "bundle", "launch", "event"))
        threat = "medium" if product_overlap and documented_offer else "low" if product_overlap else "unknown"
        findings.append(Finding(
            evidence_id=f"competitor-{len(findings) + 1:03}", competitor=title or parsed.netloc,
            fact=f"A public search result reports: {content} (date unverified).",
            source_url=canonical, retrieved_at=datetime.now(timezone.utc).isoformat(),
            evidence_type="public_search_snippet", threat_level=threat,
            publication_date=item.get("published_date"), title=title or None,
        ))
    if mode == "live" and findings:
        warnings.append("Search snippets and offer dates are unverified; verify source pages before use.")
    if not findings:
        warnings.append("No usable competitor observations available.")
    return findings, warnings
