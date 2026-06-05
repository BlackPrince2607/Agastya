"""
Business logic layer — keep routes thin.

Why services exist:
- Routes should not contain heavy logic (harder to test, messy imports).
- One service function can be reused by multiple routes or background jobs.
- When you add Supabase or OpenAI, those clients live behind service functions.

Start empty; add e.g. `reading_service.py` when you persist generated reports.
"""
