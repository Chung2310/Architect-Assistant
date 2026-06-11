# ─── Stage 1: Build Frontend ─────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy manifests first for layer cache efficiency
COPY package.json yarn.lock ./

# Install dependencies using yarn
RUN yarn install --frozen-lockfile

# Copy source and build the frontend bundle
COPY . .
RUN yarn run build

# ─── Stage 2: Production Runner ──────────────────────────────────────────────
FROM node:22-alpine AS runner

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

# Install dependencies (frozen-lockfile ensures deterministic, fast installation)
COPY --from=builder /app/package.json /app/yarn.lock ./
RUN yarn install --frozen-lockfile

CMD ["yarn", "run", "start"]
