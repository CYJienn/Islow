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
