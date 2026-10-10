@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Backend environment is missing. Run uv sync --dev --python 3.11 first.
  exit /b 1
)
".venv\Scripts\python.exe" run.py
