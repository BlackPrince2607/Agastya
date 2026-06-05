"""
Prompt templates for LLM calls — versioned text, kept out of Python logic.

Why a prompts folder:
- Designers / PMs can review copy without reading service code.
- Easier A/B tests: swap template files or load by feature flag later.
- Keeps PII / tone guidelines in one place when you add AI.

Populate with `.txt` or `.md` files when you integrate your model.
"""
