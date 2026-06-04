@echo off
rem Change to project directory
cd /d "C:\Users\HP\.gemini\antigravity\scratch\school-management-system"
rem Open the default browser to the local server URL
start "" "http://localhost:8000"
rem Start the simple HTTP server on port 8000
python -m http.server 8000
pause