FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Optional self-hosted speech recognition: docker build --build-arg WITH_WHISPER=1 .
ARG WITH_WHISPER=0
COPY asr/requirements-serve.txt /tmp/asr-serve.txt
RUN if [ "$WITH_WHISPER" = "1" ]; then pip install --no-cache-dir -r /tmp/asr-serve.txt; fi
COPY . .
EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
