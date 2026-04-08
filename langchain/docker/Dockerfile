# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

# Install uv (fast Python package manager)
RUN pip install --no-cache-dir uv

WORKDIR /app

# Copy dependency manifest first (layer-cache friendly)
COPY pyproject.toml ./

# Install production dependencies into an isolated .venv
RUN uv venv .venv && \
    uv pip install --python .venv/bin/python -r pyproject.toml --no-cache

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# Copy only the pre-built venv from builder — no compiler/pip needed at runtime
COPY --from=builder /app/.venv .venv

# Copy application source
COPY app/ app/

# Activate the venv for all subsequent RUN/CMD instructions
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# Use JSON-array form for proper signal handling (no shell in between)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
