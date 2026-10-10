from functools import lru_cache
from pathlib import Path
from time import monotonic
from .schemas import Review, SentimentReport


@lru_cache(maxsize=2)
def load_model(path: str):
    model_dir = Path(path)
    if not (model_dir / "config.json").is_file() or not any(
        (model_dir / filename).is_file() for filename in ("model.safetensors", "pytorch_model.bin")
    ):
        raise FileNotFoundError("DistilBERT checkpoint config or weights absent")
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    tokenizer = AutoTokenizer.from_pretrained(model_dir, local_files_only=True)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir, local_files_only=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device).eval()
    return tokenizer, model, device


def predict_stars(texts: list[str], path: str) -> tuple[list[int], int]:
    import torch
    tokenizer, model, device = load_model(path)
    predictions = []
    batches = 0
    for offset in range(0, len(texts), 16):
        batch = tokenizer(texts[offset:offset + 16], padding=True, truncation=True,
                          max_length=256, return_tensors="pt")
        batch = {key: value.to(device) for key, value in batch.items()}
        with torch.inference_mode():
            logits = model(**batch).logits
        predictions.extend((logits.argmax(dim=-1).cpu() + 1).tolist())
        batches += 1
    return predictions, batches


def analyze_reviews(reviews: list[Review], model_path: str) -> tuple[SentimentReport, list[str], int]:
    seen = set()
    clean = []
    for review in reviews:
        key = review.text.casefold()
        if review.language.lower().split("-")[0] == "en" and key not in seen:
            clean.append(review)
            seen.add(key)
    excluded = len(reviews) - len(clean)
    report = SentimentReport(excluded_count=excluded)
    warnings = []
    if excluded:
        warnings.append(f"Excluded {excluded} duplicate or unsupported-language reviews; English model only.")
    if not clean:
        warnings.append("No eligible English reviews supplied; sentiment percentages unavailable.")
        return report, warnings, 0
    started = monotonic()
    try:
        stars, batches = predict_stars([r.text for r in clean], model_path)
    except Exception as exc:
        report.excluded_count = len(reviews)
        warnings.append(f"Local sentiment model unavailable: {type(exc).__name__}. No sentiment percentages reported.")
        return report, warnings, 0
    report.model_status = "available"
    report.processed_count = len(stars)
    report.batch_count = batches
    report.inference_latency_ms = int((monotonic() - started) * 1000)
    report.five_star_counts = {f"{i}_star": stars.count(i) for i in range(1, 6)}
    report.negative_count = sum(s <= 2 for s in stars)
    report.neutral_count = stars.count(3)
    report.positive_count = sum(s >= 4 for s in stars)
    for group in ("positive", "neutral", "negative"):
        setattr(report, f"{group}_pct", round(100 * getattr(report, f"{group}_count") / len(stars), 1))
    for category, predicate in (("negative", lambda s: s <= 2), ("positive", lambda s: s >= 4)):
        matching = [(i, r) for i, (r, star) in enumerate(zip(clean, stars), 1) if predicate(star)]
        report.representative_reviews.extend(
            {"evidence_id": f"review-{i:03}", "text": r.text[:300], "sentiment": category}
            for i, r in matching[:3]
        )
    return report, warnings, len(stars)
