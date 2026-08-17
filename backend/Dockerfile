FROM python:3.10-slim

# Hugging Face Docker Spaces run the container as UID 1000, not root -
# create that user up front so file writes (e.g. the uploads/ dir at
# runtime) don't hit permission errors.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH
WORKDIR $HOME/app

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY --chown=user . .

EXPOSE 7860

# Shell form (not exec form) so $PORT is expanded - Render injects its own
# PORT env var and expects the app to bind to it; Hugging Face Spaces
# doesn't set one, so this falls back to 7860 (the app_port in README.md).
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}
