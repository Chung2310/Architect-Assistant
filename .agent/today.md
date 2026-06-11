# 📅 Today - 2026-06-11

## 🛠 Fixes & Improvements
- **Issue**: Docker build hanging at `[runner 9/11] RUN yarn install` during `Building fresh packages...`.
- **Root Cause**: The unused native package `canvas` was present in `package.json`, causing Alpine to attempt compiling it from source via `node-gyp`. Additionally, `yarn.lock` was not copied in Docker stages (it copied `package-lock.json` instead, but ran `yarn`).
- **Resolution**:
  1. Removed `"canvas"` dependency from `package.json` since the backend does not import it, and the frontend relies on browser's native `<canvas>`.
  2. Regenerated `yarn.lock` locally.
  3. Simplified the `Dockerfile` to copy `yarn.lock` and run `yarn install --frozen-lockfile` without native compilers or library packages, speeding up the build dramatically.
- **Verification**: Run `yarn lint` and `yarn typecheck` successfully on host.
