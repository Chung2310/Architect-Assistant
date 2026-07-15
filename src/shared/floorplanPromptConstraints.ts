export const FLOORPLAN_FURNITURE_TRANSFORM_LOCK = [
  "FURNITURE TRANSFORM LOCK: the input floorplan is the absolute source of truth.",
  "Every furniture item must retain its exact position, type, quantity, relative spacing, footprint, size, shape, rotation angle, facing direction, and front/back/left/right orientation from the input.",
  "Preserve each item's exact relationship to walls, doors, windows, room boundaries, and neighboring objects.",
  "Do not move, rotate, reorient, reverse, or swap any furniture item. Do not mirror any furniture item. Do not flip any furniture item horizontally or vertically.",
  "Do not realign or rearrange the furniture. Do not optimize the furniture layout, even if another arrangement appears more functional or aesthetically pleasing.",
  "Camera angle and projection may change only the view of the model; they must never change any furniture transform in floorplan space.",
  "If a detail is ambiguous, preserve the interpretation closest to the input instead of inventing or correcting it.",
  "Only materials, colors, lighting, surface finishes, and render quality may change.",
].join(" ");

export const FLOORPLAN_FURNITURE_TRANSFORM_NEGATIVE = [
  "moved furniture",
  "rotated furniture",
  "mirrored furniture",
  "flipped orientation",
  "reversed direction",
  "reoriented objects",
  "relocated furniture",
  "rearranged furniture",
  "swapped furniture",
  "realigned furniture",
  "optimized layout",
].join(", ");
