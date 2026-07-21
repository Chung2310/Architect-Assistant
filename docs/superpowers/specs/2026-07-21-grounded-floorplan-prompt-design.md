# Grounded English Prompt for Floorplan to 3D Floorplan

## Scope

This change applies only to the `Floorplan to 3D Floorplan` workflow. Other render, interior, exterior, and `Floorplan to 3D` workflows retain their current behavior.

## Goal

Generate a strong English rendering prompt written as coherent analytical prose. The prompt must be grounded in the submitted floorplan, accurately describe the detected rooms and furniture, preserve the original plan, and avoid inventing rooms, furniture, or architectural elements.

## Selected Approach: Two-Layer Verification

The existing AI analysis call will perform two logical layers before producing the final rendering prompt:

1. **Grounded inventory:** read the floorplan and create a locked inventory of rooms, boundaries, adjacency, openings, circulation, and furniture assigned to each room.
2. **Consistency verification and prompt composition:** compare the proposed description against that inventory, correct any mismatch, and then write the final English prompt as analytical prose.

These are two stages within the same structured analysis request. This avoids the latency and cost of a second API request while providing stronger grounding than direct one-pass prompt writing.

## Analysis Rules

The model must process the input in this order:

1. Preserve source orientation. Do not rotate, mirror, or flip the plan.
2. Detect each enclosed room using visible walls, openings, labels, dimensions, CAD symbols, and spatial context.
3. Determine each room's function, position, boundary, and adjacency.
4. Detect each visible furniture item and map it to the enclosing room, including relative position and orientation when visible.
5. Build an immutable room and furniture inventory.
6. Validate that the room count, functions, boundaries, adjacency, and furniture mapping in the final description match the inventory.
7. Only after validation, compose the final English rendering prompt.

When a label or symbol is unclear, the model must make the single most plausible interpretation from geometry, CAD conventions, nearby objects, and spatial context. It must not use uncertainty as permission to introduce an additional room or furniture item without visible supporting evidence.

## Final Prompt Format

The user-visible and renderer-facing final prompt must be in English and read as several compact paragraphs, similar to a professional visual analysis rather than a short command or a JSON dump.

The prose must cover:

- the requested 3D floorplan visualization and exact camera/orientation constraints;
- every detected room, its relative location, boundary, and important adjacency;
- every detected furniture item grouped under its room, with relative position and orientation when discernible;
- preservation of walls, doors, windows, circulation, room count, room functions, and furniture placement;
- selected style, materials, lighting, color treatment, and photoreal PBR quality;
- explicit prohibitions against adding, deleting, splitting, merging, relabeling, relocating, or resizing rooms and against adding, deleting, replacing, or moving furniture.

The final prose must contain only the selected interpretation. It must not expose chain-of-thought, alternative guesses, confidence scores, JSON field names, or internal verification notes.

## Data Flow

1. The server sends the source floorplan plus user-selected style inputs to the existing prompt-analysis model.
2. The structured response retains analysis fields for internal validation, including the room manifest, room-count validation, and furniture-by-room inventory.
3. The schema requires the final optimized prompt to be English analytical prose.
4. `composeRenderPrompt` passes that grounded final prompt to the renderer and appends immutable inventory constraints as a defensive source of truth.
5. Existing photoreal PBR and negative-prompt directives remain active.

## Guardrails

- Room labels, when readable, override furniture-based room guesses.
- Enclosed wall boundaries override stylistic assumptions.
- Furniture may help resolve an unclear room function but may not change a readable room label.
- A room or furniture item may only appear in the final prompt if supported by a visible label, enclosing geometry, CAD symbol, or recognizable visual footprint.
- The validation layer must repair discrepancies before emitting the final prompt.
- Styling may change materials, colors, lighting, and presentation only; it may not alter spatial or furniture content.

## Failure Handling

If the image is partially unclear, the model selects the most plausible interpretation and keeps it internally consistent across the inventory and final prompt. If the image contains too little usable floorplan information to identify any enclosed room, the result should state that the source is insufficient rather than fabricate a plan.

## Testing

Tests will verify that the `Floorplan to 3D Floorplan` template:

- explicitly requires English analytical prose;
- requires the two-layer inventory-and-validation sequence;
- requires grounded room and furniture detection;
- permits best-fit inference for unclear symbols while forbidding unsupported additions;
- locks room geometry, count, function, adjacency, and furniture placement;
- keeps the immutable manifest and photoreal PBR directives in the composed render prompt;
- does not change prompt behavior for other tabs.

