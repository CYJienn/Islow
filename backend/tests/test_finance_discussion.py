import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.chat import ChatRequest
from app.services import company_manager


@pytest.mark.parametrize("attached", [False, True])
def test_finance_lead_receives_report_before_speaking(attached):
    import asyncio

    report = {
        "report_id": "report-discussion", "status": "completed", "warnings": [],
        "batch_results": {"valid_reference_matches": 3, "invalid_reference_matches": 1,
                          "fully_verified": 0, "supplied_suspected_exposure": {"MYR": "100.00"},
                          "test_suspected_exposure": {"MYR": "200.00"}, "confirmed_fraud": "NOT_ESTABLISHED"},
    }
    request = ChatRequest(text="Discuss invoice risk", seated=["finance"],
                          finance={"report": report} if attached else None)
    ask = AsyncMock(return_value="No change.")
    tool = AsyncMock(return_value=report)
    with patch.object(company_manager, "_model", return_value=MagicMock()), \
         patch.object(company_manager, "_invoke", AsyncMock(return_value={"general": False, "specialists": ["financial_operations"], "invoice_assurance": False})), \
         patch.object(company_manager, "_ask", ask), \
         patch.object(company_manager.financial_tool, "run", tool):
        response = asyncio.run(company_manager.respond(request))
    first = ask.call_args_list[0].args
    assert json.dumps(report["batch_results"]) in first[2]
    assert "report-discussion" in first[2]
    assert "Never combine test and supplied totals" in first[1]
    assert response.turns[0].agent == "finance"
    assert [turn.agent for turn in response.turns] == ["finance", "manager"]
    if attached:
        tool.assert_not_called()
    else:
        tool.assert_awaited_once_with("configured")


def test_report_requires_identifiable_batch_results():
    with pytest.raises(ValueError):
        ChatRequest(text="Discuss", finance={"report": {"total": "123"}})


def test_generated_report_changes_are_read_without_frontend_upload(tmp_path):
    from types import SimpleNamespace
    from app.services import financial_tool
    (tmp_path / "config.json").write_text("{}")
    directory = tmp_path / "state" / "reports" / "report-generated"
    directory.mkdir(parents=True)
    path = directory / "report.json"
    for amount in ("12.00", "27.00"):
        path.write_text(json.dumps({"report_id": "report-generated", "batch_results": {
            "supplied_suspected_exposure": {"MYR": amount}, "test_suspected_exposure": {}}}))
        with patch.object(financial_tool, "ROOT", tmp_path), \
             patch.object(financial_tool, "get_settings", return_value=SimpleNamespace(finance_report_json="")):
            result = financial_tool._analyze("configured")
        assert result["batch_results"]["supplied_suspected_exposure"]["MYR"] == amount


def test_hosted_report_comes_from_configuration(tmp_path):
    from types import SimpleNamespace
    from app.services import financial_tool
    (tmp_path / "config.json").write_text("{}")
    snapshot = {"report_id": "report-hosted", "batch_results": {"checked": 7}}
    with patch.object(financial_tool, "ROOT", tmp_path), \
         patch.object(financial_tool, "get_settings", return_value=SimpleNamespace(finance_report_json=json.dumps(snapshot))):
        result = financial_tool._analyze("configured")
    assert result["report_id"] == "report-hosted"
    assert result["batch_results"]["checked"] == 7


def test_finance_speech_has_no_repeated_address_or_report_identifier():
    text = "Manager Manager, **Invoice checks** from report-cf7d12cbc90d show suspected exposure of MYR 12.00, not confirmed loss."
    spoken = company_manager.meeting_text(text, finance=True)
    assert not spoken.startswith("Manager")
    assert "**" not in spoken
    assert "cf7d12cbc90d" not in spoken
    assert "MYR 12.00, not confirmed loss" in spoken
