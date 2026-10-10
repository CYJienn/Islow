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

Set `OPENAI_API_KEY` before invoking an agent. LangSmith tracing is disabled by default and can be enabled through the variables documented in `.env.example`.

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
