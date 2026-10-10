# Kaunter frontend

The Kaunter dashboard is a lightweight HTML, CSS, and JavaScript application run and bundled with Vite. It talks to the FastAPI backend through `/api/v1`.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- The backend running at `http://127.0.0.1:8000` for chat and widget generation

## Development

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` requests to the backend, so no frontend environment variable is needed for local development.

## Marketing Agent test page

Start the backend first from `backend/` with `uv run --python 3.11 python run.py`. Then open `http://127.0.0.1:5173/marketing.html` after starting Vite. The page has editable business details, comma-separated products/channels, one English review per line, a demo/live switch, and an optional Marketing API bearer token. It shows sentiment, competitor evidence, ranked campaigns, warnings, and the raw API response. The token stays in the page input and is not saved to local storage.

This page is plain HTML, CSS, and JavaScript. If Vite is not installed, you can serve it directly from `frontend/` using the backend's Python environment:

```powershell
..\backend\.venv\Scripts\python.exe -m http.server 5173 --bind 127.0.0.1
```

The local test page calls FastAPI on port `8000`; the backend already allows requests from `http://127.0.0.1:5173`. Use `http://`, not `https://`. Demo research uses labeled fixtures; live research makes Tavily and OpenAI calls and can use API credits.

## Production build

```powershell
npm run build
npm run preview
```

The production files are written to `dist/`. `npm run preview` serves them at `http://127.0.0.1:4173` for local verification.

## Main files

- `index.html` loads the dashboard and its scripts.
- `main.js` is the Vite module entrypoint and loads scripts in dependency order.
- `app.js` manages widgets, layouts, chat, and user interaction.
- `data.js` contains synthetic demo data.
- `i18n.js` contains English and Bahasa Malaysia copy.
- `style.css` and `pipeline.css` contain the interface styles.
- `vite.config.js` configures the development API proxy.

The application stores layout, language, completed items, and custom widgets in browser local storage.
