FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app app
COPY scripts/download-models.sh scripts/download-models.sh
RUN chmod +x scripts/download-models.sh && FACE_READ_MODEL_DIR=/app/models scripts/download-models.sh

ENV FACE_READ_MODEL_DIR=/app/models
ENV PORT=8080

EXPOSE 8080

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
