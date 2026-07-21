export function buildAIFloorPlanFilename(
  projectName: string,
  activeFloorIndex: number
): string {
  const safeProjectName =
    projectName
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, "_") || "igen_floorplan";

  return `${safeProjectName}_floor_${activeFloorIndex + 1}.png`;
}
