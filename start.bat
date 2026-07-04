@echo off
title VaultMotion
cd /d "C:\Users\kurtc\Downloads\claude code\vaultmotion"
start "VaultMotion" cmd /k "npm run dev"
timeout /t 6 /nobreak >nul
start "" "http://localhost:5174"
