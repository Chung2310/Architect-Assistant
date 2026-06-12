# 🌌 Patterns

## 📦 Native Modules in Docker (Alpine)
- **Problem**: Compiling native modules (like `canvas`) from source in Alpine images using `node-gyp` requires intensive compiler resources (g++, make, Python) and frequently hangs or runs out of memory in CI/CD or resource-constrained environments.
- **Solution**: 
  1. Audit the codebase to check if the package is actually imported on the server side. If it is only used on the client-side (relying on browser's native `<canvas>`), remove it from `package.json`.
  2. If the package is required on the backend, switch to a Debian-based slim image (e.g., `node:22-slim`) which can download prebuilt glibc binaries instead of compiling from source.

## 🔑 Yarn Lockfile Consistency in Docker
- **Problem**: Running `yarn install` in Docker without copying the correct lockfile (`yarn.lock`) causes Yarn to perform a slow over-the-network version resolution, which is non-deterministic and prone to hanging.
- **Solution**: Always copy `yarn.lock` instead of `package-lock.json` when running `yarn` commands inside Docker, and use the `--frozen-lockfile` flag to enforce speed and consistency.

## 📞 PiAPI Asynchronous Integration with Webhook & Polling
- **Problem**: Third-party generation APIs (PiAPI, Midjourney, Flux) are slow and take 15s to several minutes. Polling synchronously during an HTTP request causes gateway timeouts.
- **Solution**:
  1. Trigger the generation task on PiAPI asynchronously and store the task ID (`piapiTaskId`) in the database.
  2. Expose a public webhook endpoint (`/api/v1/piapi/webhook`) for production environments to receive task updates.
  3. Run a lightweight polling worker (`polling.service.ts`) using `setInterval` to check status for active tasks, which acts as a fallback for production and makes local development work without NAT tunnels.
  4. Stream real-time status and output image URLs back to the client using WebSockets (Socket.io).

## 🐳 Two-Stage Production Docker with esbuild Backend Bundling
- **Problem**: Running Typescript directly in production containers via tsx or ts-node consumes high RAM, delays container startup due to on-the-fly compilation, and requires full source code inside the production runner.
- **Solution**:
  1. Implement a 2-stage Docker build.
  2. Stage 1 (Builder): Use `esbuild` to bundle `server.ts` into a single module `dist/server.cjs` with `--platform=node --format=cjs --packages=external`.
  3. Stage 2 (Runner): Copy only the `dist` bundle and package manifests, then install production-only dependencies using yarn cache mounts.
  4. Execute with raw node: `CMD ["node", "dist/server.cjs"]`.
