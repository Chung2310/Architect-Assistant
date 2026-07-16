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

export const trackRenderHeaderIntent = (
  tracker: ScrollTrackerState,
  deltaY: number,
): { tracker: ScrollTrackerState; visibility: ScrollVisibility } => {
  const sameDirection =
    tracker.accumulatedDelta === 0 ||
    Math.sign(deltaY) === Math.sign(tracker.accumulatedDelta);
  const accumulatedDelta = sameDirection
    ? tracker.accumulatedDelta + deltaY
    : deltaY;
  const visibility =
    accumulatedDelta >= RENDER_HEADER_SCROLL_THRESHOLD
      ? false
      : accumulatedDelta <= -RENDER_HEADER_SCROLL_THRESHOLD
        ? true
        : null;

  return {
    tracker: {
      scrollTop: tracker.scrollTop,
      accumulatedDelta: visibility === null ? accumulatedDelta : 0,
    },
    visibility,
  };
};
