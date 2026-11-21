@echo off
title Push Simon Game to GitHub
cls
echo ==========================================================
echo           SIMON GAME - PUSH TO GITHUB
echo ==========================================================
echo.
echo Checking git status...
git status
echo.
set /p COMMIT_MSG="Enter commit message (or press Enter for 'Update Simon Game'): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Update Simon Game

echo.
echo Staging and committing changes...
git add .
git commit -m "%COMMIT_MSG%"

echo.
echo Pushing to GitHub (main branch)...
git push origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo ==========================================================
    echo SUCCESS! Pushed to https://github.com/jerradk83/simon-game
    echo Live site: https://jerradk83.github.io/simon-game/
    echo ==========================================================
) else (
    echo An error occurred while pushing.
)
pause
