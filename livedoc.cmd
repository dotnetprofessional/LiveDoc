@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0livedoc.ps1" %*
