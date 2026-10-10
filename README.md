# Kaunter

Kaunter is a lightweight dashboard prototype for Malaysian SME owner-operators. The repository contains a static frontend, a FastAPI backend foundation, model research, demo presentation tooling, and product documentation.

## Repository layout

```text
backend/       FastAPI service, tests, and ML work
backend/finance/ Invoice assurance service, source inputs, and WorkBuddy expert package
frontend/      Vite-powered HTML/CSS/JavaScript dashboard
presentation/ Demo film renderer and assets
docs/          Product, design, research, and handoff documents
```

## Backend setup

From `backend/`, create an environment and install the project. The commands below use `uv`; standard `venv` and `pip` also work.

```powershell
uv sync --dev --python 3.11
Copy-Item .env.example .env
uv run python run.py
```

The API runs at `http://127.0.0.1:8000`, with interactive documentation at `http://127.0.0.1:8000/docs` and a health endpoint at `http://127.0.0.1:8000/api/v1/health`.

Run backend tests with:

```powershell
uv run pytest
```

## Frontend setup

The separate finance dashboard runs on port `8090`. See [backend/finance/README.md](backend/finance/README.md) for manual testing and the imported WorkBuddy expert package.

In a second terminal, start Vite from `frontend/`:

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies API requests to FastAPI at port `8000`. See `frontend/README.md` and `backend/README.md` for complete setup, build, and test instructions.

## Marketing Agent

The Marketing Agent is under `backend/marketing_agent/` and runs through the same backend server, dependency set, and `.env`. A simple test page is available at `http://127.0.0.1:5173/marketing.html` when the frontend is running. See [backend/README.md](backend/README.md) for API setup and [frontend/README.md](frontend/README.md) for page run commands.

## Presentation renderer

The presentation renderer is optional. From `presentation/`, install its Node dependency with `npm install`. Rendering video also requires Google Chrome, Python with NumPy, and FFmpeg. See `docs/HANDOFF_KH.md` for the demo details.
