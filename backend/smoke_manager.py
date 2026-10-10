"""Run a few live company manager requests against the local FastAPI app."""

import sys

from fastapi.testclient import TestClient
from langchain_google_genai import ChatGoogleGenerativeAI

from app.main import app
from app.services import company_manager


original_ask = company_manager._ask
called_specialists: list[str] = []


async def traced_ask(model, instructions: str, context: str) -> str:
    for domain, prompt in company_manager.SPECIALISTS.items():
        if instructions.startswith(prompt):
            called_specialists.append(domain)
    try:
        return await original_ask(model, instructions, context)
    except Exception as error:
        print(f"Model call failed: {type(error).__name__}: {str(error)[:400]}", flush=True)
        raise


company_manager._ask = traced_ask

original_structured = ChatGoogleGenerativeAI.with_structured_output


class TracedRunnable:
    def __init__(self, runnable) -> None:
        self.runnable = runnable

    async def ainvoke(self, messages):
        try:
            return await self.runnable.ainvoke(messages)
        except Exception as error:
            print(f"Classification failed: {type(error).__name__}: {str(error)[:400]}", flush=True)
            raise


def traced_structured(self, *args, **kwargs):
    return TracedRunnable(original_structured(self, *args, **kwargs))


ChatGoogleGenerativeAI.with_structured_output = traced_structured

samples = [
    ("general", {"text": "What is an invoice? Answer in one sentence."}),
    (
        "financial document",
        {
            "text": "Calculate operating profit from this report and suggest one operational action.",
            "documents": [
                {"source": "Demo monthly report", "content": "Revenue RM 10,000. Operating expenses RM 8,000."}
            ],
        },
    ),
    (
        "mixed domains",
        {
            "text": "Review our cash flow, competitor pricing, and legal compliance risks in Malaysia. State what cannot be concluded.",
            "documents": [
                {"source": "Demo company note", "content": "Monthly cash inflow RM 12,000 and outflow RM 11,000. A competitor advertises a similar product at RM 90; our listed selling price is RM 100. No permits or business registration details supplied."}
            ],
        },
    ),
    (
        "feedback",
        {"text": "The marketing specialist incorrectly treated our selling price as our cost. Propose a specific change to that specialist's skill, but do not apply it yet."},
    ),
]


if __name__ == "__main__":
    client = TestClient(app)
    selected = samples if len(sys.argv) == 1 else [sample for sample in samples if sample[0] == sys.argv[1]]
    for name, payload in selected:
        called_specialists.clear()
        print(f"\nRunning {name}...", flush=True)
        response = client.post("/api/v1/chat", json=payload)
        body = response.json()
        print(f"\n{name}: HTTP {response.status_code}, type={body.get('type')}, specialists={called_specialists}")
        print(body.get("message", "")[:4000])
