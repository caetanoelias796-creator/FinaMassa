@echo off
title Fina Massa Pizzaria - Servidor de Teste Local
echo ====================================================
echo   INICIANDO SERVIDOR LOCAL DA FINA MASSA PIZZARIA...
echo ====================================================
powershell -ExecutionPolicy Bypass -File "%~dp0servidor_local.ps1"
pause