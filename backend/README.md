# Kaunter backend

One Python 3.11 FastAPI server exposes the existing Kaunter routes and the Marketing Agent. Dependencies are declared in `pyproject.toml`, locked in `uv.lock`, and exported with exact versions in the single `requirements.txt`. Both parts read the same `backend/.env`.

## Setup (Windows PowerShell)

Run these commands from the repository root:

```powershell
cd backend
uv python install 3.11
uv sync --dev --python 3.11
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Open `backend/.env` and add your keys locally. Keep it out of Git. Both the manager and live marketing campaign generation use `GOOGLE_API_KEY` and `GEMINI_MODEL`. Add `TAVILY_API_KEY` for live competitor research. `MARKETING_API_TOKEN` protects `POST /marketing/analyze` and is checked when the manager invokes GrowthLab internally. Add `HF_TOKEN` for model upload or private Hub downloads. The model archive is separate from the API keys.

Start the unified server from `backend/`:

```powershell
uv run --python 3.11 python run.py
```

The default address is `http://127.0.0.1:8000` (plain HTTP, not HTTPS). In development, `run.py` reloads when code changes. Open `http://127.0.0.1:8000/docs` in a browser to try POST requests with Swagger. Available routes include:

| Route | Purpose |
| --- | --- |
| `GET /api/v1/health` | Existing Kaunter health check |
| `GET /health` | Marketing Skill health contract |
| `POST /marketing/analyze` | Marketing analysis contract |
| `POST /api/v1/chat` | Company manager, including GrowthLab marketing analysis |
| `GET /docs` | OpenAPI documentation |

## Demo and API test

In another PowerShell terminal, from `backend/`:

```powershell
uv run --python 3.11 python -m marketing_agent.cli --demo
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/marketing/analyze -ContentType application/json -InFile marketing_agent/fixtures/demo_request.json
uv run --python 3.11 pytest -q
```

`research_mode: demo` always uses labeled competitor and campaign fixtures, even when API keys are configured, so this test makes no Tavily or Gemini calls. Sentiment uses the Hugging Face model when `SENTIMENT_MODEL_SOURCE=hub`; if the repo is not yet published or accessible, sentiment is `unavailable` and the response is `partial` with a warning. Set `SENTIMENT_MODEL_SOURCE=local` to use the extracted checkpoint without a Hub call. `research_mode: live` never uses fixtures. The offline tests mock network and Hub inference.

To exercise Tavily and Gemini with illustrative input, use `marketing_agent/fixtures/sample_live_request.json`. This makes live API calls and may incur charges:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/marketing/analyze -ContentType application/json -InFile marketing_agent/fixtures/sample_live_request.json
```

Inspect `status`, `warnings`, and `execution` in the response. A successful live run should report `sentiment_engine: huggingface_distilbert` (or `local_distilbert` when configured locally), `research_engine: tavily_live`, `strategy_engine: configured_llm`, and nonzero `search_calls` and `llm_calls`. Search results can be empty or uncertain; the agent does not invent competitor facts.

If `MARKETING_API_TOKEN` is set in `.env`, include the bearer token in POST requests. For example, after setting a token in your current shell:

```powershell
$headers = @{ Authorization = "Bearer $env:MARKETING_API_TOKEN" }
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/marketing/analyze -Headers $headers -ContentType application/json -InFile marketing_agent/fixtures/demo_request.json
```

The WorkBuddy client defaults to `http://127.0.0.1:8000` and must be able to reach this server. When its files are present, run its `--health` and `--request` commands from the repository root. A remote WorkBuddy runtime needs a reachable HTTPS endpoint and the same bearer token.

## Existing sentiment checkpoint

The notebook exports `growthlab-sentiment-yelp-tuned.zip` and `growthlab-sentiment-amazon-adapted.zip`. Download the Yelp ZIP from your Google Drive to your computer. From `backend/`, assuming the ZIP is in Windows Downloads:

```powershell
New-Item -ItemType Directory -Force ml/model/growthlab-sentiment-yelp-tuned
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\growthlab-sentiment-yelp-tuned.zip" -DestinationPath ml/model/growthlab-sentiment-yelp-tuned -Force
Test-Path ml/model/growthlab-sentiment-yelp-tuned/config.json
Test-Path ml/model/growthlab-sentiment-yelp-tuned/model.safetensors
```

Both checks should print `True`. If the archive uses `pytorch_model.bin` instead, check that file in place of `model.safetensors`. The tokenizer files must also be in the same directory. For local inference, set `SENTIMENT_MODEL_SOURCE=local` in `backend/.env`, restart the backend, then rerun the demo request; `sentiment.model_status` should become `available` and `execution.sentiment_engine` should be `local_distilbert`. You can point `SENTIMENT_MODEL_PATH` at the extracted Amazon-adapted checkpoint for retail reviews. The classifier supports English reviews only.

