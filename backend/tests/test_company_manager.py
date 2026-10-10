import asyncio

from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage
from langchain_google_genai.chat_models import GoogleAPIError, GoogleRateLimitError

from app.main import app
from app.core.config import Settings
from app.schemas.chat import ChatDocument, ChatRequest
from app.services import company_manager


class FakeModel:
    def __init__(self, route: company_manager.Route, fail: str | None = None) -> None:
        self.route = route
        self.fail = fail
        self.calls: list[tuple[str, str]] = []
        self.classifying = False

    def with_structured_output(self, *, schema: dict, method: str) -> "FakeModel":
        assert schema == company_manager.Route.model_json_schema()
        assert method == "json_schema"
        self.classifying = True
        return self

    async def ainvoke(self, messages: list) -> company_manager.Route | AIMessage:
        system, human = (str(message.content) for message in messages)
        self.calls.append((system, human))
        if self.classifying:
            self.classifying = False
            return self.route.model_dump()
        for domain, prompt in company_manager.SPECIALISTS.items():
            if prompt in system:
                if domain == self.fail:
                    raise RuntimeError("specialist unavailable")
                return AIMessage(content=f"Finding from {domain} [Report A]")
        return AIMessage(content="Combined answer [Report A]")


def test_general_request_is_answered_without_specialists(monkeypatch) -> None:
    model = FakeModel(company_manager.Route(general=True, specialists=[]))
    monkeypatch.setattr(company_manager, "_model", lambda: model)

    response = asyncio.run(company_manager.respond(ChatRequest(text="Explain what gross margin means")))

    assert response.type == "text"
    assert response.message == "Combined answer [Report A]"
    assert len(model.calls) == 2


def test_each_specialist_is_called_for_mixed_document_request(monkeypatch) -> None:
    domains = list(company_manager.SPECIALISTS)
    model = FakeModel(company_manager.Route(general=True, specialists=domains))
    monkeypatch.setattr(company_manager, "_model", lambda: model)
    request = ChatRequest(
        text="Review our cash flow, competitors, and compliance obligations",
        documents=[ChatDocument(source="Report A", content="Revenue is RM 1000.")],
    )

    response = asyncio.run(company_manager.respond(request))

    assert response.type == "text"
    assert len(model.calls) == 5  # classify, three specialists, synthesize
    for domain in domains:
        assert any(company_manager.SPECIALISTS[domain] in system for system, _ in model.calls)
    assert all("Source: Report A" in human for _, human in model.calls)
    assert "Finding from financial_operations [Report A]" in model.calls[-1][1]


def test_failed_specialist_is_reported_as_unfinished(monkeypatch) -> None:
    model = FakeModel(
        company_manager.Route(general=False, specialists=["financial_operations", "legal_compliance"]),
        fail="legal_compliance",
    )
    monkeypatch.setattr(company_manager, "_model", lambda: model)

    response = asyncio.run(company_manager.respond(ChatRequest(text="Review finances and compliance")))

    assert response.type == "text"
    assert "Unfinished specialist analysis: legal and compliance." in response.message


def test_missing_model_does_not_claim_work_was_done(monkeypatch) -> None:
    monkeypatch.setattr(company_manager, "_model", lambda: None)

    response = asyncio.run(company_manager.respond(ChatRequest(text="Review our finances")))

    assert response.type == "error"
    assert "unavailable" in response.message


def test_chat_endpoint_routes_company_request_and_keeps_create(monkeypatch) -> None:
    model = FakeModel(company_manager.Route(general=True, specialists=[]))
    monkeypatch.setattr(company_manager, "_model", lambda: model)
    client = TestClient(app)

    company = client.post("/api/v1/chat", json={"text": "What is gross margin?"})
    widget = client.post("/api/v1/chat", json={"text": "/create line chart of sales"})

    assert company.status_code == 200
    assert company.json()["message"] == "Combined answer [Report A]"
    assert widget.status_code == 200
    assert widget.json()["type"] == "widget"


def test_gemini_model_uses_values_loaded_from_dotenv(monkeypatch, tmp_path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text("GOOGLE_API_KEY=test-value\nGEMINI_MODEL=gemini-2.5-flash\n", encoding="utf-8")
    settings = Settings(_env_file=env_file)
    model_arguments = {}

    def fake_gemini(**kwargs):
        model_arguments.update(kwargs)
        return object()

    monkeypatch.setattr(company_manager, "get_settings", lambda: settings)
    monkeypatch.setattr(company_manager, "ChatGoogleGenerativeAI", fake_gemini)

    assert company_manager._model() is not None
    assert model_arguments["api_key"] == "test-value"
    assert model_arguments["model"] == "gemini-2.5-flash"


def test_temporary_gemini_failure_is_retried(monkeypatch) -> None:
    class SometimesUnavailable:
        calls = 0

        async def ainvoke(self, messages):
            self.calls += 1
            if self.calls < 3:
                raise GoogleAPIError(
                    code=503,
                    response_json={"error": {"code": 503, "status": "UNAVAILABLE", "message": "busy"}},
                )
            return AIMessage(content="ready")

    async def no_wait(_):
        pass

    monkeypatch.setattr(company_manager.asyncio, "sleep", no_wait)
    runnable = SometimesUnavailable()

    answer = asyncio.run(company_manager._invoke(runnable, []))

    assert answer.text == "ready"
    assert runnable.calls == 3


def test_quota_failure_reports_partial_result_without_claiming_synthesis(monkeypatch) -> None:
    model = FakeModel(company_manager.Route(general=False, specialists=["financial_operations", "legal_compliance"]))
    monkeypatch.setattr(company_manager, "_model", lambda: model)
    original_ask = company_manager._ask

    async def quota_ask(model, instructions, context):
        if instructions.startswith(company_manager.SPECIALISTS["legal_compliance"]) or "Combine the specialist findings" in instructions:
            raise GoogleRateLimitError("quota exhausted")
        return await original_ask(model, instructions, context)

    monkeypatch.setattr(company_manager, "_ask", quota_ask)

    response = asyncio.run(company_manager.respond(ChatRequest(text="Review finances and compliance")))

    assert response.type == "text"
    assert "Specialist findings (not synthesized)" in response.message
    assert "Unfinished specialist analysis: legal and compliance" in response.message
    assert "Gemini quota was reached" in response.message
