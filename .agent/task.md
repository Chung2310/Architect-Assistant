# 📋 Tasks

- [x] Diagnose root cause of hanging build at runner `yarn install` (C++ source compilation of `canvas`).
- [x] Audit backend and frontend to check if `canvas` npm package is imported (not imported anywhere).
- [x] Remove `"canvas"` from `package.json` dependencies.
- [x] Update `yarn.lock` by running `yarn install` locally.
- [x] Optimize `Dockerfile` to copy `yarn.lock` instead of `package-lock.json` and remove build toolchain installs.
- [x] Verify code correctness with `yarn lint` and `yarn typecheck`.
