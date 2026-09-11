@echo off
setlocal
set "CARD_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%CARD_PYTHON%" (
  "%CARD_PYTHON%" "%~dp0tools\card-editor\server.py"
) else (
  py -3 "%~dp0tools\card-editor\server.py"
)
if errorlevel 1 pause
endlocal
