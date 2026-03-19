@echo off
setlocal
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0livedoc.ps1" %*
