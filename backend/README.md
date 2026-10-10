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

Open `backend/.env` and add your keys locally. Keep it out of Git. Marketing reads the existing `OPENAI_API_KEY` setting and uses `LLM_MODEL=gpt-6-luna` by default. `LLM_API_KEY` is still accepted as an optional override for compatibility. Add `TAVILY_API_KEY` for live competitor research. Add `MARKETING_API_TOKEN` only if you want bearer authentication on `POST /marketing/analyze`. Add `HF_TOKEN` for model upload or private Hub downloads. The model archive is separate from the API keys.

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
| `GET /docs` | OpenAPI documentation |

## Demo and API test

In another PowerShell terminal, from `backend/`:

```powershell
uv run --python 3.11 python -m marketing_agent.cli --demo
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/marketing/analyze -ContentType application/json -InFile marketing_agent/fixtures/demo_request.json
uv run --python 3.11 pytest -q
```

`research_mode: demo` always uses labeled competitor and campaign fixtures, even when API keys are configured, so this test makes no Tavily or OpenAI calls. Sentiment uses the Hugging Face model when `SENTIMENT_MODEL_SOURCE=hub`; if the repo is not yet published or accessible, sentiment is `unavailable` and the response is `partial` with a warning. Set `SENTIMENT_MODEL_SOURCE=local` to use the extracted checkpoint without a Hub call. `research_mode: live` never uses fixtures. The offline tests mock network and Hub inference.

To exercise Tavily and OpenAI with illustrative input, use `marketing_agent/fixtures/sample_live_request.json`. This makes live API calls and may incur charges:

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
