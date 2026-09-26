# Resume Matcher Docker Image
# Multi-stage build for Next.js Standalone

# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app/frontend

ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies
COPY apps/frontend/package*.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy application source and build Next.js standalone application
COPY apps/frontend/ ./
RUN npm run build

# ============================================
# Stage 2: Production Final Image
# ============================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build assets from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/frontend/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/v1/status || exit 1

CMD ["node", "server.js"]

