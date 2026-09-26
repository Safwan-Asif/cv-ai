# Resume Matcher Docker Image
# Multi-stage build

# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:22-bookworm AS frontend-builder

ARG NEXT_PUBLIC_API_URL=/
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

WORKDIR /app/frontend

COPY apps/frontend/package*.json ./

RUN npm install -g npm@latest && \
    npm cache clean --force && \
    npm install --legacy-peer-deps --no-audit

COPY apps/frontend/ ./

RUN npm run build

# ============================================
# Stage 2: Final Image
# ============================================
FROM python:3.13-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libgtk-3-0 \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=frontend-builder /usr/local/bin/node /usr/local/bin/node

# Install uv for fast, fail-safe python package installation
RUN pip install uv

# Copy all repository source files into /app
COPY . /app

# Install Backend Dependencies
RUN cd /app/apps/backend && \
    if [ -f "pyproject.toml" ]; then \
        uv pip install --system .; \
    elif [ -f "src/pyproject.toml" ]; then \
        cd src && uv pip install --system .; \
    elif [ -f "requirements.txt" ]; then \
        uv pip install --system -r requirements.txt; \
    else \
        pip install --no-cache-dir -e .; \
    fi

# Setup Frontend Standalone Runtime
WORKDIR /app/frontend
COPY --from=frontend-builder /app/frontend/.next/standalone ./
COPY --from=frontend-builder /app/frontend/.next/static ./.next/static
COPY --from=frontend-builder /app/frontend/public ./public

# Startup Setup
COPY docker/start.sh /app/start.sh
RUN sed -i 's/\r$//' /app/start.sh && chmod +x /app/start.sh

RUN mkdir -p /app/apps/backend/data /app/backend/data

RUN useradd -m -u 1000 appuser \
    && chown -R appuser:appuser /app

USER appuser

RUN python -m playwright install chromium

EXPOSE 3000

VOLUME ["/app/apps/backend/data"]

WORKDIR /app

HEALTHCHECK --interval=10s --timeout=10s --start-period=30s --retries=5 \
    CMD curl -f http://127.0.0.1:8000/api/v1/health || exit 1

CMD ["/app/start.sh"]
