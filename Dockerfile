# =========================================================================
#  Online Coding Judge - production image
#
#  The runtime layer ships the Python, C++ and Java toolchains so that the
#  local sandbox can compile and execute all three languages even on hosts
#  that do not expose a Docker socket (free PaaS tiers, most notably).  Where
#  a socket *is* available the Docker backend takes over automatically and
#  these toolchains simply go unused.
# =========================================================================

# ---- Stage 1: build wheels ---------------------------------------------
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /wheels
COPY requirements.txt .
RUN pip wheel --wheel-dir /wheels -r requirements.txt


# ---- Stage 2: runtime ---------------------------------------------------
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000

# libpq5 for psycopg2; g++ and the JDK for the C++/Java toolchains.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libpq5 \
        g++ \
        default-jdk-headless \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /wheels /wheels
COPY requirements.txt .
RUN pip install --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels requirements.txt

WORKDIR /app
COPY . .

# Run as an unprivileged user. Note this is defence in depth for the *API*;
# the sandbox applies its own, much stricter, per-submission isolation.
RUN useradd --create-home --uid 10001 judge \
    && mkdir -p /tmp/judge \
    && chown -R judge:judge /app /tmp/judge
USER judge

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/api/v1/ping" || exit 1

# Render and similar platforms inject $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2 --proxy-headers"]
