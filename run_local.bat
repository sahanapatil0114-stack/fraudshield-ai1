@echo off
title FraudShield AI Launcher

echo ============================================================
echo  Starting FraudShield AI Services
echo ============================================================
echo.

:: 1. Start the Flask API in a new terminal window
echo [1/2] Starting Flask Fraud Detection API in a new window...
start "FraudShield Flask API (Port 5001)" cmd /k "cd api && python app.py"

:: 2. Start the Express Server in the current terminal window
echo [2/2] Starting Express Server (Port 3000) here...
echo.
npm run start
