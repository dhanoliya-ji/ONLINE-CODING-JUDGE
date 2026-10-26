# =========================================================================
#  Online Coding Judge - production image
#
#  The image ships the Python, C++ and Java toolchains so the local sandbox
#  can compile and execute all three languages even on hosts that do not
#  expose a Docker socket (free PaaS tiers, most notably).  Where a socket
#  *is* available the Docker backend takes over automatically and these
#  toolchains simply go unused.
#
#  Deliberately a single stage.  Every dependency in requirements.txt ships a
#  prebuilt manylinux wheel, so there is nothing to compile at install time
#  and a builder stage would only add failure modes (a `--no-index` install
#  breaks if the wheel set is incomplete for any reason).
# =========================================================================

# The Debian release is pinned deliberately. `python:3.11-slim` follows
# whatever Debian is current, and that moved from bookworm to trixie - which
# removed the openjdk-17 packages. Pinning keeps the apt package names below
# valid instead of letting an upstream retag break the build.
# Pinned to a digest as well as a tag: a tag can be re-pointed, a digest
# cannot. Dependabot (docker ecosystem) bumps the digest when the tag moves.
FROM python:3.11-slim-trixie@sha256:b7a9e5f6a93d6d4a31f129bbd4bdee69efccb6ded0fb230d78aafaf37af98377

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=8000

# ca-certificates is installed first and on its own: the Java packages run a
# post-install hook that needs it, and installing them together is a known
# source of dpkg failures on slim images.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Runtime dependencies -- one toolchain per supported language:
#   libpq5                  - psycopg2 needs it to talk to Postgres
#   g++ (brings gcc)        - compiles C and C++ submissions
#   openjdk-21-jdk-headless - compiles and runs Java. 21 is the JDK Debian
#     trixie ships; `-headless` skips the GUI libraries a judge never uses.
#   golang-go (1.24), rustc (1.85), ruby (3.3), php-cli (8.4) - as trixie
#     ships them. Named explicitly so the versions are visible here.
#
# Kotlin, C# and Swift are deliberately absent: each compiler wants 0.5-1 GB
# of RAM, more than the free host this image is deployed to has in total.
#
# The version checks at the end are load-bearing: without them a missing
# toolchain would surface as every submission in that language failing in
# production instead of as a failed build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libpq5 \
        g++ \
        openjdk-21-jdk-headless \
        golang-go \
        rustc \
        ruby \
        php-cli \
        xz-utils \
    && rm -rf /var/lib/apt/lists/* \
    && javac -version && g++ --version | head -1 && gcc --version | head -1 \
    && go version && rustc --version && ruby --version && php --version | head -1

# Node.js for JavaScript and TypeScript. Debian trixie ships Node 20, which
# cannot run TypeScript; Node 24 strips types natively. Fetched from
# nodejs.org and checked against the published SHA-256 -- a tampered or
# truncated download fails the build here, before anything runs it.
ARG NODE_VERSION=24.22.0
ARG NODE_SHA256=cc2f601cee82d9a5a233302fe307abc600727035fd7d2c3a3571755989e95008
RUN curl -fsSLo /tmp/node.tar.xz "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum -c - \
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 --no-same-owner \
        --exclude='*/include' --exclude='*/share' --exclude='*/lib/node_modules/npm' --exclude='*/bin/npm' --exclude='*/bin/npx' --exclude='*/bin/corepack' \
    && rm /tmp/node.tar.xz \
    && node --version

# Go compiles its standard library on first use, which on a free-tier CPU
# would eat most of a submission's 15 s compile budget. Building one program
# that touches the usual packages fills the cache now, at image build time.
ENV GOCACHE=/opt/go-cache
RUN mkdir -p /tmp/warm && cd /tmp/warm \
    && printf 'package main\nimport (\n"bufio"\n"fmt"\n"math"\n"os"\n"sort"\n"strconv"\n"strings"\n)\nfunc main(){r:=bufio.NewReader(os.Stdin);_=r;fmt.Println(math.Max(1,2),sort.IntsAreSorted(nil),strconv.Itoa(1),strings.ToUpper("a"))}\n' > main.go \
    && GOTOOLCHAIN=local CGO_ENABLED=0 go build -o warm main.go \
    && cd / && rm -rf /tmp/warm

WORKDIR /app

# Dependencies before source, so a code change does not invalidate this layer.
COPY requirements.txt .
# The base image ships pip and setuptools with known CVEs (setuptools vendors
# jaraco.context and wheel); upgrade them before installing anything.
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as an unprivileged user. This is defence in depth for the *API*; the
# sandbox applies its own, much stricter, per-submission isolation.
RUN useradd --create-home --uid 10001 judge \
    && mkdir -p /tmp/judge \
    && chown -R judge:judge /app /tmp/judge /opt/go-cache
USER judge

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT:-8000}/api/v1/ping" || exit 1

# Render and similar platforms inject $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2 --proxy-headers"]
