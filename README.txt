HVAC Diagnostic App v7.4b - Send Report Patch
=============================================

This package adds a "Send Report" button that emails the CSV log via your relay API.

FILES:
- index.html (drop-in replacement for your current index.html)
- send-report.v74b.js (new script)
- README.txt (this file)

INSTALL:
1. Replace your index.html with the provided version.
2. Place send-report.v74b.js alongside index.html and your existing scripts.
3. Edit send-report.v74b.js to set your email address and optional shared secret.

VERIFY:
- Refrigerant list populates correctly.
- Diagnose button functions with confidence values.
- Manual ΔT entry works (fallback and calculated modes).
- Export CSV still works as before.
- "Send Report" button appears next to Export CSV and emails logs.
