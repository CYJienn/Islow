import asyncio
from types import SimpleNamespace
from unittest.mock import patch, AsyncMock
import pytest
from app.services import telegram_alert

@pytest.mark.parametrize("text", ["send an alert to Telegram.", "please send me an alert on Telegram", "Please have send me an alert in the Telegram app"])
def test_explicit_command(text):
    assert telegram_alert.is_alert_request(text)

@pytest.mark.parametrize("text", ["How can I send an alert to Telegram?", "Do not send an alert to Telegram", "Discuss marketing and send an alert to Telegram"])
def test_other_requests_do_not_send(text):
    assert not telegram_alert.is_alert_request(text)

def test_missing_credentials():
    with patch.object(telegram_alert, "get_settings", return_value=SimpleNamespace(telegram_bot_token="", telegram_chat_id="")):
        assert asyncio.run(telegram_alert.send_alert()).type == "error"

@pytest.mark.parametrize("accepted", [True, False])
def test_delivery_is_confirmed_only_on_success(accepted):
    client = AsyncMock()
    response = SimpleNamespace(status_code=200 if accepted else 401, json=lambda: {"ok": accepted})
    client.post.return_value = response
    client.__aenter__.return_value = client
    with patch.object(telegram_alert, "get_settings", return_value=SimpleNamespace(telegram_bot_token="test", telegram_chat_id="test")), patch.object(telegram_alert.httpx, "AsyncClient", return_value=client):
        result = asyncio.run(telegram_alert.send_alert())
    assert result.type == ("text" if accepted else "error")


def test_report_command_and_summary():
    import json
    assert telegram_alert.request_kind("Please send me the finance report to Telegram") == "report"
    text = telegram_alert.report_summary(json.dumps({"batch_results": {"checked": 4, "valid_reference_matches": 3, "invalid_reference_matches": 1, "fully_verified": 0, "supplied_suspected_exposure": {}, "test_suspected_exposure": {"MYR": "12.00"}}}))
    assert "Supplied-invoice suspected exposure: not reported" in text
    assert "Test-invoice suspected exposure: MYR 12.00" in text
    assert "not confirmed fraud or loss" in text


def test_chat_dispatches_alert_without_llm():
    from app.services import company_manager
    from app.schemas.chat import ChatRequest, ChatResponse
    with patch.object(company_manager.telegram_alert, "send_alert", new_callable=AsyncMock, return_value=ChatResponse(type="text", message="sent")) as send, patch.object(company_manager, "_model") as model:
        result = asyncio.run(company_manager.respond(ChatRequest(text="send an alert to Telegram")))
    send.assert_awaited_once_with("alert")
    model.assert_not_called()
    assert result.message == "sent"
