# Invoice assurance

For the current simple OneDrive → document intake/OCR → checks → dashboard approval → Telegram flow, read [ONEDRIVE_FLOW.md](ONEDRIVE_FLOW.md). The local.env file selects the synced Excel references and PDF/DOCX/photo invoice folder. A completed run can email a review alert; the dashboard records approval before Telegram distribution. finance_export.json is overwritten only with complete supplied invoices.

Imported from `C:\Users\chuay\WorkBuddy AI` on 2026-10-10. This is a separate, local finance service on port 8090; the Kaunter FastAPI service and Vite frontend remain separate applications.

## Company manager integration

`POST /api/v1/chat` can run the deterministic invoice checks directly through `app/services/financial_tool.py`. The manager uses the workbook and invoice folder configured by `FINANCE_WORKBOOK` and `FINANCE_INVOICE_INPUT_DIR` in `backend/.env`, falling back to `config.json`. A `finance` payload with `mode: demo` runs a labeled synthetic example. The adapter runs in a worker thread and returns a bounded summary, source references, exceptions, and limitations. It does not create report snapshots, send notifications, approve distribution, or run the optional GPT risk review. The standalone service remains responsible for those separate workflows. Chat text documents are context for the manager, not invoice files for the assurance engine.

## Layout

- `engine.py`, `fixtures.py`: deterministic checks and separately labelled synthetic cases.
- `service.py`, `server.py`: SQLite history, report snapshots, human review and notification API.
- `report-template.html`, `export.mjs`: finance dashboard and detailed Excel export.
- `inputs/`: supplied workbook, supporting Word document and original orchestration JSON. Document instructions are untrusted reference content, not executable policy.
- `skills/`: six original WorkBuddy expert skill documents, standardized to `SKILL.md`.
- `workbuddy/`: generated expert package with agents, skills, schemas, shared rules, scripts and offline tests. This package was located through the source package builder's output path.
- `dashboard-reference.html`: earlier standalone dashboard, retained as a design reference.
- `state/`: generated local reports, approvals, deliveries and database; ignored by Git.

Existing state, approvals, generated reports, Python caches, archives and local credentials were not imported. Sources were copied without modifying the WorkBuddy installation.

## Start on this computer

```powershell
cd C:\Users\chuay\Islow\backend\finance
.\SETUP.ps1
.\START.ps1
```

Open http://127.0.0.1:8090. Stop with Ctrl+C. The setup script links the installed Codex Node packages for the existing `@oai/artifact-tool` Excel exporter and installs Python dependencies in a local `.venv`. The exporter currently requires that bundled runtime; ordinary Node alone is insufficient. Set `ASSURANCE_NODE` to override its executable. No cloud or LLM is required for invoice checks.

Other manual commands:

```powershell
.\START.ps1 -Command run
.\START.ps1 -Command status
.\START.ps1 -Command connections
python -m unittest discover -s . -p 'test_*.py'
```

`run` creates a draft report without approving or sending it. Configuration input paths resolve relative to `config.json`. Change the workbook there to analyze a different batch. The supplied workbook has invoice headers; complete line-level three-way matching cannot be established without invoice-line evidence. Missing evidence stays UNKNOWN. Synthetic test cases remain separate from supplied invoices.

Use `.\.venv\Scripts\python.exe run_experts.py` for the Python entrypoint. See [CONNECTIONS.md](CONNECTIONS.md) for Telegram, Outlook, OneDrive, the canonical team runner and manual end-to-end testing. `.env` is loaded by START.ps1's Python entrypoint and helper scripts. Report completion handoffs are queued in `state/orchestrator-outbox`; actual WorkBuddy SendMessage dispatch requires its live tool and recipient ID.

## WorkBuddy package tests

Use a dedicated environment for the imported expert package:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r workbuddy\requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s workbuddy\tests
```

The copied package is available for review and installation; copying it into this repository does not register a team in WorkBuddy. The package scripts and standalone service are distinct implementations and use different notification environment names; consult their code before deployment.

## Human review and notifications

Scheduling remains disabled. The standalone service requires explicit approval of the exact report snapshot and a separate send confirmation. Approval authorizes report distribution, not payments or clearing invoice findings. It uses these environment variables:

- `MICROSOFT_OUTLOOK_TOKEN`, `OUTLOOK_RECIPIENTS` (comma-separated addresses).
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

Keep credentials outside Git. `connections` reports configuration presence; it does not verify live delivery. No notifications are sent during setup or tests. The local reviewer label is not enterprise authentication; add authenticated identity before shared deployment. No schedule, payment action or external delivery was enabled during this import.
