"""Send a simple alert only for a standalone, explicit user command."""
import re
import json
import httpx
from app.core.config import get_settings
from app.schemas.chat import ChatResponse


def request_kind(text: str) -> str | None:
    match = re.fullmatch(
        r"(?:please\s+)?(?:can you\s+)?(?:please\s+)?(?:have\s+)?send\s+(?:me\s+)?(?:(?:an?|the|my|latest)\s+)*(?P<kind>alert|notification|test message|(?:finance\s+)?report(?:\s+summary)?)\s+(?:to|on|via|in)\s+(?:the\s+)?telegram(?:\s+(?:bot|app))?[.!?\s]*",
        text.strip(), re.I,
    )
    return ("report" if "report" in match["kind"].lower() else "alert") if match else None


def is_alert_request(text: str) -> bool:
    return request_kind(text) == "alert"


def report_summary(raw: str) -> str:
    report = json.loads(raw)
    results = report["batch_results"]
    lines = ["AgentsDiscusstors finance report summary", "Configured report snapshot; not a fresh invoice analysis."]
    for key in ("checked", "valid_reference_matches", "invalid_reference_matches", "fully_verified"):
        if key in results:
            lines.append(f"{key.replace('_', ' ').capitalize()}: {results[key]}")
    for key, label in (("supplied_suspected_exposure", "Supplied-invoice suspected exposure"), ("test_suspected_exposure", "Test-invoice suspected exposure")):
        values = results.get(key) or {}
        amounts = "; ".join(f"{currency} {amount}" for currency, amount in values.items())
        lines.append(f"{label}: {amounts or 'not reported'}")
    lines.append("Reference matches do not mean fully verified. Suspected exposure is not confirmed fraud or loss. This message does not approve payment.")
    return "\n".join(lines)


async def send_alert(kind: str = "alert") -> ChatResponse:
    settings = get_settings()
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        return ChatResponse(type="error", message="Telegram is not configured on this backend. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in its environment.")
    text = "AgentsDiscusstors alert: your request from the app was received. This is an alert only; no report or payment approval is included."
    if kind == "report":
        try:
            text = report_summary(settings.finance_report_json)
        except (ValueError, KeyError, TypeError, AttributeError):
            return ChatResponse(type="error", message="No usable finance report summary is configured on this backend. No report was sent.")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                "https://api.telegram.org/bot" + settings.telegram_bot_token + "/sendMessage",
                json={"chat_id": settings.telegram_chat_id, "text": text},
            )
        if response.status_code == 200 and response.json().get("ok") is True:
            return ChatResponse(type="text", message=f"Your {kind} was sent to your configured Telegram chat.")
        return ChatResponse(type="error", message="Telegram did not accept the alert. Check the bot token, chat ID, and whether you have started the bot.")
    except httpx.TimeoutException:
        return ChatResponse(type="error", message="Telegram delivery timed out. Check your bot chat before trying again; delivery could not be confirmed.")
    except (httpx.HTTPError, ValueError):
        return ChatResponse(type="error", message="Telegram delivery could not be confirmed. Check your bot chat before trying again.")
