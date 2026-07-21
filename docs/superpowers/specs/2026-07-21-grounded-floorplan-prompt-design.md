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
5. Scan each room twice in a fixed top-to-bottom, left-to-right order. The first scan inventories movable furniture; the second inventories fixed fixtures and built-ins.
6. Build an immutable room inventory and a structured furniture manifest with exactly one entry per visible item.
7. Perform a coverage audit over every non-architectural footprint or CAD symbol, ensuring each is classified exactly once with no omission or duplicate.
8. Validate that the room count, functions, boundaries, adjacency, furniture mapping, and furniture counts in the final description match the inventories.
9. Only after validation, compose the final English rendering prompt.

When a label or symbol is unclear, the model must make the single most plausible interpretation from geometry, CAD conventions, nearby objects, and spatial context. It must not use uncertainty as permission to introduce an additional room or furniture item without visible supporting evidence.

## Furniture Manifest and Coverage Audit

Furniture detection is performed room by room in a fixed spatial order. Every room receives two explicit scans:

1. **Movable furniture scan:** beds, nightstands, sofas, armchairs, tables, individual chairs, desks, movable cabinets, shelves, benches, and other recognizable loose objects.
2. **Fixed fixture and built-in scan:** toilets, lavatories, bathtubs, showers, kitchen hobs, sinks, kitchen counters, built-in kitchen cabinets, wardrobes, and other recognizable fixed equipment.

The structured response includes `furniture_manifest`, an array in which each entry represents exactly one visible item. An entry contains the enclosing room, normalized item type, quantity `1`, relative position, orientation, and the visible CAD evidence used for identification. Repeated objects such as dining chairs are listed as separate entries rather than collapsed into a set.

The response also includes `furniture_count_validation`, which reports exact counts by room and item type and confirms that the total matches the manifest. A coverage audit must inspect every non-wall, non-opening, non-text, and non-dimension footprint or CAD symbol and classify it exactly once. The audit must correct omitted or duplicated items before the final prompt is emitted.

The furniture manifest includes both movable furniture and fixed fixtures. It is immutable after validation and must be embedded verbatim in the renderer-facing prompt. The final prompt must not summarize the inventory with phrases such as “etc.”, “other furniture”, “a dining set”, or “a furnished room”.

## Final Prompt Format

The user-visible and renderer-facing final prompt must be in English and read as several compact paragraphs, similar to a professional visual analysis rather than a short command or a JSON dump.

The prose must cover:

- the requested 3D floorplan visualization and exact camera/orientation constraints;
- every detected room, its relative location, boundary, and important adjacency;
- every detected furniture item grouped under its room, with relative position and orientation when discernible;
- exact furniture and fixed-fixture counts matching the immutable furniture manifest;
- preservation of walls, doors, windows, circulation, room count, room functions, and furniture placement;
- selected style, materials, lighting, color treatment, and photoreal PBR quality;
- explicit prohibitions against adding, deleting, splitting, merging, relabeling, relocating, or resizing rooms and against adding, deleting, replacing, or moving furniture.

The final prose must contain only the selected interpretation. It must not expose chain-of-thought, alternative guesses, confidence scores, JSON field names, or internal verification notes.

## Data Flow

1. The server sends the source floorplan plus user-selected style inputs to the existing prompt-analysis model.
2. The structured response retains analysis fields for internal validation, including the room manifest, room-count validation, and furniture-by-room inventory.
3. The structured response adds `furniture_manifest` and `furniture_count_validation` as renderer-facing sources of truth.
4. The schema requires the final optimized prompt to be English analytical prose.
5. `composeRenderPrompt` passes that grounded final prompt to the renderer and appends both immutable manifests and both count validations as defensive sources of truth.
6. The render-job controller adds a furniture preflight requiring output counts and placement to match the manifest before image generation.
7. Existing photoreal PBR and negative-prompt directives remain active.

## Guardrails

- Room labels, when readable, override furniture-based room guesses.
- Enclosed wall boundaries override stylistic assumptions.
- Furniture may help resolve an unclear room function but may not change a readable room label.
- A room or furniture item may only appear in the final prompt if supported by a visible label, enclosing geometry, CAD symbol, or recognizable visual footprint.
- Every furniture symbol is represented by exactly one manifest entry; similar repeated items are never collapsed into a set.
- Fixed fixtures and built-ins are mandatory inventory items, not optional decoration.
- The validation layer must repair discrepancies before emitting the final prompt.
- Styling may change materials, colors, lighting, and presentation only; it may not alter spatial or furniture content.

## Failure Handling

If the image is partially unclear, the model selects the most plausible interpretation and keeps it internally consistent across the inventory and final prompt. If the image contains too little usable floorplan information to identify any enclosed room, the result should state that the source is insufficient rather than fabricate a plan.

## Testing

Tests will verify that the `Floorplan to 3D Floorplan` template:

- explicitly requires English analytical prose;
- requires the two-layer inventory-and-validation sequence;
- requires grounded room and furniture detection;
- requires separate movable-furniture and fixed-fixture scans for every room;
- requires one manifest entry per item, exact counts, and a no-omission/no-duplicate coverage audit;
- permits best-fit inference for unclear symbols while forbidding unsupported additions;
- locks room geometry, count, function, adjacency, and furniture placement;
- keeps both immutable manifests, both count validations, and photoreal PBR directives in the composed render prompt;
- adds furniture preflight constraints to the renderer request;
- does not change prompt behavior for other tabs.
