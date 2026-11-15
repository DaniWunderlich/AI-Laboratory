FROM ghcr.io/astral-sh/uv:0.12.18 AS uv
FROM python:3.12.11-slim-bookworm AS runtime
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PATH="/app/.venv/bin:$PATH" LAB_DATA_DIR=/data PYTHONUNBUFFERED=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY app ./app
COPY migrations ./migrations
RUN groupadd --gid 10001 laboratory && useradd --uid 10001 --gid laboratory --no-create-home laboratory && mkdir /data && chown laboratory:laboratory /data
USER laboratory
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz/ready', timeout=3)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

FROM runtime AS test
USER root
RUN uv sync --frozen --no-install-project
COPY tests ./tests
HEALTHCHECK NONE
CMD ["sh", "-c", "ruff check app migrations tests && pytest -q"]

FROM runtime AS production
