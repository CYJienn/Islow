# Kaunter backend

The backend is a FastAPI service for Kaunter. It provides health checks and the local chat/widget generator through a versioned API.

Its AI dependency stack includes LangChain for agents and model integrations, LangGraph for multi-agent orchestration, MCP adapters for external tools, and LangSmith support for optional tracing.

## Requirements

- Python 3.11+
- [uv](https://docs.astral.sh/uv/)

## Setup and run

```powershell
uv sync --dev
Copy-Item .env.example .env
uv run python run.py
```

The application runs through Uvicorn at `http://127.0.0.1:8000`. Development reload is enabled when `ENVIRONMENT=development`.

Useful URLs:

- OpenAPI documentation: `http://127.0.0.1:8000/docs`
- Alternative API documentation: `http://127.0.0.1:8000/redoc`
- Health check: `http://127.0.0.1:8000/api/v1/health`

## Tests

```powershell
uv run pytest
```

## Dependency files

- `pyproject.toml` is the source of truth for direct runtime and development dependencies.
- `uv.lock` provides reproducible development installs with `uv sync --dev`.
- `requirements.txt` contains the fully resolved runtime dependency set for environments that use `pip`:

```powershell
python -m pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set `GOOGLE_API_KEY` there before invoking an agent. Do not commit `.env`. LangSmith tracing is disabled by default and can be enabled through the variables documented in `.env.example`.

## Company manager chat

`POST /api/v1/chat` keeps `/create` widget commands and routes other messages to the company manager. The manager classifies the request, calls the relevant financial and operations, marketing and competitor, or legal and compliance specialist Gemini model for each part, then combines their findings. Set `GOOGLE_API_KEY` and optionally `GEMINI_MODEL` in `.env` to enable it.

The request may include up to five source-labeled text documents:

```json
{
  "text": "Review our cash flow and compliance risks",
  "documents": [
    { "source": "Monthly report", "content": "Revenue: RM 1,000; expenses: RM 900." }
  ]
}
```

Documents are supplied as text in the request; file upload and persistent skill editing are not implemented. For feedback about a specialist, the manager can propose a skill change for approval but cannot apply it through this API yet.

To send demo requests through the API with the configured Gemini key, run `python smoke_manager.py` from `backend/`. It prints which specialists were called and a sample of each answer. Run one case with `python smoke_manager.py "mixed domains"`. These are live API calls and use your Gemini quota.

## Structure

```text
app/
  api/          Versioned routers and HTTP endpoints
  core/         Settings and shared application configuration
  schemas/      Pydantic request and response models
  services/     Business logic independent from HTTP routing
  main.py       FastAPI application factory
tests/          Backend tests
ml/             Model experiments and training notebooks
run.py          Uvicorn development entrypoint
```

Add new HTTP endpoints under `app/api/routes/`, register their router in `app/api/router.py`, and keep reusable logic in `app/services/`.
