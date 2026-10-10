from .schemas import DraftCampaign, Finding, RankedCampaign, SentimentReport


def rank(drafts: list[DraftCampaign], budget: float, sentiment: SentimentReport,
         findings: list[Finding]) -> tuple[list[RankedCampaign], list[str]]:
    valid_ids = {r["evidence_id"] for r in sentiment.representative_reviews} | {f.evidence_id for f in findings}
    external_ids = {f.evidence_id for f in findings if f.evidence_type == "verified_source" and f.source_url}
    review_ids = {r["evidence_id"] for r in sentiment.representative_reviews}
    seen_names, seen_ideas = set(), set()
    ranked, warnings = [], []
    for draft in drafts:
        name, idea = draft.name.casefold().strip(), draft.idea.casefold().strip()
        if name in seen_names or idea in seen_ideas:
            warnings.append(f"Excluded duplicate campaign: {draft.name}.")
            continue
        seen_names.add(name)
        seen_ideas.add(idea)
        if draft.estimated_budget_rm > budget:
            warnings.append(f"Excluded over-budget campaign: {draft.name}.")
            continue
        if any(eid not in valid_ids for eid in draft.evidence_ids):
            warnings.append(f"Excluded campaign with unknown evidence ID: {draft.name}.")
            continue
        external_count = len(set(draft.evidence_ids) & external_ids)
        evidence_quality = 5 if external_count >= 2 else 3 if external_count == 1 else 2 if set(draft.evidence_ids) & review_ids else 0
        scores = {"customer_alignment": draft.customer_alignment, "differentiation": draft.differentiation,
                  "budget_fit": 5, "feasibility": draft.feasibility, "evidence_quality": evidence_quality}
        score = round(20 * (0.30 * scores["customer_alignment"] + 0.25 * scores["differentiation"] +
                            0.20 * scores["budget_fit"] + 0.15 * scores["feasibility"] +
                            0.10 * scores["evidence_quality"]), 1)
        ranked.append(RankedCampaign(rank=0, **draft.model_dump(include={"name", "objective", "target_audience", "channel", "idea",
                                         "sample_caption", "duration_days", "estimated_budget_rm", "kpi", "evidence_ids", "assumptions",
                                         "customer_alignment_reason", "differentiation_reason", "feasibility_reason"}),
                                      suitability_score=score, score_breakdown=scores,
                                      ranking_rationale="Weighted SME suitability rubric; subjective ratings are proposals, not predicted outcomes."))
    ranked.sort(key=lambda x: (-x.suitability_score, x.name.casefold()))
    for position, campaign in enumerate(ranked, 1):
        campaign.rank = position
    if len(ranked) != 3:
        warnings.append(f"Only {len(ranked)} of 3 valid distinct campaigns are available.")
    return ranked, warnings
