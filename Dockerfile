# Stage 1: build the front end (site/) into static files. It reads web/ for the engine copies and data.
FROM node:22-slim AS site
WORKDIR /app
COPY web/ web/
COPY site/package.json site/package-lock.json site/
RUN cd site && npm ci --no-audit --no-fund
COPY site/ site/
ARG SITE_URL=http://localhost:8000
RUN cd site && NEXT_PUBLIC_SITE_URL=$SITE_URL npm run build

# Stage 2: the API, which also serves the built site at "/" (same origin for the dashboard and speech).
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Optional self-hosted speech recognition: docker build --build-arg WITH_WHISPER=1 .
ARG WITH_WHISPER=0
COPY asr/requirements-serve.txt /tmp/asr-serve.txt
RUN if [ "$WITH_WHISPER" = "1" ]; then pip install --no-cache-dir -r /tmp/asr-serve.txt; fi
COPY . .
COPY --from=site /app/site/out site/out
EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
