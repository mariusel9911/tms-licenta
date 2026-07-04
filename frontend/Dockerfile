# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:24-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production (Nginx) ───────────────────────────────────────────────
FROM nginx:alpine AS production

# Copy the compiled SPA
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx.conf is volume-mounted by docker-compose (staging.conf / production.conf)
# so we only need a minimal fallback here
RUN echo 'server { listen 80; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } }' \
    > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
