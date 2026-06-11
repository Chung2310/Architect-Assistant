# ─── Stage 1: Build Frontend ─────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Build-time deps required by the "canvas" native addon (node-gyp)
# pkgconf    = pkg-config replacement so node-gyp can locate C libraries
# python3    = required by node-gyp (symlinked as 'python' below)
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
    # node-gyp looks for 'python', Alpine only ships 'python3'
    ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Install deps from lock file for reproducible builds
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Stage 2: Production Runner ──────────────────────────────────────────────
FROM node:22-alpine AS runner

# Runtime shared libs needed by the canvas .node binary
RUN apk add --no-cache \
    cairo \
    pango \
    libjpeg-turbo \
    giflib \
    librsvg \
    pixman

WORKDIR /app

ENV NODE_ENV=production
# PORT is NOT hardcoded — injected at runtime via env_file in docker-compose.
# Fallback is 3000 (defined in server.ts).
EXPOSE 3000

# Copy pre-built frontend assets
COPY --from=builder /app/dist ./dist

# Copy server source (tsx compiles at startup)
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/tsconfig.json ./

# Copy manifests + pre-built node_modules (native binaries already compiled in builder)
COPY --from=builder /app/package.json /app/package-lock.json ./
# Re-install to get platform-specific binaries for this runner image
RUN apk add --no-cache python3 py3-setuptools make g++ pkgconf cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev pixman-dev && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    npm ci && \
    apk del python3 py3-setuptools make g++ pkgconf cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev pixman-dev

CMD ["npm", "run", "start"]
