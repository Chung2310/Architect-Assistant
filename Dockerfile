# ─── Stage 1: Build Frontend ─────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Native deps required by "canvas" package
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev

WORKDIR /app

# Copy lock file first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Stage 2: Production Runner ──────────────────────────────────────────────
FROM node:22-alpine AS runner

# Same native runtime libs needed by canvas at runtime
RUN apk add --no-cache \
    cairo \
    pango \
    libjpeg-turbo \
    giflib \
    librsvg \
    pixman

WORKDIR /app

ENV NODE_ENV=production
# PORT is intentionally NOT hardcoded here.
# It will be injected at runtime via env_file in docker-compose.
# Default fallback in server.ts is 3000.
EXPOSE 3000

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server source
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/tsconfig.json ./

# Copy manifests and install ALL deps (including tsx for running server.ts)
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci

CMD ["npm", "run", "start"]
