# AI Floor Plan Download Design

## Goal

Add a clearly visible download action directly below the floor selector in the AI floor-plan canvas. The action downloads the currently selected AI-generated floor plan as a high-resolution PNG.

## Scope

- Show the action only after a floor plan exists.
- Position it below the `Tầng 1 / Tầng 2 / ...` selector, aligned to the right side of the canvas.
- Use the existing download icon and the visual language of the floor selector.
- Keep the existing top-bar `Xuất PNG` action unchanged.
- Download only the currently selected floor.

## Interaction and Data Flow

1. The user selects a floor using the existing floor selector.
2. The user clicks `Tải xuống bản vẽ AI` below the selector.
3. The editor captures the currently rendered Konva stage at `pixelRatio: 2` as PNG.
4. The browser downloads the result with a sanitized filename containing the project name and one-based floor number.
5. A Vietnamese success toast confirms completion. A Vietnamese error toast is shown if capture fails.

For a one-floor project, the selector remains hidden as it is today, while the download action still appears in the same upper-right canvas area.

## Layout

The floor selector and download action will share a right-aligned vertical overlay container. This prevents overlap between the new action and the existing zoom controls. The download action uses a compact label plus icon so its purpose is explicit without occupying excessive canvas space.

## Implementation Boundary

The existing PNG export logic will be reused through a shared callback that accepts or derives the active floor number. No server endpoint, storage change, or new file format is required.

## Testing

- Verify the download action is visible when an AI floor plan exists.
- Verify it is absent before a plan exists.
- Verify clicking it triggers PNG export for the active floor with the expected filename.
- Run type checking, linting, and the production build after implementation.
