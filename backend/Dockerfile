# Agastya FastAPI backend — built from repo root (Railway / Fly monorepo layout).
# Railway production uses the root Dockerfile (railway.toml dockerfilePath=Dockerfile).
# Keep COPY legal/ in sync with that root Dockerfile. Fly: fly deploy --dockerfile backend/Dockerfile.

FROM python:3.12-slim

WORKDIR /app

# Install dependencies first for layer caching
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source and public legal pages (Play Console deletion URL, etc.)
COPY backend/ .
COPY legal/ /app/legal/

# Railway injects PORT; default 8000 for local docker run
ENV PORT=8000
EXPOSE 8000

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1
