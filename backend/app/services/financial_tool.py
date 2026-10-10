"""Read-only adapter to the local invoice assurance engine."""

import asyncio
import json
from pathlib import Path

from app.core.config import get_settings
from finance.engine import evaluate, run_analysis, summarize
from finance.final_report import batch_results
from finance.fixtures import base

ROOT = Path(__file__).resolve().parents[2] / "finance"


def _report(payload: dict, mode: str) -> dict:
    cases = payload["cases"]
    exceptions = [
        {"invoice": case["invoice_reference"] or case["invoice_id"],
         "rule_id": finding["rule_id"], "status": finding["status"],
         "explanation": finding["explanation"], "source_refs": finding["source_refs"],
         "recommended_action": finding["recommended_action"]}
        for case in cases for finding in case["findings"] if finding["status"] in ("FAIL", "UNKNOWN")
    ]
    warnings = list(payload.get("limitations", []))
    if mode == "demo":
        warnings.append("Synthetic demo case; no supplied invoices were checked.")
    else:
        warnings.append("Supplementary GPT risk review was skipped; deterministic checks only.")
    if any(case["dataset_kind"] == "TEST" for case in cases):
        warnings.append("TEST cases are illustrative and excluded from supplied exposure totals.")
    if any(case["unresolved"] for case in cases):
        warnings.append("Some checks need missing or human-verified evidence.")
    if len(exceptions) > 30 or len(cases) > 20 or len(payload.get("source_manifest", [])) > 20:
        warnings.append("Manager preview is truncated; use the standalone finance service for the full report.")
    return {"status": "partial" if warnings or not cases else "completed", "mode": mode,
            "summary": payload["summary"], "batch_results": {**payload["batch_results"],
            "invoices": payload["batch_results"]["invoices"][:20]},
            "source_manifest": [{"source": Path(item["path"]).name, "sha256": item["sha256"], "role": item["role"]}
                                for item in payload.get("source_manifest", [])[:20]],
            "exceptions": exceptions[:30], "warnings": warnings,
            "distribution_approval_required": True, "external_actions": "none"}


def _analyze(mode: str) -> dict:
    if mode == "demo":
        dataset = base("MANAGER-DEMO")
        case = evaluate(dataset["invoices"][0], dataset,
                        {"currency": "MYR", "money_tolerance": "0.02", "quantity_tolerance": "0", "ai_risk_enabled": False})
        return _report({"cases": [case], "summary": summarize([case]),
                        "batch_results": batch_results([case]), "source_manifest": []}, mode)

    config = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    settings = get_settings()
    # Use the Python processor's newest saved result before attempting a new analysis.
    reports = sorted((ROOT / "state" / "reports").glob("*/report.json"),
                     key=lambda path: path.stat().st_mtime, reverse=True)
    snapshot = None
    origin = ""
    if reports:
        snapshot = json.loads(reports[0].read_text(encoding="utf-8"))
        origin = "Latest locally generated invoice report"
    elif settings.finance_report_json:
        snapshot = json.loads(settings.finance_report_json)
        origin = "Configured hosted invoice report snapshot; not a fresh analysis"
    if snapshot is not None:
        if not isinstance(snapshot.get("batch_results"), dict) or not snapshot.get("report_id"):
            raise ValueError("Generated invoice report is missing its identity or results")
        return {"report_id": snapshot["report_id"], "status": "partial", "mode": mode,
                "batch_results": snapshot["batch_results"], "evidence_origin": origin,
                "warnings": [origin, "Suspected exposure is not confirmed fraud or loss."],
                "distribution_approval_required": True, "external_actions": "none"}

    def resolved(value: str) -> Path:
        path = Path(value).expanduser()
        return (path if path.is_absolute() else ROOT / path).resolve()

    workbook = resolved(settings.finance_workbook or config["workbook"])
    folder_value = settings.finance_invoice_input_dir or config.get("invoice_input_dir")
    folder = resolved(folder_value) if folder_value else None
    missing = [label for label, path in (("workbook", workbook), ("invoice folder", folder))
               if path is not None and not (path.is_dir() if label == "invoice folder" else path.is_file())]
    if missing:
        return {"status": "unavailable", "mode": mode, "warnings": [
            "Configured finance " + ", ".join(missing) + " unavailable. Set FINANCE_WORKBOOK and FINANCE_INVOICE_INPUT_DIR in backend/.env, or update finance/config.json."],
                "distribution_approval_required": True, "external_actions": "none"}
    config["workbook"] = str(workbook)
    config["invoice_input_dir"] = str(folder) if folder else None
    config["reference_documents"] = [str(resolved(value)) for value in config.get("reference_documents", [])]
    config["include_test_cases"] = False
    config["test_policy"] = {**config["test_policy"], "ai_risk_enabled": False}
    try:
        return _report(run_analysis(config), mode)
    except (FileNotFoundError, ModuleNotFoundError, OSError, ValueError) as error:
        return {"status": "unavailable", "mode": mode,
                "warnings": [f"Invoice assurance could not read configured sources: {type(error).__name__}."],
                "distribution_approval_required": True, "external_actions": "none"}


async def run(mode: str = "configured") -> dict:
    return await asyncio.to_thread(_analyze, mode)
