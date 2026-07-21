const getString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const getStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(getString).filter(Boolean);
  }
  const single = getString(value);
  return single ? [single] : [];
};

const photorealPbrDirective = [
  "VISUAL QUALITY — PHOTOREAL PBR:",
  "Create a high-end photorealistic architectural visualization, not a stylized model or illustration.",
  "Use true-scale PBR materials with physically correct roughness, reflections, normal/bump detail and non-repeating textures: accurately scaled wood grain, tile joints, woven fabric, stone pores, brushed metal and realistic glass.",
  "Use physically plausible natural lighting, neutral exposure and white balance, soft contact shadows, restrained ambient occlusion and realistic indirect bounce light.",
  "Surfaces must have subtle real-world variation and minor imperfections; avoid overly clean, uniformly smooth or plastic-looking finishes.",
  "Keep the selected top-down or isometric cutaway camera, but render it with premium architectural-visualization realism rather than a miniature/dollhouse aesthetic.",
  "STYLE NEGATIVE: cartoon, illustration, anime, dollhouse, toy-like, miniature model, plastic materials, game asset, low-poly, stylized CGI, pastel toy palette, exaggerated textures, fake lighting, flat shading, uniform materials, oversaturated colors.",
].join("\n");

export function composeRenderPrompt(
  activeSubTab: string,
  resultObject: Record<string, unknown>,
): string {
  const isGroundedFloorplan = activeSubTab === "Floorplan to 3D Floorplan";
  const finalPrompt = isGroundedFloorplan
    ? getString(resultObject.optimized_english_prompt) ||
      getString(resultObject.prompt_tieng_viet_toi_uu)
    : getString(resultObject.prompt_tieng_viet_toi_uu) ||
      getString(resultObject.optimized_english_prompt);
  const negativePrompt =
    getString(resultObject.prompt_phu_dinh) ||
    getString(resultObject.negative_prompt);
  const sections = [finalPrompt];

  if (isGroundedFloorplan) {
    sections.push(photorealPbrDirective);
    const manifest = getStringList(resultObject.room_manifest);
    const roomCount = getString(resultObject.room_count_validation);
    const furnitureManifest = getStringList(resultObject.furniture_manifest);
    const furnitureCount = getString(resultObject.furniture_count_validation);
    const supportingAnalysis = [
      getString(resultObject.phan_tich_huong_ban_ve),
      getString(resultObject.phan_tich_phong_va_chuc_nang),
      getString(resultObject.nhan_dien_noi_that_theo_phong),
    ].filter(Boolean);

    if (manifest.length > 0 || roomCount || supportingAnalysis.length > 0) {
      sections.push([
        "IMMUTABLE ROOM MANIFEST — SOURCE OF TRUTH:",
        ...manifest.map((room, index) => `${index + 1}. ${room}`),
        roomCount ? `EXACT ROOM COUNT: ${roomCount}` : "",
        supportingAnalysis.length > 0
          ? `SUPPORTING SPATIAL ANALYSIS:\n${supportingAnalysis.join("\n")}`
          : "",
        "Never split, merge, relabel, relocate, add, or delete any room.",
        "Every labeled room must remain inside its original enclosing walls and retain its original adjacency.",
        "Room labels override furniture-based guesses. Do not create a fourth bedroom or infer any extra room not listed in this manifest.",
        "Only materials, colors, lighting, and 3D presentation may change.",
      ].filter(Boolean).join("\n"));
    }

    if (furnitureManifest.length > 0 || furnitureCount) {
      sections.push([
        "IMMUTABLE FURNITURE MANIFEST — SOURCE OF TRUTH:",
        ...furnitureManifest.map((item, index) => `${index + 1}. ${item}`),
        furnitureCount ? `EXACT FURNITURE COUNT: ${furnitureCount}` : "",
        "Render every manifest entry exactly once, including all fixed fixtures and built-ins.",
        "Never omit, duplicate, group, replace, relocate, or rotate any manifest item.",
        "Do not summarize items as etc., other furniture, a dining set, or a furnished room.",
      ].filter(Boolean).join("\n"));
    }
  }

  if (negativePrompt) sections.push(`Negative prompt: ${negativePrompt}`);
  return sections.filter(Boolean).join("\n\n");
}
