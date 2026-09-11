$ErrorActionPreference = 'Stop'
$serverScript = Join-Path $PSScriptRoot 'tools/card-editor/server.py'
$bundledPython = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
$pyLauncher = Get-Command py -ErrorAction SilentlyContinue
if (Test-Path -LiteralPath $bundledPython) {
    & $bundledPython $serverScript
} elseif ($pyLauncher) {
    & $pyLauncher.Source -3 $serverScript
} elseif ($pythonCommand) {
    & $pythonCommand.Source $serverScript
} else {
    Write-Host 'Python 3.10+ is required. Install Python, then run this file again.'
    Read-Host 'Press Enter to close'
    exit 1
}
