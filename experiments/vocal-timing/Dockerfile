FROM python:3.12.14-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ORT_DISABLE_TELEMETRY=1 \
    HF_HUB_DISABLE_TELEMETRY=1 \
    HF_HOME=/cache/huggingface \
    TORCH_HOME=/cache/torch \
    NLTK_DATA=/opt/nltk_data \
    OMP_NUM_THREADS=2 \
    TMPDIR=/tmp/walvr

# Debian package hooks and pip already use TMPDIR during installation.
RUN mkdir -p /tmp/walvr && chmod 700 /tmp/walvr \
    && apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY experiments/vocal-timing/requirements-cpu.txt /app/requirements-cpu.txt
RUN python -m pip install --no-cache-dir torch==2.8.0 torchaudio==2.8.0 \
    --index-url https://download.pytorch.org/whl/cpu \
    && python -m pip install --no-cache-dir -r /app/requirements-cpu.txt \
    && python -m pip install --no-cache-dir --no-deps whisperx==3.8.6 \
    && python -c "import nltk; assert nltk.download('punkt_tab', download_dir='/opt/nltk_data', quiet=True)"
COPY experiments/vocal-timing/pipeline.py experiments/vocal-timing/worker.py \
    experiments/vocal-timing/preflight.py \
    experiments/vocal-timing/test_pipeline.py experiments/vocal-timing/test_worker.py \
    experiments/vocal-timing/test_preflight.py /app/experiments/vocal-timing/
COPY experiments/vocal-timing/evaluate.py experiments/vocal-timing/test_evaluate.py /app/experiments/vocal-timing/
RUN mkdir -p /cache/huggingface /cache/torch /tmp/walvr \
    && chown -R 10001:10001 /cache /tmp/walvr && chmod 700 /tmp/walvr
USER 10001:10001
WORKDIR /app/experiments/vocal-timing
ENTRYPOINT ["python", "/app/experiments/vocal-timing/worker.py"]
