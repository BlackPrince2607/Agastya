# Agastya API — Docker image for Railway / Fly (build context = repo root).
FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend source + public legal HTML (Play Console / sharvo.online custom domain)
COPY backend/ .
COPY legal/ /app/legal/

ENV PORT=8000
EXPOSE 8000

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1
