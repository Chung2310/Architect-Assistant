# ─── Stage 1: Build Frontend ─────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy manifests first for layer cache efficiency
COPY package.json package-lock.json ./

# --ignore-scripts: skip native addon compilation (canvas, etc.)
# The builder stage only runs `vite build` — no native modules needed.
RUN npm ci --ignore-scripts

# Copy source and build the frontend bundle
COPY . .
RUN npm run build

# ─── Stage 2: Production Runner ──────────────────────────────────────────────
FROM node:22-alpine AS runner

# Build tools needed by canvas node-gyp at install time
RUN apk add --no-cache \
    python3 \
    py3-setuptools \
    make \
    g++ \
    pkgconf \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev && \
    ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

ENV NODE_ENV=production
# PORT is injected at runtime via env_file in docker-compose.
# server.ts fallback is 3000.
EXPOSE 3002

# Copy pre-built frontend assets from builder
COPY --from=builder /app/dist ./dist

# Copy server source (tsx compiles at startup)
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/tsconfig.json ./

# Install all deps including native compilation of canvas
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci

# Remove build tools to reduce final image size
RUN apk del python3 py3-setuptools make g++ pkgconf \
    cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev pixman-dev

# Keep only runtime shared libs for canvas
RUN apk add --no-cache \
    cairo \
    pango \
    libjpeg-turbo \
    giflib \
    librsvg \
    pixman

CMD ["npm", "run", "start"]
