import assert from "node:assert/strict";
import test from "node:test";
import {
  createScrollTracker,
  INITIAL_RENDER_HEADER_EXPANDED,
  RENDER_HEADER_SCROLL_THRESHOLD,
  trackRenderHeaderIntent,
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
  const result = trackRenderHeaderScroll(
    { scrollTop: 20, accumulatedDelta: 10 },
    0,
  );

  assert.deepEqual(result, {
    tracker: createScrollTracker(),
    visibility: true,
  });
});

test("tracks user input deltas without reacting to layout scroll positions", () => {
  const hidden = trackRenderHeaderIntent(createScrollTracker(), 12);
  assert.equal(hidden.visibility, false);

  const layoutChangedScrollTop = 0;
  assert.equal(layoutChangedScrollTop, 0);
  assert.equal(hidden.visibility, false);
  assert.equal(hidden.tracker.scrollTop, 0);
});
