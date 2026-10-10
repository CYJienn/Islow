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
    if attached:
        tool.assert_not_called()
    else:
        tool.assert_awaited_once_with("configured")


def test_report_requires_identifiable_batch_results():
    with pytest.raises(ValueError):
        ChatRequest(text="Discuss", finance={"report": {"total": "123"}})
