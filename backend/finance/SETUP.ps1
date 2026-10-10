$ErrorActionPreference = 'Stop'
$financeDependencies = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$financePython = Join-Path $financeDependencies 'python\python.exe'
$financePackages = Join-Path $financeDependencies 'node\node_modules'
if (-not (Test-Path -LiteralPath $financePython) -or -not (Test-Path -LiteralPath $financePackages)) {
    throw 'The report exporter requires the Codex bundled Python/Node dependencies. See README.md.'
}
$financeEnvironment = Join-Path $PSScriptRoot '.venv'
if (-not (Test-Path -LiteralPath (Join-Path $financeEnvironment 'Scripts\python.exe'))) {
    & python -m venv $financeEnvironment
    if ($LASTEXITCODE -ne 0) { throw 'Finance environment creation failed.' }
}
& (Join-Path $financeEnvironment 'Scripts\python.exe') -m pip install -r (Join-Path $PSScriptRoot 'workbuddy\requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Finance dependency installation failed.' }
& (Join-Path $financeEnvironment 'Scripts\python.exe') -m pip install -r (Join-Path $PSScriptRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Document intake dependency installation failed.' }
$financeModules = Join-Path $PSScriptRoot 'node_modules'
if (-not (Test-Path -LiteralPath $financeModules)) {
    New-Item -ItemType Junction -Path $financeModules -Target $financePackages | Out-Null
}
Write-Host 'Finance dependencies ready. Run .\START.ps1 and open http://127.0.0.1:8090.'
