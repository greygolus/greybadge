@echo off
title BadgeBetter local server
cd /d "%~dp0"
if not exist node_modules call npm install
echo BadgeBetter is starting...
echo Keep this window open while using the app. Press Ctrl+C to stop it.
start "" "http://localhost:8765"
call npm run dev