## Publish and use the GrowthLab sentiment model on Hugging Face

The default upload source is `backend/ml/model/growthlab-sentiment-yelp-tuned/`, and the default Hub repository is `KaiHuang05/growthlab-sentiment-yelp-tuned`. The upload script validates that the checkpoint has config, weights, tokenizer files, and ordered `1_star` through `5_star` labels. It uploads only inference files, excluding `training_args.bin`. The repository can already exist; the script uses `exist_ok=True`.

Create a Hugging Face access token with write permission for the `KaiHuang05` namespace. Put it on the `HF_TOKEN=` line in `backend/.env` (do not commit or paste the token into a request). Alternatively, run `hf auth login` locally. From `backend/`:

```powershell
uv run --python 3.11 python upload_model.py
```

If your checkpoint is elsewhere or you choose a different repository, use `--model-dir` and `--repo-id`; set the same repository in `SENTIMENT_MODEL_ID` in `.env`. To use the published model, set `SENTIMENT_MODEL_SOURCE=hub` and restart the backend. The first inference downloads the model and tokenizer with `transformers`; later calls reuse them. A public repository needs no token for inference. A private repository needs a read-capable `HF_TOKEN`.

Test the existing marketing endpoint with sample reviews:

```powershell
$body = Get-Content marketing_agent/fixtures/demo_request.json -Raw
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/marketing/analyze -ContentType application/json -Body $body
```

Check `sentiment.model_status` and `execution.sentiment_engine`. Hub inference should report `available` and `huggingface_distilbert`. If the repository, credentials, or network are unavailable, the response reports `unavailable` with a warning rather than inventing sentiment results. Use `http://`, since the local server does not configure TLS.

## Dependency maintenance

For development, use `uv sync --dev --python 3.11`. The single `requirements.txt` includes runtime and test dependencies. For a fresh pip-based environment, from `backend/`:

```powershell
uv venv --python 3.11 --seed .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pytest -q
```

When `pyproject.toml` changes, regenerate the lock and export from `backend/`:

```powershell
uv lock --python 3.11
uv export --format requirements-txt --dev --no-hashes --output-file requirements.txt
```

The marketing pipeline lives in `marketing_agent/`; the existing Kaunter application lives in `app/`. No campaigns are published or funded by this service.

Copy `.env.example` to `.env` and set `GOOGLE_API_KEY` there before invoking an agent. Do not commit `.env`. LangSmith tracing is disabled by default and can be enabled through the variables documented in `.env.example`.

## Company manager chat

`POST /api/v1/chat` keeps `/create` widget commands and routes other messages to the company manager. The manager calls GrowthLab for marketing work, the finance invoice assurance engine for invoice checks, and Gemini specialists for broader financial and legal work, then combines their findings. Set `GOOGLE_API_KEY` and optionally `GEMINI_MODEL` in `.env` to enable it.

For invoice assurance, the manager also calls the deterministic checks in `finance/`. Set `FINANCE_WORKBOOK` and `FINANCE_INVOICE_INPUT_DIR` in `backend/.env` to local files and folders, or update `finance/config.json`. Invoice requests use those configured sources by default. Use `"finance": {"mode": "demo"}` only for a labeled synthetic example. A configured request can use `"finance": {"mode": "configured"}`; the manager also selects configured checks when it classifies a task as invoice assurance. Chat documents remain source-labeled context for the manager and are not parsed as invoice files. The response labels missing sources as unavailable and keeps unresolved checks explicit.

This chat path runs finance checks without creating approval reports, sending notifications, or calling the optional GPT risk review. The separate finance service still handles report snapshots and approval-bound distribution.

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

For marketing work, include a complete `marketing.business` profile in each request. `reviews` may be empty and `research_mode` defaults to `live`. Use `demo` only to request labeled fixture results:

```json
{
  "text": "Propose a local awareness campaign",
  "marketing": {
    "business": {
      "name": "GrowthCafe", "industry": "cafe", "location": "Subang Jaya, Malaysia",
      "products": ["coffee", "pastries"], "target_customers": "university students",
      "marketing_budget_rm": 500, "objective": "increase local awareness",
      "channels": ["Instagram", "TikTok"]
    },
    "reviews": [], "research_mode": "demo"
  }
}
```

If required business fields are missing, the manager lists them together. Chat is stateless, so send the full profile again on the next request. When `MARKETING_API_TOKEN` is configured, send the same `Authorization: Bearer <token>` header for marketing requests to `/api/v1/chat`; missing or invalid tokens return 401. Source-labeled chat documents become bounded `document-*` evidence in the GrowthLab report; campaign evidence IDs are validated. Live research uses Tavily, local sentiment supports English when weights are installed, and campaign ranking is heuristic. Missing services or weights produce a partial report with warnings. Every campaign requires owner approval.

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
