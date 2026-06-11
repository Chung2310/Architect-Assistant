# 🌌 Patterns

## 📦 Native Modules in Docker (Alpine)
- **Problem**: Compiling native modules (like `canvas`) from source in Alpine images using `node-gyp` requires intensive compiler resources (g++, make, Python) and frequently hangs or runs out of memory in CI/CD or resource-constrained environments.
- **Solution**: 
  1. Audit the codebase to check if the package is actually imported on the server side. If it is only used on the client-side (relying on browser's native `<canvas>`), remove it from `package.json`.
  2. If the package is required on the backend, switch to a Debian-based slim image (e.g., `node:22-slim`) which can download prebuilt glibc binaries instead of compiling from source.

## 🔑 Yarn Lockfile Consistency in Docker
- **Problem**: Running `yarn install` in Docker without copying the correct lockfile (`yarn.lock`) causes Yarn to perform a slow over-the-network version resolution, which is non-deterministic and prone to hanging.
- **Solution**: Always copy `yarn.lock` instead of `package-lock.json` when running `yarn` commands inside Docker, and use the `--frozen-lockfile` flag to enforce speed and consistency.
