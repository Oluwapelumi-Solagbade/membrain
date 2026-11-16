# Hugging Face Space for the MemBrain demo: runs the same image GitHub builds on every push
# (API + new site + Gulf Whisper dictation). To pick up a new push: Space Settings -> Factory rebuild.
FROM ghcr.io/oluwapelumi-solagbade/membrain:latest
# Spaces run as a non-root user: keep the model download cache somewhere writable.
ENV HF_HOME=/tmp/hf \
    WHISPER_MODEL=Vulcan-Spark/membrain-whisper-gulf-ct2 \
    SERVER_IN_UAE=0
EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
