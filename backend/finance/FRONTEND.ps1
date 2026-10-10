param([int]$Port=8765)
& (Join-Path $PSScriptRoot '.venv\Scripts\python.exe') (Join-Path $PSScriptRoot 'frontend_server.py') --port $Port
