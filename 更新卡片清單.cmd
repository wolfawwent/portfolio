@echo off
chcp 65001 >nul
rem 掃描 card\ 資料夾裡的 card_*.png，寫成 card\cards.json 給網站讀
powershell -NoProfile -Command ^
  "$files = Get-ChildItem -Path '%~dp0card' -File | Where-Object { $_.Name -match '^card_.*\.(png|webp|gif)$' } | Sort-Object CreationTime | ForEach-Object { $_.Name };" ^
  "$json = if ($files) { '[' + (($files | ForEach-Object { '\"' + $_ + '\"' }) -join ', ') + ']' } else { '[]' };" ^
  "[IO.File]::WriteAllText('%~dp0card\cards.json', $json, (New-Object Text.UTF8Encoding $false));" ^
  "Write-Host ('已寫入 card\cards.json：' + $json)"
pause
