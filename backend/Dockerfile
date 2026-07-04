# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:24-slim AS builder
WORKDIR /app

# openssl is required by Prisma CLI during generate
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src/
COPY server.ts ./
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:24-slim AS production
WORKDIR /app

# openssl: Prisma query engine runtime dependency
# chromium + fonts-liberation: Puppeteer PDF generation
# postgresql-client-17: pg_dump must match the Postgres 17 server version
RUN apt-get update && apt-get install -y curl gnupg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
       > /etc/apt/sources.list.d/postgresql.list \
    && apt-get update && apt-get install -y \
        openssl \
        chromium \
        fonts-liberation \
        postgresql-client-17 \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# Install only production dependencies (prisma CLI is now in dependencies)
RUN npm ci --omit=dev

COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

# Copy compiled application from builder
COPY --from=builder /app/dist ./dist/

# Copy AI knowledge base (markdown files read at runtime — not compiled by tsc)
COPY src/modules/ai/knowledge ./dist/src/modules/ai/knowledge/

# Ensure uploads directory exists (persisted via Docker volume)
RUN mkdir -p uploads/logos

EXPOSE 3001

# Run migrations on startup, then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
