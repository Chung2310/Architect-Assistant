# Automatic Rendering Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically hide the Rendering title and main tabs when users scroll down and restore them when users scroll up on every viewport.

**Architecture:** A pure intent tracker converts wheel/touch deltas into `true`, `false`, or no visibility change after a 12px directional threshold. `Render` listens in capture phase so nested panels work, while layout-driven `scrollTop` changes are ignored to prevent feedback loops during the header transition.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Node test runner through the existing `tsx` dev dependency.

## Global Constraints

- Only the internal Rendering title, description, social links, and main tab row are collapsible.
- Apply the behavior on every viewport.
- Use a 12px directional threshold.
- Support mouse, touchpad, touch scrolling, and nested scroll containers.
- The global `Layout` app bar must remain independent.
- Do not add manual hide/show controls, persistence, context, or dependencies.

---

### Task 1: Specify and implement directional scroll tracking

**Files:**
- Modify: `src/components/render/renderHeaderState.test.ts`
- Modify: `src/components/render/renderHeaderState.ts`

**Interfaces:**
- Produces: `RENDER_HEADER_SCROLL_THRESHOLD`, `ScrollTrackerState`, `ScrollVisibility`, `createScrollTracker()`, and `trackRenderHeaderScroll(tracker, scrollTop)`.

- [ ] **Step 1: Replace the manual-toggle tests with failing scroll tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  createScrollTracker,
  INITIAL_RENDER_HEADER_EXPANDED,
  RENDER_HEADER_SCROLL_THRESHOLD,
  trackRenderHeaderScroll,
} from "./renderHeaderState";

test("render header starts expanded with a 12px threshold", () => {
  assert.equal(INITIAL_RENDER_HEADER_EXPANDED, true);
  assert.equal(RENDER_HEADER_SCROLL_THRESHOLD, 12);
});

test("hides only after downward scrolling reaches the threshold", () => {
  const first = trackRenderHeaderScroll(createScrollTracker(), 7);
  assert.equal(first.visibility, null);
  const second = trackRenderHeaderScroll(first.tracker, 12);
  assert.equal(second.visibility, false);
});

test("resets accumulated distance when direction changes", () => {
  const down = trackRenderHeaderScroll(createScrollTracker(), 8);
  const up = trackRenderHeaderScroll(down.tracker, 4);
  const downAgain = trackRenderHeaderScroll(up.tracker, 11);
  assert.equal(downAgain.visibility, null);
  assert.equal(downAgain.tracker.accumulatedDelta, 7);
});

test("shows after upward scrolling reaches the threshold", () => {
  const start = { scrollTop: 30, accumulatedDelta: 0 };
  const result = trackRenderHeaderScroll(start, 18);
  assert.equal(result.visibility, true);
});

test("always shows and resets tracking at the top", () => {
  const result = trackRenderHeaderScroll({ scrollTop: 20, accumulatedDelta: 10 }, 0);
  assert.deepEqual(result, {
    tracker: createScrollTracker(),
    visibility: true,
  });
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `npx tsx --test src/components/render/renderHeaderState.test.ts`
Expected: FAIL because the new scroll tracker exports do not exist.

- [ ] **Step 3: Implement the minimal pure tracker**

```ts
export const INITIAL_RENDER_HEADER_EXPANDED = true;
export const RENDER_HEADER_SCROLL_THRESHOLD = 12;

export interface ScrollTrackerState {
  scrollTop: number;
  accumulatedDelta: number;
}

export type ScrollVisibility = boolean | null;

export const createScrollTracker = (): ScrollTrackerState => ({
  scrollTop: 0,
  accumulatedDelta: 0,
});

export const trackRenderHeaderScroll = (
  tracker: ScrollTrackerState,
  scrollTop: number,
): { tracker: ScrollTrackerState; visibility: ScrollVisibility } => {
  if (scrollTop <= 0) {
    return { tracker: createScrollTracker(), visibility: true };
  }

  const delta = scrollTop - tracker.scrollTop;
  const sameDirection =
    tracker.accumulatedDelta === 0 ||
    Math.sign(delta) === Math.sign(tracker.accumulatedDelta);
  const accumulatedDelta = sameDirection
    ? tracker.accumulatedDelta + delta
    : delta;
  const visibility =
    accumulatedDelta >= RENDER_HEADER_SCROLL_THRESHOLD
      ? false
      : accumulatedDelta <= -RENDER_HEADER_SCROLL_THRESHOLD
        ? true
        : null;

  return {
    tracker: {
      scrollTop,
      accumulatedDelta: visibility === null ? accumulatedDelta : 0,
    },
    visibility,
  };
};
```

- [ ] **Step 4: Run the test to verify GREEN**

Run: `npx tsx --test src/components/render/renderHeaderState.test.ts`
Expected: 5 tests pass.

### Task 2: Connect automatic tracking to Rendering

**Files:**
- Modify: `src/components/Render.tsx`

**Interfaces:**
- Consumes: `createScrollTracker`, `ScrollTrackerState`, and `trackRenderHeaderScroll`.
- Produces: capture-phase automatic visibility behavior for every nested scrolling `HTMLElement`.

- [ ] **Step 1: Remove the manual controls**

Delete both button blocks, `toggleRenderHeader`, and all related accessibility labels. Keep `isHeaderExpanded` and the transition wrapper.

- [ ] **Step 2: Add per-container scroll tracking**

Create `contentAreaRef`, create `useRef(new WeakMap<HTMLElement, ScrollTrackerState>())`, and attach a passive capture-phase `scroll` listener. For each event target, synchronously update that target's tracker; call `setIsHeaderExpanded(result.visibility)` only when visibility is not `null`.

- [ ] **Step 3: Preserve layout and reduced-motion behavior**

Attach `contentAreaRef` to the content card and add `motion-reduce:transition-none` to the existing header transition wrapper. Do not dispatch `igenContentScroll` and do not modify `Layout.tsx`.

- [ ] **Step 4: Verify the implementation**

Run: `npx tsx --test src/components/render/renderHeaderState.test.ts`
Expected: 5 tests pass.

Run: `npx eslint src/components/Render.tsx src/components/render/renderHeaderState.ts src/components/render/renderHeaderState.test.ts`
Expected: exit code 0.

Run: `npm run build`
Expected: exit code 0, allowing the existing large-chunk warning.

- [ ] **Step 5: Review scope**

Run: `git diff --check` and inspect the focused source diff.
Expected: no whitespace errors; no manual controls, no `Layout.tsx` diff, and no generated `dist` changes remain after verification cleanup.
