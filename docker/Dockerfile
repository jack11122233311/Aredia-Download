FROM python:3.11-slim

# Install system dependencies: ffmpeg, ca-certificates, curl, atomicparsley
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ffmpeg \
      ca-certificates \
      curl \
      gosu \
      && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy backend and frontend source
COPY backend/app /app/app
COPY frontend /app/frontend
COPY docker/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV DOWNLOAD_DIR=/downloads
ENV CONFIG_DIR=/config
ENV PUID=1000
ENV PGID=1000

# Create standard directories
RUN mkdir -p /downloads /config

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
