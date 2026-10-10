param([ValidateSet('serve','run','status','connections')][string]$Command='serve',[int]$Port=8090)
$assurancePython=Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $assurancePython)) { $assurancePython='python' }
& $assurancePython (Join-Path $PSScriptRoot 'server.py') $Command --port $Port
