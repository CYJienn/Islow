import argparse
import csv
import json
from pathlib import Path

from .graph import analyze
from .schemas import AnalyzeRequest


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the standalone Marketing Agent")
    parser.add_argument("--demo", action="store_true", help="Use the checked-in demo request")
    parser.add_argument("--request", type=Path, help="Read a request JSON file")
    parser.add_argument("--reviews-csv", type=Path, help="Use local CSV reviews with text, date, source, language columns")
    args = parser.parse_args()
    if not args.demo and not args.request:
        parser.error("provide --demo or --request")
    path = args.request or Path(__file__).parent / "fixtures" / "demo_request.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    if args.reviews_csv:
        with args.reviews_csv.open(encoding="utf-8-sig", newline="") as handle:
            payload["reviews"] = [{k: v for k, v in row.items() if k in {"text", "date", "source", "language"} and v} for row in csv.DictReader(handle)]
    report = analyze(AnalyzeRequest.model_validate(payload))
    print(report.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
