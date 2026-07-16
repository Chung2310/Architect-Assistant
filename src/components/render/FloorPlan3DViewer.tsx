import React, { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FloorPlanData, Room as _Room, Opening as _Opening, FurnitureItem as _FurnitureItem } from "./FloorPlanEditor";

interface FloorPlan3DViewerProps {
  floorPlan: FloorPlanData;
  wallThickness?: number; // in mm, default 100
  finishes?: Record<string, { type: "material" | "color"; value: string; name: string }>;
  activeCamera: {
    id: string;
    roomId: string;
    x: number;
    y: number;
    rotation: number;
    fov: number;
    aspectRatio?: string;
  } | null;
  onCaptureRef?: React.MutableRefObject<(() => string) | null>;
  onChangeCamera: (cam: { rotation: number }) => void;
  renderMode?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const WALL_HEIGHT = 2.7; // Height of walls in meters
const _CEILING_HEIGHT = 2.75;

// ── Helpers for Procedural Canvas Textures ──────────────────────────────────
function createWoodTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Base wood color
    ctx.fillStyle = "#d0a97a";
    ctx.fillRect(0, 0, 256, 256);
    
    // Draw wood planks
    ctx.strokeStyle = "#a77d4c";
    ctx.lineWidth = 1;
    for (let i = 0; i < 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
    
    // Draw wood grain lines
    ctx.strokeStyle = "#dfbe94";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      const y = Math.random() * 256;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(80, y + 10, 170, y - 10, 256, y);
      ctx.stroke();
    }
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

function createTileTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Base tile color (light beige/gray)
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(0, 0, 128, 128);
    
    // Grid lines for tiles
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, 128, 128);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

function createCarpetTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#a8a29e";
    ctx.fillRect(0, 0, 128, 128);
    
    // Add noise grain
    ctx.fillStyle = "#78716c";
    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      ctx.fillRect(x, y, 1.2, 1.2);
    }
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

function createSkyTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#0284c7");
    grad.addColorStop(0.3, "#0ea5e9");
    grad.addColorStop(0.6, "#38bdf8");
    grad.addColorStop(0.85, "#7dd3fc");
    grad.addColorStop(0.98, "#bae6fd");
    grad.addColorStop(1.0, "#e0f2fe");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Draw nice fluffy clouds
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    const drawCloud = (x: number, y: number, size: number) => {
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.arc(x + size * 0.7, y - size * 0.2, size * 0.8, 0, Math.PI * 2);
      ctx.arc(x + size * 1.4, y, size * 0.7, 0, Math.PI * 2);
      ctx.arc(x + size * 0.4, y + size * 0.3, size * 0.7, 0, Math.PI * 2);
      ctx.arc(x + size * 1.0, y + size * 0.3, size * 0.7, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    };

    // Draw some clouds spread across the panorama
    drawCloud(150, 180, 25);
    drawCloud(350, 120, 35);
    drawCloud(550, 220, 20);
    drawCloud(750, 140, 30);
    drawCloud(900, 200, 24);
    
    // Draw some higher thinner clouds
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    drawCloud(250, 80, 15);
    drawCloud(650, 70, 20);
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function createGrassTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Base grass green
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(0, 0, 256, 256);

    // Draw dark green grass spots
    ctx.fillStyle = "#16a34a";
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.fillRect(x, y, 1.8, 1.8);
    }

    // Draw some light yellow/green spots
    ctx.fillStyle = "#84cc16";
    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(80, 80);
  return texture;
}

// ── Finish Name → THREE.js Colour / Material type resolver ─────────────────
// Maps human-readable finish names (from ROOM_FLOORINGS / ROOM_WALLS etc.)
// to usable THREE.js hex colour strings or material-type keywords.
const FINISH_COLOR_MAP: Record<string, string> = {
  // Walls
  "white plaster":   "#ffffff",
  "soft white":      "#f5f5f0",
  "terracotta fan tile": "#c2410c",
  "exposed brick":   "#b91c1c",
  "concrete render": "#cbd5e1",
  "concrete - light": "#e2e8f0",
  "concrete - dark": "#475569",
  // Flooring (colour-fallback — procedural textures override where needed)
  "white wood panelling": "#f8fafc",
  "terrazzo":        "tile",      // → tile texture
  "natural_oak":     "wood",      // → wood texture
  "beige square tile": "tile",
  "seafoam square tile": "#a7f3d0",
  "mint hexagonal tile": "tile",
  "blue square tile": "#bfdbfe",
  "white square tile": "tile",
  "red oak":         "#b45309",
  "white herringbone": "wood",    // → wood texture
  "white oak":       "wood",
  "ash":             "wood",
  "birch":           "wood",
  "beech":           "wood",
  // Ceilings
  "paint white":     "#ffffff",
  "paint off white":  "#f9fafb",
  "tray ceiling":    "#e5e7eb",
  "exposed concrete": "#94a3b8",
  "timber slats":    "wood",
  // Doors
  "timber natural":  "#d0a97a",
  "timber white":    "#fafafa",
  "timber dark":     "#78350f",
  "matte black":     "#111827",
  // Windows
  "aluminium black": "#1f2937",
  "aluminium white": "#f9fafb",
  "timber frame":    "#d0a97a",
  "clear glass":     "#38bdf8",
};

/**
 * Given a finish name string (or a hex colour), return a resolved colour/keyword
 * that the 3DViewer can use. Returns:
 *   - A hex string like "#b91c1c" for direct THREE.Color use
 *   - One of "wood" | "tile" | "carpet" as texture-type keywords
 */
function resolveFinishValue(raw: string | undefined | null, fallback: string): string {
  if (!raw) return fallback;
  // Already a hex colour?
  if (raw.startsWith("#")) return raw;
  const key = raw.toLowerCase().trim();
  if (FINISH_COLOR_MAP[key]) return FINISH_COLOR_MAP[key];
  // Keyword heuristics
  if (key.includes("oak") || key.includes("wood") || key.includes("birch") || key.includes("ash") || key.includes("beech") || key.includes("timber") || key.includes("herringbone")) return "wood";
  if (key.includes("tile") || key.includes("terrazzo") || key.includes("marble") || key.includes("hexagonal")) return "tile";
  if (key.includes("carpet")) return "carpet";
  if (key.includes("concrete") || key.includes("plaster")) return "#cbd5e1";
  if (key.includes("brick")) return "#b91c1c";
  if (key.includes("white")) return "#ffffff";
  return fallback;
}

/** Build a THREE.Material from a resolved finish value string */
function buildFlooringMat(resolved: string): THREE.Material {
  if (resolved === "wood") {
    return new THREE.MeshStandardMaterial({ map: createWoodTexture(), roughness: 0.6 });
  } else if (resolved === "tile") {
    return new THREE.MeshStandardMaterial({ map: createTileTexture(), roughness: 0.3 });
  } else if (resolved === "carpet") {
    return new THREE.MeshStandardMaterial({ map: createCarpetTexture(), roughness: 0.9 });
  } else {
    return new THREE.MeshStandardMaterial({ color: resolved.startsWith("#") ? resolved : "#e2e8f0", roughness: 0.7 });
  }
}

/** Build a wall material – if the resolved value is a texture keyword fall back to a neutral tone */
function buildWallMat(resolved: string): THREE.MeshStandardMaterial {
  if (resolved === "wood" || resolved === "tile" || resolved === "carpet") {
    // For walls: wood → warm tan, tile → slate grey, carpet → medium grey
    const fallbackColors: Record<string, string> = { wood: "#d0a97a", tile: "#e2e8f0", carpet: "#94a3b8" };
    return new THREE.MeshStandardMaterial({ color: fallbackColors[resolved], roughness: 0.8 });
  }
  return new THREE.MeshStandardMaterial({ color: resolved.startsWith("#") ? resolved : "#ffffff", roughness: 0.8 });
}

export const FloorPlan3DViewer: React.FC<FloorPlan3DViewerProps> = ({
  floorPlan,
  wallThickness = 100,
  finishes,
  activeCamera,
  onCaptureRef,
  onChangeCamera: _onChangeCamera,
  renderMode
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const cubeCameraRef = useRef<THREE.CubeCamera | null>(null);
  const cubeRenderTargetRef = useRef<THREE.WebGLCubeRenderTarget | null>(null);
  // Group that holds all floorplan/furniture meshes so we can clear & redraw
  // without destroying the renderer / camera / controls.
  const sceneObjectsGroupRef = useRef<THREE.Group | null>(null);
  const needsRenderRef = useRef<boolean>(false);

  const activeCameraRef = useRef(activeCamera);
  const onChangeCameraRef = useRef(_onChangeCamera);
  const renderModeRef = useRef(renderMode);

  useEffect(() => {
    activeCameraRef.current = activeCamera;
  }, [activeCamera]);

  useEffect(() => {
    onChangeCameraRef.current = _onChangeCamera;
  }, [_onChangeCamera]);

  useEffect(() => {
    renderModeRef.current = renderMode;
  }, [renderMode]);





// ── Draw helper to compile floorplan meshes ──────────────────────────────
  const draw3DScene = useCallback((
    scene: THREE.Scene,
    plan: FloorPlanData,
    thicknessMM: number,
    finishes: FloorPlan3DViewerProps["finishes"],
    cubeTexture: THREE.Texture | null
  ) => {
    if (!plan || !plan.rooms || plan.rooms.length === 0) return;

    const loader = new GLTFLoader();
    const thick = thicknessMM / 1000; // in meters (e.g. 0.1m)

    // Calculate center offset of the land so it centers in the 3D scene
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    plan.rooms.forEach((r) => {
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.w);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.h);
    });
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // 1. Create a concrete base foundation slab under the building
    const foundationW = (maxX - minX) + 0.8;
    const foundationH = (maxY - minY) + 0.8;
    const foundationGeo = new THREE.BoxGeometry(foundationW, 0.15, foundationH);
    const foundationMat = new THREE.MeshStandardMaterial({
      color: "#cbd5e1", // Light grey concrete base
      roughness: 0.8,
    });
    const foundation = new THREE.Mesh(foundationGeo, foundationMat);
    foundation.position.set(0, -0.075, 0); // top face sits exactly at y = 0
    foundation.receiveShadow = true;
    scene.add(foundation);

    // 2. Large grass plane around the building extending to the horizon
    const grassTex = createGrassTexture();
    const grassGeo = new THREE.PlaneGeometry(350, 350);
    const grassMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 0.9,
      metalness: 0.1,
    });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2; // lay horizontal
    grass.position.set(0, -0.01, 0); // slightly below concrete slab top face
    grass.receiveShadow = true;
    scene.add(grass);

    // ── Global (fallback) materials from Finishes prop ──────────────────────
    const globalFlooringResolved = resolveFinishValue(finishes?.flooring?.value, "wood");
    const _flooringMat: THREE.Material = buildFlooringMat(globalFlooringResolved);

    const globalWallResolved = resolveFinishValue(finishes?.walls?.value, "#ffffff");
    const _wallMat: THREE.MeshStandardMaterial = buildWallMat(globalWallResolved);

    const windowColor = resolveFinishValue(finishes?.windows?.value, "#1c1c1e");
    const glassMat = new THREE.MeshStandardMaterial({
      color: "#38bdf8",
      roughness: 0.05,
      metalness: 0.9,
      transparent: true,
      opacity: 0.4,
      envMap: cubeTexture || undefined,
      envMapIntensity: 1.5,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: windowColor.startsWith("#") ? windowColor : "#1c1c1e",
      roughness: 0.5,
    });

    const doorColor = resolveFinishValue(finishes?.doors?.value, "#d0a97a");
    const doorMat = new THREE.MeshStandardMaterial({
      color: doorColor.startsWith("#") ? doorColor : "#854d0e",
      roughness: 0.6,
    });

    // Draw individual rooms
    plan.rooms.forEach((room) => {
      // 3D coordinate transformation:
      // X_3D = X_2D - centerX
      // Z_3D = Y_2D - centerY
      const rx = room.x + room.w / 2 - centerX;
      const rz = room.y + room.h / 2 - centerY;

      // ── Per-room materials (from Design References) ──────────────────────
      // room.finishes.flooring is stored as a plain string like "Terrazzo", "Ash", "natural_oak"
      const rawRoomFlooring = (typeof room.finishes?.flooring === "object"
        ? (room.finishes?.flooring as { value?: string })?.value
        : room.finishes?.flooring) || finishes?.flooring?.value || "natural_oak";
      const roomFlooringResolved = resolveFinishValue(rawRoomFlooring, "wood");
      const roomFlooringMat: THREE.Material = buildFlooringMat(roomFlooringResolved);

      // room.finishes.walls is stored as a plain string like "Exposed Brick", "White Plaster"
      const rawRoomWall = (typeof room.finishes?.walls === "object"
        ? (room.finishes?.walls as { value?: string })?.value
        : room.finishes?.walls) || finishes?.walls?.value || "#ffffff";
      const roomWallResolved = resolveFinishValue(rawRoomWall, "#ffffff");
      const roomWallMat: THREE.MeshStandardMaterial = buildWallMat(roomWallResolved);

      // 1. Draw Room Sàn (Floor)
      const floorGeo = new THREE.BoxGeometry(room.w, 0.04, room.h);
      const floorMesh = new THREE.Mesh(floorGeo, roomFlooringMat);
      floorMesh.position.set(rx, 0.02, rz);
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // 1b. Draw Room Trần (Ceiling)
      const rawRoomCeiling = (typeof room.finishes?.ceiling === "object"
        ? (room.finishes?.ceiling as { value?: string })?.value
        : room.finishes?.ceiling) || finishes?.ceiling?.value || "paint white";
      const roomCeilingResolved = resolveFinishValue(rawRoomCeiling, "#ffffff");
      const roomCeilingMat: THREE.Material = buildFlooringMat(roomCeilingResolved);
      roomCeilingMat.side = THREE.DoubleSide; // Ensure the ceiling is visible from below

      const ceilingGeo = new THREE.BoxGeometry(room.w, 0.04, room.h);
      const ceilingMesh = new THREE.Mesh(ceilingGeo, roomCeilingMat);
      // Place it right at WALL_HEIGHT (2.7m) plus half of box height (0.02m) so the bottom surface of ceiling is exactly at WALL_HEIGHT
      ceilingMesh.position.set(rx, WALL_HEIGHT + 0.02, rz);
      ceilingMesh.castShadow = true;
      ceilingMesh.receiveShadow = true;
      ceilingMesh.userData = { isCeiling: true };
      // Initial visibility depends on activeCamera
      ceilingMesh.visible = !!activeCameraRef.current && renderModeRef.current !== "Floorplan to 3D Floorplan";
      scene.add(ceilingMesh);

      // 2. Draw Room Tường (Walls along borders)
      // Top wall
      const wallTopGeo = new THREE.BoxGeometry(room.w, WALL_HEIGHT, thick);
      const wallTop = new THREE.Mesh(wallTopGeo, roomWallMat);
      wallTop.position.set(rx, WALL_HEIGHT / 2, room.y - centerY);
      wallTop.castShadow = true;
      wallTop.receiveShadow = true;
      scene.add(wallTop);

      // Bottom wall
      const wallBotGeo = new THREE.BoxGeometry(room.w, WALL_HEIGHT, thick);
      const wallBot = new THREE.Mesh(wallBotGeo, roomWallMat);
      wallBot.position.set(rx, WALL_HEIGHT / 2, room.y + room.h - centerY);
      wallBot.castShadow = true;
      wallBot.receiveShadow = true;
      scene.add(wallBot);

      // Left wall
      const wallLeftGeo = new THREE.BoxGeometry(thick, WALL_HEIGHT, room.h);
      const wallLeft = new THREE.Mesh(wallLeftGeo, roomWallMat);
      wallLeft.position.set(room.x - centerX, WALL_HEIGHT / 2, rz);
      wallLeft.castShadow = true;
      wallLeft.receiveShadow = true;
      scene.add(wallLeft);

      // Right wall
      const wallRightGeo = new THREE.BoxGeometry(thick, WALL_HEIGHT, room.h);
      const wallRight = new THREE.Mesh(wallRightGeo, roomWallMat);
      wallRight.position.set(room.x + room.w - centerX, WALL_HEIGHT / 2, rz);
      wallRight.castShadow = true;
      wallRight.receiveShadow = true;
      scene.add(wallRight);

      // 3. Draw Furniture inside the room
      if (room.furniture) {
        room.furniture.forEach((f) => {
          // Relative to room bottom-left or top-left, converted to absolute 3D
          const fx = room.x + f.x - centerX;
          const fz = room.y + f.y - centerY;
          const rad = ((f.rotation || 0) * Math.PI) / 180;

          // Assemble modular block furniture based on type
          const furnGroup = new THREE.Group();
          furnGroup.position.set(fx, 0.04, fz);
          furnGroup.rotation.y = -rad;

          const ftype = (f.type || "").toLowerCase();
          const isSofa = ftype.includes("sofa") || ftype.includes("chair");
          const isBed = ftype.includes("bed") || ftype.includes("nightstand") || ftype.includes("wardrobe");
          const isKitchen = ftype.includes("kitchen") || ftype.includes("cabinet") || ftype.includes("fridge") || ftype.includes("dining") || ftype.includes("table") || ftype.includes("cooktop") || ftype.includes("sink") || ftype.includes("desk") || ftype.includes("tv");
          const isBath = ftype.includes("bath") || ftype.includes("wc") || ftype.includes("toilet") || ftype.includes("lavabo") || ftype.includes("mirror") || ftype.includes("tub");
          const isCar = ftype.includes("car") || ftype.includes("vehicle") || ftype.includes("garage");
          const isStairs = ftype.includes("stairs");

          const getFurnitureColor = () => {
            if (f.color) return f.color;
            if (f.material) {
              const mats: Record<string, string> = {
                metal_zinc: "#373a3c",
                metal_steel: "#b0b5b9",
                metal_gold: "#d4af37",
                metal_bronze: "#a87c43",
                wood_oak: "#e3c29b",
                wood_walnut: "#543e2b",
                wood_white: "#f8fafc",
                fabric_grey: "#94a3b8",
                fabric_green: "#1b4d3e",
                fabric_beige: "#f5f5dc",
                stone_marble: "#e2e8f0",
                stone_granite: "#0f172a"
              };
              if (mats[f.material]) return mats[f.material];
            }
            return null;
          };
          const resolvedColor = getFurnitureColor();
          const isMetal = f.material && f.material.startsWith("metal");
          const resolvedMetalness = isMetal ? 0.85 : 0.0;
          const resolvedRoughness = isMetal ? 0.15 : 0.8;

          let modelUrl = "";
          let modelRotationOffset = 0;
          let targetW = 1.0;
          let targetL = 1.0;

          if (isSofa && ftype.includes("sofa") && (f.w || 1.6) < 1.0) {
            // High-quality Sheen Chair model for small armchair
            modelUrl = "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/SheenChair/glTF-Binary/SheenChair.glb";
            modelRotationOffset = Math.PI; // rotate 180 degrees
            targetW = f.w || 1.0;
            targetL = f.h || 0.8;
          } else if (isCar) {
            // High-quality Toy Car model for car
            modelUrl = "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/ToyCar/glTF-Binary/ToyCar.glb";
            targetW = f.w || 1.8;
            targetL = f.h || 3.8;
          }

          if (modelUrl) {
            // 1. Draw procedural fallback block immediately
            let placeholderMesh: THREE.Object3D | null = null;
            if (isSofa) {
              // Custom sofa fallback (with backrest and armrests)
              const sofaGroup = new THREE.Group();
              const sofaColor = resolvedColor || "#475569";
              const sofaBaseMat = new THREE.MeshStandardMaterial({
                color: sofaColor,
                roughness: resolvedRoughness,
                metalness: resolvedMetalness
              });
              
              const base = new THREE.Mesh(new THREE.BoxGeometry(f.w || 1.6, 0.3, f.h || 0.8), sofaBaseMat);
              base.position.set(0, 0.15, 0);
              base.castShadow = true;
              sofaGroup.add(base);

              const back = new THREE.Mesh(new THREE.BoxGeometry(f.w || 1.6, 0.6, 0.15), sofaBaseMat);
              back.position.set(0, 0.45, -(f.h || 0.8) / 2 + 0.075);
              back.castShadow = true;
              sofaGroup.add(back);

              const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.45, f.h || 0.8), sofaBaseMat);
              armL.position.set(-(f.w || 1.6) / 2 + 0.075, 0.3, 0);
              armL.castShadow = true;
              sofaGroup.add(armL);

              const armR = armL.clone();
              armR.position.x = (f.w || 1.6) / 2 - 0.075;
              sofaGroup.add(armR);

              furnGroup.add(sofaGroup);
              placeholderMesh = sofaGroup;
            } else if (isCar) {
              // Detailed car fallback with wheels and windshield
              const carGroup = new THREE.Group();
              const carMat = new THREE.MeshStandardMaterial({
                color: "#dc2626",
                roughness: 0.1,
                metalness: 0.9,
                envMap: cubeTexture || undefined,
                envMapIntensity: 1.5
              });
              
              const body = new THREE.Mesh(new THREE.BoxGeometry(f.w || 1.8, 0.5, f.h || 3.8), carMat);
              body.position.set(0, 0.35, 0);
              body.castShadow = true;
              carGroup.add(body);

              const cabin = new THREE.Mesh(new THREE.BoxGeometry(f.w * 0.85 || 1.5, 0.45, f.h * 0.5 || 1.9), carMat);
              cabin.position.set(0, 0.8, 0.1);
              cabin.castShadow = true;
              carGroup.add(cabin);

              const wheelMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.9 });
              const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.25, 12);
              wheelGeo.rotateZ(Math.PI / 2);

              const frontL = new THREE.Mesh(wheelGeo, wheelMat);
              frontL.position.set(-(f.w || 1.8) / 2 - 0.02, 0.3, (f.h || 3.8) * 0.25);
              carGroup.add(frontL);

              const frontR = frontL.clone();
              frontR.position.x = (f.w || 1.8) / 2 + 0.02;
              carGroup.add(frontR);

              const backL = frontL.clone();
              backL.position.z = -(f.h || 3.8) * 0.25;
              carGroup.add(backL);

              const backR = frontR.clone();
              backR.position.z = -(f.h || 3.8) * 0.25;
              carGroup.add(backR);

              furnGroup.add(carGroup);
              placeholderMesh = carGroup;
            }

            // 2. Load GLTF asynchronously from CDN
            loader.load(
              modelUrl,
              (gltf) => {
                if (placeholderMesh) {
                  furnGroup.remove(placeholderMesh);
                  placeholderMesh.traverse((obj) => {
                    if (obj instanceof THREE.Mesh) {
                      obj.geometry.dispose();
                      if (Array.isArray(obj.material)) {
                        obj.material.forEach((mat) => mat.dispose());
                      } else {
                        obj.material.dispose();
                      }
                    }
                  });
                }

                const model = gltf.scene;

                // Hide fabric pedestal / cloth drape first so it's not visible
                model.traverse((child) => {
                  const mesh = child as THREE.Mesh;
                  const mat = mesh.material;
                  const hasFabricMat = mat 
                    ? (Array.isArray(mat) ? mat.some(m => m.name === "Fabric") : mat.name === "Fabric")
                    : false;
                  if (child.name.toLowerCase().includes("fabric") || hasFabricMat) {
                    child.visible = false;
                  }
                });

                // Compute bounding box after hiding the pedestal so the car sits on the ground
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());

                const scaleFactor = Math.min(targetW / size.x, targetL / size.z);
                model.scale.set(scaleFactor, scaleFactor, scaleFactor);
                model.position.set(-center.x * scaleFactor, 0.02 - box.min.y * scaleFactor, -center.z * scaleFactor);
                model.rotation.y = modelRotationOffset;

                model.traverse((child) => {
                  if (child instanceof THREE.Mesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                      const materials = Array.isArray(child.material) ? child.material : [child.material];
                      materials.forEach((mat) => {
                        if (mat.name === "ToyCar") {
                          // Change car body to shiny black
                          const shinyBlackMat = new THREE.MeshStandardMaterial({
                            color: "#0a0a0a", // glossy black
                            roughness: 0.1,
                            metalness: 0.9,
                            envMap: cubeTexture || undefined,
                            envMapIntensity: 2.0
                          });
                          child.material = shinyBlackMat;
                        } else if ("envMap" in mat) {
                          const m = mat as THREE.MeshStandardMaterial;
                          m.envMap = cubeTexture;
                          m.envMapIntensity = isCar ? 1.5 : 1.0;
                          m.needsUpdate = true;
                        }
                      });
                    }
                  }
                });

                furnGroup.add(model);

                if (rendererRef.current && sceneRef.current && cameraRef.current) {
                  if (cubeCameraRef.current) {
                    cubeCameraRef.current.update(rendererRef.current, sceneRef.current);
                  }
                  rendererRef.current.render(sceneRef.current, cameraRef.current);
                }
              },
              undefined,
              (err) => {
                console.warn("Failed to load 3D asset from CDN, fallback mesh kept:", err);
              }
            );
          } else {
            // Detailed procedural fallback for ALL other furniture items
            if (isSofa) {
              // Custom sofa fallback (with backrest and armrests)
              const sofaGroup = new THREE.Group();
              const sofaColor = resolvedColor || "#475569";
              const sofaBaseMat = new THREE.MeshStandardMaterial({
                color: sofaColor,
                roughness: resolvedRoughness,
                metalness: resolvedMetalness
              });
              
              const base = new THREE.Mesh(new THREE.BoxGeometry(f.w || 1.6, 0.3, f.h || 0.8), sofaBaseMat);
              base.position.set(0, 0.15, 0);
              base.castShadow = true;
              sofaGroup.add(base);

              const back = new THREE.Mesh(new THREE.BoxGeometry(f.w || 1.6, 0.6, 0.15), sofaBaseMat);
              back.position.set(0, 0.45, -(f.h || 0.8) / 2 + 0.075);
              back.castShadow = true;
              sofaGroup.add(back);

              const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.45, f.h || 0.8), sofaBaseMat);
              armL.position.set(-(f.w || 1.6) / 2 + 0.075, 0.3, 0);
              armL.castShadow = true;
              sofaGroup.add(armL);

              const armR = armL.clone();
              armR.position.x = (f.w || 1.6) / 2 - 0.075;
              sofaGroup.add(armR);

              furnGroup.add(sofaGroup);

            } else if (isBed) {
              if (ftype.includes("wardrobe")) {
                // Tall wardrobe cabinet
                const cabGeo = new THREE.BoxGeometry(f.w || 1.2, 2.2, f.h || 0.6);
                const cabMat = new THREE.MeshStandardMaterial({
                  color: resolvedColor || "#a16207",
                  roughness: resolvedRoughness,
                  metalness: resolvedMetalness
                }); // oak look
                const wardrobe = new THREE.Mesh(cabGeo, cabMat);
                wardrobe.position.set(0, 1.1, 0);
                wardrobe.castShadow = true;
                furnGroup.add(wardrobe);

                // Door seam
                const seamGeo = new THREE.BoxGeometry(0.01, 2.18, 0.01);
                const handleMat = new THREE.MeshStandardMaterial({ color: "#d4af37", metalness: 0.9, roughness: 0.1 }); // gold handles
                const seam = new THREE.Mesh(seamGeo, handleMat);
                seam.position.set(0, 1.1, (f.h || 0.6) / 2 + 0.005);
                furnGroup.add(seam);

                // Handles
                const handleL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.02), handleMat);
                handleL.position.set(-0.05, 1.1, (f.h || 0.6) / 2 + 0.01);
                furnGroup.add(handleL);

                const handleR = handleL.clone();
                handleR.position.x = 0.05;
                furnGroup.add(handleR);

              } else if (ftype.includes("nightstand")) {
                // Nightstand drawer
                const standGeo = new THREE.BoxGeometry(f.w || 0.45, 0.5, f.h || 0.45);
                const standMat = new THREE.MeshStandardMaterial({
                  color: resolvedColor || "#78350f",
                  roughness: resolvedRoughness,
                  metalness: resolvedMetalness
                });
                const nightstand = new THREE.Mesh(standGeo, standMat);
                nightstand.position.set(0, 0.25, 0);
                nightstand.castShadow = true;
                furnGroup.add(nightstand);

                // Handle
                const handleMat = new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.8, roughness: 0.2 });
                const pull = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), handleMat);
                pull.position.set(0, 0.35, (f.h || 0.45) / 2 + 0.005);
                furnGroup.add(pull);

              } else {
                // Beautiful bed with frame, mattress, pillow, and blanket
                const frameGeo = new THREE.BoxGeometry(f.w || 1.6, 0.25, f.h || 2.0);
                const woodMat = new THREE.MeshStandardMaterial({
                  color: resolvedColor || "#78350f",
                  roughness: resolvedRoughness,
                  metalness: resolvedMetalness
                });
                const frame = new THREE.Mesh(frameGeo, woodMat);
                frame.position.set(0, 0.125, 0);
                frame.castShadow = true;
                furnGroup.add(frame);

                // Headboard
                const headGeo = new THREE.BoxGeometry(f.w || 1.6, 0.9, 0.1);
                const headboard = new THREE.Mesh(headGeo, woodMat);
                headboard.position.set(0, 0.45, -(f.h || 2.0) / 2 + 0.05);
                headboard.castShadow = true;
                furnGroup.add(headboard);

                // Mattress
                const matGeo = new THREE.BoxGeometry((f.w || 1.6) - 0.1, 0.22, (f.h || 2.0) - 0.1);
                const matMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.95 });
                const mattress = new THREE.Mesh(matGeo, matMat);
                mattress.position.set(0, 0.3, 0.02);
                mattress.castShadow = true;
                furnGroup.add(mattress);

                // Pillows
                const pilGeo = new THREE.BoxGeometry(0.55, 0.08, 0.38);
                const pilMat = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.9 });
                const pillowL = new THREE.Mesh(pilGeo, pilMat);
                pillowL.position.set(-(f.w || 1.6) * 0.22, 0.42, -(f.h || 2.0) / 2 + 0.3);
                furnGroup.add(pillowL);

                const pillowR = pillowL.clone();
                pillowR.position.x = (f.w || 1.6) * 0.22;
                furnGroup.add(pillowR);

                // Blanket
                const blankGeo = new THREE.BoxGeometry((f.w || 1.6) - 0.08, 0.24, (f.h || 2.0) * 0.4);
                const blankMat = new THREE.MeshStandardMaterial({
                  color: resolvedColor || "#b45309",
                  roughness: resolvedRoughness,
                  metalness: resolvedMetalness
                }); // blanket matches resolvedColor
                const blanket = new THREE.Mesh(blankGeo, blankMat);
                blanket.position.set(0, 0.31, (f.h || 2.0) * 0.25);
                furnGroup.add(blanket);
              }

            } else if (isKitchen) {
              if (ftype.includes("fridge")) {
                // Refrigerator
                const refGeo = new THREE.BoxGeometry(f.w || 0.8, 1.8, f.h || 0.8);
                const steelMat = new THREE.MeshStandardMaterial({
                  color: resolvedColor || "#94a3b8",
                  metalness: isMetal ? 0.85 : 0.9,
                  roughness: isMetal ? 0.15 : 0.15
                });
                const fridge = new THREE.Mesh(refGeo, steelMat);
                fridge.position.set(0, 0.9, 0);
                fridge.castShadow = true;
                furnGroup.add(fridge);

                // Door handle
                const handleMat = new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.9, roughness: 0.1 });
                const handleTop = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.02), handleMat);
                handleTop.position.set((f.w || 0.8) / 2 - 0.05, 1.2, (f.h || 0.8) / 2 + 0.01);
                furnGroup.add(handleTop);

                const handleBot = handleTop.clone();
                handleBot.position.y = 0.55;
                furnGroup.add(handleBot);

              } else if (ftype.includes("cooktop")) {
                // Stove Cooktop cabinet
                const counterGeo = new THREE.BoxGeometry(f.w || 0.8, 0.85, f.h || 0.6);
                const counterMat = new THREE.MeshStandardMaterial({
                  color: resolvedColor || "#1e293b",
                  roughness: resolvedRoughness,
                  metalness: resolvedMetalness
                });
                const counter = new THREE.Mesh(counterGeo, counterMat);
                counter.position.set(0, 0.425, 0);
                counter.castShadow = true;
                furnGroup.add(counter);

                // Cooktop surface plate
                const plate = new THREE.Mesh(
                  new THREE.BoxGeometry((f.w || 0.8) * 0.8, 0.01, (f.h || 0.6) * 0.8),
                  new THREE.MeshStandardMaterial({ color: "#000000", roughness: 0.05 })
                );
                plate.position.set(0, 0.855, 0);
                furnGroup.add(plate);

                // Burning rings
                const ringMat = new THREE.MeshBasicMaterial({ color: "#ea580c" }); // glowing orange
                const ringGeo = new THREE.RingGeometry(0.06, 0.08, 16);
                ringGeo.rotateX(-Math.PI / 2);

                const ringL = new THREE.Mesh(ringGeo, ringMat);
                ringL.position.set(-(f.w || 0.8) * 0.2, 0.865, 0);
                furnGroup.add(ringL);

                const ringR = ringL.clone();
                ringR.position.x = (f.w || 0.8) * 0.2;
                furnGroup.add(ringR);

              } else if (ftype.includes("sink")) {
                // Sink cabinet
                const counterGeo = new THREE.BoxGeometry(f.w || 0.8, 0.85, f.h || 0.6);
                const counterMat = new THREE.MeshStandardMaterial({
                  color: resolvedColor || "#1e293b",
                  roughness: resolvedRoughness,
                  metalness: resolvedMetalness
                });
                const counter = new THREE.Mesh(counterGeo, counterMat);
                counter.position.set(0, 0.425, 0);
                counter.castShadow = true;
                furnGroup.add(counter);

                // Sink basin
                const sinkGeo = new THREE.BoxGeometry((f.w || 0.8) * 0.7, 0.02, (f.h || 0.6) * 0.7);
                const steelMat = new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.8, roughness: 0.2 });
                const sink = new THREE.Mesh(sinkGeo, steelMat);
                sink.position.set(0, 0.86, 0);
                furnGroup.add(sink);

                // Faucet pipe
                const faucetGroup = new THREE.Group();
                faucetGroup.position.set(0, 0.87, -(f.h || 0.6) * 0.25);
                
                const pipe = new THREE.Mesh(
                  new THREE.CylinderGeometry(0.015, 0.015, 0.18, 8),
                  new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.9, roughness: 0.1 })
                );
              pipe.position.y = 0.09;
                faucetGroup.add(pipe);
                
                furnGroup.add(faucetGroup);

              } else if (ftype.includes("pool_table")) {
                // Pool Table wood frame (bottom-outer)
                const tableW = f.w || 1.6;
                const tableH = f.h || 2.8;
                
                // Wooden frame base
                const baseGeo = new THREE.BoxGeometry(tableW, 0.72, tableH);
                const woodMat = new THREE.MeshStandardMaterial({
                  color: "#5c4033", // walnut wood
                  roughness: 0.5,
                  metalness: 0.1
                });
                const base = new THREE.Mesh(baseGeo, woodMat);
                base.position.set(0, 0.36, 0);
                base.castShadow = true;
                furnGroup.add(base);

                // Green felt top area
                const feltGeo = new THREE.BoxGeometry(tableW - 0.12, 0.02, tableH - 0.12);
                const feltMat = new THREE.MeshStandardMaterial({
                  color: "#16a34a", // classic green pool felt
                  roughness: 0.9,
                  metalness: 0.0
                });
                const felt = new THREE.Mesh(feltGeo, feltMat);
                felt.position.set(0, 0.73, 0);
                felt.receiveShadow = true;
                furnGroup.add(felt);

                // Pockets (6 pockets - cylinders/circles at corners and middle sides)
                const pocketMat = new THREE.MeshBasicMaterial({ color: "#111111" });
                const pocketGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.002, 12);
                
                const corners = [
                  [-tableW / 2 + 0.08, tableH / 2 - 0.08],
                  [tableW / 2 - 0.08, tableH / 2 - 0.08],
                  [-tableW / 2 + 0.08, -tableH / 2 + 0.08],
                  [tableW / 2 - 0.08, -tableH / 2 + 0.08],
                  [-tableW / 2 + 0.06, 0],
                  [tableW / 2 - 0.06, 0]
                ];
                
                corners.forEach(([px, pz]) => {
                  const pocket = new THREE.Mesh(pocketGeo, pocketMat);
                  pocket.position.set(px, 0.741, pz);
                  furnGroup.add(pocket);
                });

              } else if (ftype.includes("coffee_table")) {
                // Low Coffee Table
                const tableW = f.w || 1.1;
                const tableH = f.h || 0.6;
                const tableGeo = new THREE.BoxGeometry(tableW, 0.03, tableH);
                const tableMat = new THREE.MeshStandardMaterial({
                  color: resolvedColor || "#cbd5e1", // glass/light gray tabletop
                  roughness: 0.2,
                  metalness: 0.2
                });
                const tabletop = new THREE.Mesh(tableGeo, tableMat);
                tabletop.position.set(0, 0.45, 0);
                tabletop.castShadow = true;
                furnGroup.add(tabletop);

                // 4 thin metal legs
                const legGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.435, 8);
                const legMat = new THREE.MeshStandardMaterial({ color: "#475569", metalness: 0.8, roughness: 0.2 });
                
                const legFL = new THREE.Mesh(legGeo, legMat);
                legFL.position.set(-tableW / 2 + 0.04, 0.22, tableH / 2 - 0.04);
                furnGroup.add(legFL);

                const legFR = legFL.clone(); legFR.position.x = tableW / 2 - 0.04; furnGroup.add(legFR);
                const legBL = legFL.clone(); legBL.position.z = -tableH / 2 + 0.04; furnGroup.add(legBL);
                const legBR = legFR.clone(); legBR.position.z = -tableH / 2 + 0.04; furnGroup.add(legBR);

              } else if (ftype.includes("side_table")) {
                // Small Round Side Table
                const radius = (f.w || 0.45) / 2;
                const tableGeo = new THREE.CylinderGeometry(radius, radius, 0.03, 16);
                const tableMat = new THREE.MeshStandardMaterial({
                  color: resolvedColor || "#5c4033", // walnut wood
                  roughness: 0.4,
                  metalness: 0.1
                });
                const tabletop = new THREE.Mesh(tableGeo, tableMat);
                tabletop.position.set(0, 0.55, 0);
                tabletop.castShadow = true;
                furnGroup.add(tabletop);

                // Center pedestal leg
                const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.535, 8);
                const legMat = new THREE.MeshStandardMaterial({ color: "#475569", metalness: 0.8, roughness: 0.2 });
                const leg = new THREE.Mesh(legGeo, legMat);
                leg.position.set(0, 0.265, 0);
                furnGroup.add(leg);

                // Round base
                const baseGeo = new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, 0.02, 16);
                const base = new THREE.Mesh(baseGeo, legMat);
                base.position.set(0, 0.01, 0);
                furnGroup.add(base);

              } else if (ftype.includes("table") || ftype.includes("dining")) {
                // Table
                const tableW = f.w || 1.4;
                const tableH = f.h || 0.9;
                const tableGeo = new THREE.BoxGeometry(tableW, 0.05, tableH);
                const tableMat = new THREE.MeshStandardMaterial({
                  color: resolvedColor || "#a16207",
                  roughness: resolvedRoughness,
                  metalness: resolvedMetalness
                }); // wooden tabletop
                const tabletop = new THREE.Mesh(tableGeo, tableMat);
                tabletop.position.set(0, 0.75, 0);
                tabletop.castShadow = true;
                furnGroup.add(tabletop);

                // 4 Legs
                const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.72, 8);
                const legMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.8 });

                const legFL = new THREE.Mesh(legGeo, legMat);
                legFL.position.set(-tableW / 2 + 0.06, 0.36, tableH / 2 - 0.06);
                furnGroup.add(legFL);

                const legFR = legFL.clone();
                legFR.position.x = tableW / 2 - 0.06;
                furnGroup.add(legFR);

                const legBL = legFL.clone();
                legBL.position.z = -tableH / 2 + 0.06;
                furnGroup.add(legBL);

                const legBR = legFR.clone();
                legBR.position.z = -tableH / 2 + 0.06;
                furnGroup.add(legBR);

                // Surround with dining chairs
                const chairMat = new THREE.MeshStandardMaterial({
                  color: resolvedColor || "#1e293b",
                  roughness: resolvedRoughness,
                  metalness: resolvedMetalness
                });
                const makeChair = (cx: number, cz: number, rotY: number) => {
                  const chair = new THREE.Group();
                  chair.position.set(cx, 0, cz);
                  chair.rotation.y = rotY;

                  // Seat
                  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.4), chairMat);
                  seat.position.y = 0.45;
                  seat.castShadow = true;
                  chair.add(seat);

                  // Backrest
                  const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.04), chairMat);
                  back.position.set(0, 0.675, -0.18);
                  back.castShadow = true;
                  chair.add(back);

                  // Legs
                  const lGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.43, 8);
                  const lFL = new THREE.Mesh(lGeo, chairMat);
                  lFL.position.set(-0.17, 0.215, 0.17);
                  chair.add(lFL);

                  const lFR = lFL.clone(); lFR.position.x = 0.17; chair.add(lFR);
                  const lBL = lFL.clone(); lBL.position.z = -0.17; chair.add(lBL);
                  const lBR = lFR.clone(); lBR.position.z = -0.17; chair.add(lBR);

                  return chair;
                };

                // Dynamic chairs calculation (matches 2D drawing seats count)
                // Top & Bottom sides: Space chairs evenly.
                const numChairsPerSide = Math.max(1, Math.floor(tableW / 0.65));
                if (numChairsPerSide === 1) {
                  furnGroup.add(makeChair(0, tableH / 2 + 0.22, Math.PI)); // bottom facing north
                  furnGroup.add(makeChair(0, -tableH / 2 - 0.22, 0)); // top facing south
                } else {
                  for (let i = 0; i < numChairsPerSide; i++) {
                    const offsetFraction = (i / (numChairsPerSide - 1)) - 0.5; // [-0.5, 0.5]
                    const cx = offsetFraction * (tableW - 0.5);
                    furnGroup.add(makeChair(cx, tableH / 2 + 0.22, Math.PI));
                    furnGroup.add(makeChair(cx, -tableH / 2 - 0.22, 0));
                  }
                }

                // Left & Right ends: add 1 chair on each end if table is deep enough (height >= 0.8m)
                if (tableH >= 0.8) {
                  furnGroup.add(makeChair(-tableW / 2 - 0.22, 0, Math.PI / 2)); // left chair facing east
                  furnGroup.add(makeChair(tableW / 2 + 0.22, 0, -Math.PI / 2)); // right chair facing west
                }

              } else if (ftype.includes("tv")) {
                // TV Console cabinet stand
                const standW = f.w || 1.6;
                const standH = 0.45;
                const standD = f.h || 0.45;
                const stand = new THREE.Mesh(
                  new THREE.BoxGeometry(standW, standH, standD),
                  new THREE.MeshStandardMaterial({
                    color: resolvedColor || "#1e293b",
                    roughness: resolvedRoughness,
                    metalness: resolvedMetalness
                  })
                );
                stand.position.set(0, standH / 2, 0);
                stand.castShadow = true;
                furnGroup.add(stand);

                // Thin Widescreen TV
                const tvGroup = new THREE.Group();
                tvGroup.position.set(0, standH, 0);

                // Base / neck
                const neck = new THREE.Mesh(
                  new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8),
                  new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.2 })
                );
                neck.position.y = 0.06;
                tvGroup.add(neck);

                const tvBase = new THREE.Mesh(
                  new THREE.BoxGeometry(0.35, 0.015, 0.22),
                  new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.2 })
                );
                tvBase.position.y = 0.007;
                tvGroup.add(tvBase);

                // TV Screen
                const tvW = standW * 0.85;
                const tvH = tvW * 0.55;
                const screen = new THREE.Mesh(
                  new THREE.BoxGeometry(tvW, tvH, 0.04),
                  new THREE.MeshStandardMaterial({ color: "#090d16", roughness: 0.15, metalness: 0.8 })
                );
                screen.position.set(0, 0.12 + tvH / 2, 0);
                screen.castShadow = true;
                tvGroup.add(screen);

                furnGroup.add(tvGroup);

              } else if (ftype.includes("desk")) {
                // Desk Table
                const desk = new THREE.Mesh(
                  new THREE.BoxGeometry(f.w || 1.2, 0.04, f.h || 0.6),
                  new THREE.MeshStandardMaterial({
                    color: resolvedColor || "#7c2d12",
                    roughness: resolvedRoughness,
                    metalness: resolvedMetalness
                  })
                );
                desk.position.set(0, 0.75, 0);
                desk.castShadow = true;
                furnGroup.add(desk);

                // 4 metal legs
                const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.73, 8);
                const legMat = new THREE.MeshStandardMaterial({ color: "#475569", metalness: 0.9, roughness: 0.1 });
                
                const legFL = new THREE.Mesh(legGeo, legMat);
                legFL.position.set(-(f.w || 1.2) / 2 + 0.04, 0.365, (f.h || 0.6) / 2 - 0.04);
                furnGroup.add(legFL);

                const legFR = legFL.clone(); legFR.position.x = (f.w || 1.2) / 2 - 0.04; furnGroup.add(legFR);
                const legBL = legFL.clone(); legBL.position.z = -(f.h || 0.6) / 2 + 0.04; furnGroup.add(legBL);
                const legBR = legFR.clone(); legBR.position.z = -(f.h || 0.6) / 2 + 0.04; furnGroup.add(legBR);

                // Monitor
                const mon = new THREE.Mesh(
                  new THREE.BoxGeometry(0.48, 0.3, 0.02),
                  new THREE.MeshStandardMaterial({ color: "#020617", roughness: 0.1 })
                );
                mon.position.set(0, 0.94, -0.15);
                furnGroup.add(mon);

                const standM = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), legMat);
                standM.position.set(0, 0.83, -0.15);
                furnGroup.add(standM);

              } else {
                // General cabinet or counter console
                const counterGeo = new THREE.BoxGeometry(f.w || 1.2, 0.85, f.h || 0.6);
                const counterMat = new THREE.MeshStandardMaterial({
                  color: resolvedColor || "#1e293b",
                  roughness: resolvedRoughness,
                  metalness: resolvedMetalness
                });
                const counter = new THREE.Mesh(counterGeo, counterMat);
                counter.position.set(0, 0.425, 0);
                counter.castShadow = true;
                furnGroup.add(counter);
              }

            } else if (isBath) {
              if (ftype.includes("toilet")) {
                // Toilet bowl
                const bowl = new THREE.Mesh(
                  new THREE.CylinderGeometry(0.18, 0.14, 0.4, 16),
                  new THREE.MeshStandardMaterial({
                    color: resolvedColor || "#ffffff",
                    roughness: resolvedRoughness || 0.05,
                    metalness: resolvedMetalness
                  })
                );
                bowl.position.set(0, 0.2, 0.1);
                bowl.castShadow = true;
                furnGroup.add(bowl);

                // Flush tank
                const tank = new THREE.Mesh(
                  new THREE.BoxGeometry(0.42, 0.45, 0.2),
                  new THREE.MeshStandardMaterial({
                    color: resolvedColor || "#ffffff",
                    roughness: resolvedRoughness || 0.05,
                    metalness: resolvedMetalness
                  })
                );
                tank.position.set(0, 0.625, -0.12);
                tank.castShadow = true;
                furnGroup.add(tank);

                // Seat cover
                const cover = new THREE.Mesh(
                  new THREE.BoxGeometry(0.36, 0.03, 0.38),
                  new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.1 })
                );
                cover.position.set(0, 0.415, 0.12);
                furnGroup.add(cover);

              } else if (ftype.includes("lavabo") || ftype.includes("sink")) {
                // Sink vanity cabinet
                const cabinet = new THREE.Mesh(
                  new THREE.BoxGeometry(f.w || 0.6, 0.75, f.h || 0.45),
                  new THREE.MeshStandardMaterial({
                    color: resolvedColor || "#475569",
                    roughness: resolvedRoughness || 0.7,
                    metalness: resolvedMetalness
                  })
                );
                cabinet.position.set(0, 0.375, 0);
                cabinet.castShadow = true;
                furnGroup.add(cabinet);

                // Round bowl basin
                const bowlGeo = new THREE.CylinderGeometry(0.16, 0.13, 0.12, 16);
                const bowlMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.05 });
                const bowl = new THREE.Mesh(bowlGeo, bowlMat);
                bowl.position.set(0, 0.81, 0);
                bowl.castShadow = true;
                furnGroup.add(bowl);

                // Small metal tap faucet
                const tap = new THREE.Mesh(
                  new THREE.BoxGeometry(0.03, 0.08, 0.08),
                  new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.9, roughness: 0.1 })
                );
                tap.position.set(0, 0.87, -(f.h || 0.45) * 0.3);
                furnGroup.add(tap);

              } else if (ftype.includes("mirror")) {
                // Glass mirror hanging on the wall
                const mirrorW = f.w || 0.6;
                const mirrorH = f.h || 0.8;
                const frameGeo = new THREE.BoxGeometry(mirrorW, mirrorH, 0.03);
                const blackMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.4 });
                const frame = new THREE.Mesh(frameGeo, blackMat);
                frame.position.set(0, 1.4, 0);
                furnGroup.add(frame);

                // Reflective plate
                const plateGeo = new THREE.BoxGeometry(mirrorW - 0.04, mirrorH - 0.04, 0.01);
                const reflMat = new THREE.MeshStandardMaterial({
                  color: "#e2e8f0",
                  roughness: 0.0,
                  metalness: 1.0,
                  envMap: cubeTexture || undefined,
                  envMapIntensity: 1.8
                });
                const plate = new THREE.Mesh(plateGeo, reflMat);
                plate.position.set(0, 1.4, 0.015);
                furnGroup.add(plate);

              } else {
                // White Porcelain Bathtub
                const tubGeo = new THREE.BoxGeometry(f.w || 0.7, 0.6, f.h || 1.4);
                const tubMat = new THREE.MeshStandardMaterial({
                  color: resolvedColor || "#ffffff",
                  roughness: resolvedRoughness || 0.1,
                  metalness: resolvedMetalness
                });
                const tub = new THREE.Mesh(tubGeo, tubMat);
                tub.position.set(0, 0.3, 0);
                tub.castShadow = true;
                furnGroup.add(tub);

                // Inside tub cut simulation (Water)
                const innerGeo = new THREE.BoxGeometry((f.w || 0.7) - 0.12, 0.02, (f.h || 1.4) - 0.12);
                const waterMat = new THREE.MeshStandardMaterial({ color: "#38bdf8", transparent: true, opacity: 0.6 });
                const water = new THREE.Mesh(innerGeo, waterMat);
                water.position.set(0, 0.58, 0);
                furnGroup.add(water);
              }
            } else if (isStairs) {
              const stairGroup = new THREE.Group();
              const stairStyle = f.style || "straight";
              const woodColor = resolvedColor || "#a16207"; // warm wood brown
              const stepMat = new THREE.MeshStandardMaterial({
                color: woodColor,
                roughness: 0.6,
                metalness: 0.1
              });
              const metalRailMat = new THREE.MeshStandardMaterial({
                color: "#1e293b", // dark metal
                metalness: 0.8,
                roughness: 0.2
              });

              const sw = f.w || 1.0;
              const sh = f.h || 2.0;
              const totalHeight = 2.7;

              if (stairStyle === "l_shaped_landing" || stairStyle === "l_shaped_winder") {
                // L-shaped staircase (landing / winder)
                const landingZHeight = totalHeight * 0.5;
                
                // 1. Landing Platform
                const landingGeo = new THREE.BoxGeometry(sw, 0.1, sw);
                const landingMesh = new THREE.Mesh(landingGeo, stepMat);
                landingMesh.position.set(-sw / 4, landingZHeight - 0.05, -sh / 2 + sw / 2);
                landingMesh.castShadow = true;
                landingMesh.receiveShadow = true;
                stairGroup.add(landingMesh);

                // Supporting landing post
                const postGeo = new THREE.BoxGeometry(0.1, landingZHeight, 0.1);
                const post = new THREE.Mesh(postGeo, metalRailMat);
                post.position.set(-sw / 2 + 0.05, landingZHeight / 2, -sh / 2 + 0.05);
                stairGroup.add(post);

                // 2. Left run steps (vertical run going up to landing)
                const run1Length = sh - sw;
                const numSteps1 = 8;
                const step1Depth = run1Length / numSteps1;
                const step1Rise = landingZHeight / numSteps1;

                for (let i = 0; i < numSteps1; i++) {
                  const sz = sh / 2 - (i + 0.5) * step1Depth;
                  const sy = (i + 1) * step1Rise;
                  const stepGeo = new THREE.BoxGeometry(sw / 2, sy, step1Depth);
                  const stepMesh = new THREE.Mesh(stepGeo, stepMat);
                  stepMesh.position.set(-sw / 4, sy / 2, sz);
                  stepMesh.castShadow = true;
                  stepMesh.receiveShadow = true;
                  stairGroup.add(stepMesh);
                }

                // 3. Top run steps (horizontal run going right from landing)
                const run2Width = sw / 2;
                const numSteps2 = 8;
                const step2Width = run2Width / numSteps2;
                const step2Rise = (totalHeight - landingZHeight) / numSteps2;

                for (let i = 0; i < numSteps2; i++) {
                  const sx = (i + 0.5) * step2Width;
                  const sy = landingZHeight + (i + 1) * step2Rise;
                  const stepGeo = new THREE.BoxGeometry(step2Width, sy, sw);
                  const stepMesh = new THREE.Mesh(stepGeo, stepMat);
                  stepMesh.position.set(sx, sy / 2, -sh / 2 + sw / 2);
                  stepMesh.castShadow = true;
                  stepMesh.receiveShadow = true;
                  stairGroup.add(stepMesh);
                }

              } else if (stairStyle === "u_shaped") {
                // U-shaped staircase
                const landingZHeight = totalHeight * 0.5;
                const landingDepth = sw / 2;

                // 1. Landing Platform
                const landingGeo = new THREE.BoxGeometry(sw, 0.1, landingDepth);
                const landingMesh = new THREE.Mesh(landingGeo, stepMat);
                landingMesh.position.set(0, landingZHeight - 0.05, -sh / 2 + landingDepth / 2);
                landingMesh.castShadow = true;
                landingMesh.receiveShadow = true;
                stairGroup.add(landingMesh);

                // Supporting landing posts
                const postGeo = new THREE.BoxGeometry(0.08, landingZHeight, 0.08);
                const postL = new THREE.Mesh(postGeo, metalRailMat);
                postL.position.set(-sw / 2 + 0.04, landingZHeight / 2, -sh / 2 + 0.04);
                stairGroup.add(postL);
                const postR = postL.clone();
                postR.position.x = sw / 2 - 0.04;
                stairGroup.add(postR);

                // 2. Left run steps (going up to landing)
                const runLength = sh - landingDepth;
                const numSteps1 = 8;
                const stepDepth = runLength / numSteps1;
                const stepRise = landingZHeight / numSteps1;

                for (let i = 0; i < numSteps1; i++) {
                  const sz = sh / 2 - (i + 0.5) * stepDepth;
                  const sy = (i + 1) * stepRise;
                  const stepGeo = new THREE.BoxGeometry(sw / 2 - 0.02, sy, stepDepth);
                  const stepMesh = new THREE.Mesh(stepGeo, stepMat);
                  stepMesh.position.set(-sw / 4, sy / 2, sz);
                  stepMesh.castShadow = true;
                  stepMesh.receiveShadow = true;
                  stairGroup.add(stepMesh);
                }

                // 3. Right run steps (going up from landing to top floor)
                const numSteps2 = 8;
                const stepRise2 = (totalHeight - landingZHeight) / numSteps2;

                for (let i = 0; i < numSteps2; i++) {
                  const sz = -sh / 2 + landingDepth + (i + 0.5) * stepDepth;
                  const sy = landingZHeight + (i + 1) * stepRise2;
                  const stepGeo = new THREE.BoxGeometry(sw / 2 - 0.02, sy, stepDepth);
                  const stepMesh = new THREE.Mesh(stepGeo, stepMat);
                  stepMesh.position.set(sw / 4, sy / 2, sz);
                  stepMesh.castShadow = true;
                  stepMesh.receiveShadow = true;
                  stairGroup.add(stepMesh);
                }

              } else {
                // Straight staircase
                const numSteps = 15;
                const stepDepth = sh / numSteps;
                const stepRise = totalHeight / numSteps;

                for (let i = 0; i < numSteps; i++) {
                  const sz = sh / 2 - (i + 0.5) * stepDepth;
                  const sy = (i + 1) * stepRise;

                  const stepGeo = new THREE.BoxGeometry(sw, sy, stepDepth);
                  const stepMesh = new THREE.Mesh(stepGeo, stepMat);
                  stepMesh.position.set(0, sy / 2, sz);
                  stepMesh.castShadow = true;
                  stepMesh.receiveShadow = true;
                  stairGroup.add(stepMesh);
                }
              }

              stairGroup.castShadow = true;
              stairGroup.receiveShadow = true;
              furnGroup.add(stairGroup);
            } else {
              // Generic Fallback Object (Box)
              const boxW = f.w || 0.8;
              const boxH = ftype.includes("bbq") ? 0.95 : 0.75;
              const boxD = f.h || 0.8;
              const boxGeo = new THREE.BoxGeometry(boxW, boxH, boxD);
              const boxMat = new THREE.MeshStandardMaterial({
                color: resolvedColor || (ftype.includes("bbq") ? "#1e293b" : "#cbd5e1"),
                roughness: resolvedRoughness || 0.5,
                metalness: resolvedMetalness
              });
              const box = new THREE.Mesh(boxGeo, boxMat);
              box.position.set(0, boxH / 2, 0);
              box.castShadow = true;
              furnGroup.add(box);
            }
          }

          scene.add(furnGroup);
        });
      }
    });

    // Draw openings (doors and windows)
    if (plan.openings) {
      plan.openings.forEach((open) => {
        const ox = open.x - centerX;
        const oz = open.y - centerY;
        const rad = (open.rotation * Math.PI) / 180;

        const openGroup = new THREE.Group();
        openGroup.position.set(ox, 0, oz);
        openGroup.rotation.y = -rad;

        if (open.type === "door") {
          const isSliding = open.style === "sliding";
          const isGarage = open.style === "garage";

          // Door frames
          const frameHeight = 2.1;
          const frameLGeo = new THREE.BoxGeometry(0.04, frameHeight, thick * 1.2);
          const frameL = new THREE.Mesh(frameLGeo, frameMat);
          frameL.position.set(-open.w / 2, frameHeight / 2, 0);
          openGroup.add(frameL);

          const frameR = frameL.clone();
          frameR.position.x = open.w / 2;
          openGroup.add(frameR);

          const frameTopGeo = new THREE.BoxGeometry(open.w, 0.04, thick * 1.2);
          const frameTop = new THREE.Mesh(frameTopGeo, frameMat);
          frameTop.position.set(0, frameHeight, 0);
          openGroup.add(frameTop);

          if (isSliding) {
            // Draw sliding glass door: 2 panes overlapping
            const paneW = open.w * 0.52;
            const paneH = frameHeight * 0.95;

            // Left pane group
            const leftPaneGroup = new THREE.Group();
            leftPaneGroup.position.set(-open.w / 4, paneH / 2, -0.015);

            const frameLeftGeo = new THREE.BoxGeometry(paneW, paneH, 0.02);
            const paneLeft = new THREE.Mesh(frameLeftGeo, frameMat);
            leftPaneGroup.add(paneLeft);

            const glassLeftGeo = new THREE.BoxGeometry(paneW - 0.08, paneH - 0.08, 0.01);
            const glassLeft = new THREE.Mesh(glassLeftGeo, glassMat);
            leftPaneGroup.add(glassLeft);

            openGroup.add(leftPaneGroup);

            // Right pane group
            const rightPaneGroup = new THREE.Group();
            rightPaneGroup.position.set(open.w / 4, paneH / 2, 0.015);

            const frameRightGeo = new THREE.BoxGeometry(paneW, paneH, 0.02);
            const paneRight = new THREE.Mesh(frameRightGeo, frameMat);
            rightPaneGroup.add(paneRight);

            const glassRightGeo = new THREE.BoxGeometry(paneW - 0.08, paneH - 0.08, 0.01);
            const glassRight = new THREE.Mesh(glassRightGeo, glassMat);
            rightPaneGroup.add(glassRight);

            openGroup.add(rightPaneGroup);

          } else if (isGarage) {
            // Draw modern segmented garage door
            const panelW = open.w * 0.96;
            const panelH = frameHeight * 0.96;
            const garageMat = new THREE.MeshStandardMaterial({
              color: "#cbd5e1",
              roughness: 0.5,
              metalness: 0.1
            });
            const garagePanel = new THREE.Mesh(
              new THREE.BoxGeometry(panelW, panelH, 0.04),
              garageMat
            );
            garagePanel.position.set(0, panelH / 2, 0);
            garagePanel.castShadow = true;
            openGroup.add(garagePanel);

            // Grooves for roll-up panels
            const slatCount = 4;
            const slatH = panelH / slatCount;
            for (let i = 1; i < slatCount; i++) {
              const lineGeo = new THREE.BoxGeometry(panelW, 0.01, 0.045);
              const lineMesh = new THREE.Mesh(lineGeo, frameMat);
              lineMesh.position.set(0, i * slatH, 0);
              openGroup.add(lineMesh);
            }
            // Panel (semi-open at 45 degrees) - Hinged door
            const flipX = !!open.flipX;
            const flipY = !!open.flipY;

            const panelGeo = new THREE.BoxGeometry(open.w * 0.95, frameHeight * 0.95, 0.03);
            const panel = new THREE.Mesh(panelGeo, doorMat);

            const hingeX = flipX ? open.w / 2 : -open.w / 2;
            const panelOffsetX = flipX ? -open.w * 0.95 / 2 : open.w * 0.95 / 2;
            panel.position.set(panelOffsetX, frameHeight * 0.95 / 2, 0);

            const pivot = new THREE.Group();
            pivot.position.set(hingeX, 0, 0);
            
            let swingAngle = Math.PI / 4;
            if (flipY) swingAngle = -swingAngle;
            if (flipX) swingAngle = -swingAngle;
            
            pivot.rotation.y = swingAngle;
            pivot.add(panel);

            openGroup.add(pivot);
          }

        } else if (open.type === "window") {
          const isSliding = open.style === "sliding";
          const isBlinds = open.style === "blinds";

          const winHeight = 1.2;
          const bottomHeight = 1.0; // 1m off the ground
          const centerY = bottomHeight + winHeight / 2;

          // Outer frame
          const frameGeo = new THREE.BoxGeometry(open.w, winHeight, thick * 1.2);
          const outerFrame = new THREE.Mesh(frameGeo, frameMat);
          outerFrame.position.set(0, centerY, 0);
          openGroup.add(outerFrame);

          if (isSliding) {
            // Draw overlapping sliding window panes
            const paneW = open.w * 0.52;
            const paneH = winHeight * 0.85;

            // Left pane
            const lpGroup = new THREE.Group();
            lpGroup.position.set(-open.w / 4, centerY, -0.01);

            const lpFrame = new THREE.Mesh(new THREE.BoxGeometry(paneW, paneH, thick * 0.3), frameMat);
            lpGroup.add(lpFrame);
            const lpGlass = new THREE.Mesh(new THREE.BoxGeometry(paneW - 0.04, paneH - 0.04, thick * 0.15), glassMat);
            lpGroup.add(lpGlass);
            openGroup.add(lpGroup);

            // Right pane
            const rpGroup = new THREE.Group();
            rpGroup.position.set(open.w / 4, centerY, 0.01);

            const rpFrame = new THREE.Mesh(new THREE.BoxGeometry(paneW, paneH, thick * 0.3), frameMat);
            rpGroup.add(rpFrame);
            const rpGlass = new THREE.Mesh(new THREE.BoxGeometry(paneW - 0.04, paneH - 0.04, thick * 0.15), glassMat);
            rpGroup.add(rpGlass);
            openGroup.add(rpGroup);

          } else if (isBlinds) {
            // Draw window with horizontal blinds slats inside
            const paneGeo = new THREE.BoxGeometry(open.w * 0.9, winHeight * 0.8, thick * 0.4);
            const glassPane = new THREE.Mesh(paneGeo, glassMat);
            glassPane.position.set(0, centerY, 0);
            openGroup.add(glassPane);

            // Slats count
            const slatCount = 6;
            const slatH = (winHeight * 0.8) / slatCount;
            const blindsMat = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.9 });
            for (let i = 0; i < slatCount; i++) {
              const slatGeo = new THREE.BoxGeometry(open.w * 0.88, 0.015, thick * 0.3);
              const slatMesh = new THREE.Mesh(slatGeo, blindsMat);
              slatMesh.rotation.x = Math.PI / 6;
              slatMesh.position.set(0, bottomHeight + winHeight * 0.1 + i * slatH, 0);
              openGroup.add(slatMesh);
            }

          } else {
            // Hinged window / Default: Glass pane inside frame
            const paneGeo = new THREE.BoxGeometry(open.w * 0.9, winHeight * 0.8, thick * 0.4);
            const glassPane = new THREE.Mesh(paneGeo, glassMat);
            glassPane.position.set(0, centerY, 0);
            openGroup.add(glassPane);

            // Middle vertical splitter
            const splitGeo = new THREE.BoxGeometry(0.04, winHeight * 0.8, thick * 0.5);
            const splitter = new THREE.Mesh(splitGeo, frameMat);
            splitter.position.set(0, centerY, 0);
            openGroup.add(splitter);
          }
        }

        scene.add(openGroup);
      });
    }
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Initialize Scene, Camera, and Renderer
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#bae6fd"); // Sky blue background
    sceneRef.current = scene;

    // Add Sky Dome
    const skyTex = createSkyTexture();
    const skyGeo = new THREE.SphereGeometry(200, 32, 15);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.rotation.y = Math.PI / 4; // align clouds to camera angle
    scene.add(sky);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(9, 9, 9);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera going below ground
    controls.minDistance = 1; // allow close flycam zooming
    controls.maxDistance = 40;
    controlsRef.current = controls;

    // 3. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaf0, 0.8);
    sunLight.position.set(15, 25, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Soft fill light from opposite angle
    const fillLight = new THREE.DirectionalLight(0xbae6fd, 0.3);
    fillLight.position.set(-15, 10, -10);
    scene.add(fillLight);

    // CubeCamera for real-time reflections
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      format: THREE.RGBAFormat,
    });
    cubeRenderTargetRef.current = cubeRenderTarget;

    const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget);
    cubeCamera.position.set(0, 1.2, 0); // centered, eye-level
    scene.add(cubeCamera);
    cubeCameraRef.current = cubeCamera;

    // Initial render flag – the scene-update effect will do the first draw
    needsRenderRef.current = true;

    let controlsChanged = false;
    const requestRender = () => {
      controlsChanged = true;
    };
    controls.addEventListener("change", requestRender);

    const handleControlsEnd = () => {
      if (activeCameraRef.current && onChangeCameraRef.current) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const rotation = (Math.atan2(dir.z, dir.x) * 180) / Math.PI + 90;
        const normalizedRotation = (Math.round(rotation) + 360) % 360;
        onChangeCameraRef.current({ rotation: normalizedRotation });
      }
    };
    controls.addEventListener("end", handleControlsEnd);

    // 5. Animation Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const controlsUpdated = controls.update();
      if (controlsUpdated || controlsChanged || needsRenderRef.current) {
        renderer.render(scene, camera);
        controlsChanged = false;
        needsRenderRef.current = false;
      }
    };
    animate();

    // 6. Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // 7. Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      
      // Dispose materials & geometries
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });

      if (cubeRenderTargetRef.current) {
        cubeRenderTargetRef.current.dispose();
      }

      controls.removeEventListener("change", requestRender);
      controls.removeEventListener("end", handleControlsEnd);
      controls.dispose();
      renderer.dispose();
      container.innerHTML = "";
    };
  }, []);

  // ── Scene update effect: rebuild geometry when floorPlan / finishes change ─
  // This runs without destroying the renderer so there is no white-screen flash.
  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const cubeCamera = cubeCameraRef.current;
    const cubeTarget = cubeRenderTargetRef.current;
    if (!scene || !renderer || !floorPlan) return;

    // 1. Remove previous scene objects group and dispose its resources
    if (sceneObjectsGroupRef.current) {
      sceneObjectsGroupRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      scene.remove(sceneObjectsGroupRef.current);
      sceneObjectsGroupRef.current = null;
    }

    // 2. Snapshot existing scene children (sky, lights, cubeCamera, etc.)
    const existingChildren = new Set(scene.children.map((c) => c.uuid));

    // 3. Call draw3DScene – it adds meshes directly to `scene` as usual
    draw3DScene(scene, floorPlan, wallThickness, finishes, cubeTarget?.texture ?? null);

    // 4. Collect all newly added objects into a dedicated group so we can
    //    remove them cleanly next time without touching lights / sky / controls.
    const group = new THREE.Group();
    const newObjects = scene.children.filter((c) => !existingChildren.has(c.uuid));
    newObjects.forEach((obj) => scene.remove(obj));
    newObjects.forEach((obj) => group.add(obj));
    sceneObjectsGroupRef.current = group;
    scene.add(group);

    // 5. Refresh cube-camera reflections
    if (cubeCamera) {
      cubeCamera.update(renderer, scene);
    }

    // 6. Signal the animation loop to render a fresh frame
    needsRenderRef.current = true;
  }, [floorPlan, wallThickness, finishes, draw3DScene]);

  // Expose screenshot capture function to parent
  useEffect(() => {
    if (onCaptureRef) {
      onCaptureRef.current = () => {
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        const container = mountRef.current;
        if (!renderer || !scene || !camera || !container) return "";

        // 1. Store original canvas display size
        const originalWidth = container.clientWidth || 800;
        const originalHeight = container.clientHeight || 500;

        // 2. Temporarily resize renderer & camera to high-resolution 2K matching aspect ratio option
        const targetW = 2048;
        let targetH = 1536; // default 4:3
        const aspectStr = activeCameraRef.current?.aspectRatio;
        if (aspectStr === "Widescreen (16:9)") {
          targetH = 1152;
        } else if (aspectStr === "Square (1:1)") {
          targetH = 2048;
        }
        renderer.setSize(targetW, targetH);
        camera.aspect = targetW / targetH;
        camera.updateProjectionMatrix();

        // 3. Render the high-resolution frame
        renderer.render(scene, camera);

        // 4. Capture the WebGL canvas as DataURL
        const dataUrl = renderer.domElement.toDataURL("image/png");

        // 5. Restore original renderer size & aspect ratio
        renderer.setSize(originalWidth, originalHeight);
        camera.aspect = originalWidth / originalHeight;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera); // render original viewport again

        return dataUrl;
      };
    }
    return () => {
      if (onCaptureRef) {
        onCaptureRef.current = null;
      }
    };
  }, [onCaptureRef]);

  // Synchronize 3D camera with 2D activeCamera
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const renderer = rendererRef.current;
    if (!scene || !camera || !floorPlan || !controls) return;

    // Toggle ceiling visibility based on active camera mode
    const showCeiling = !!activeCamera && renderMode !== "Floorplan to 3D Floorplan";
    scene.traverse((child) => {
      if (child.userData && child.userData.isCeiling) {
        child.visible = showCeiling;
      }
    });

    if (activeCamera && renderMode !== "Floorplan to 3D Floorplan") {
      // 1. Calculate center offset to map coordinates correctly
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      floorPlan.rooms.forEach((r) => {
        minX = Math.min(minX, r.x);
        maxX = Math.max(maxX, r.x + r.w);
        minY = Math.min(minY, r.y);
        maxY = Math.max(maxY, r.y + r.h);
      });
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      // 2. Position target at camera coordinates on the floor plan
      const rx = activeCamera.x - centerX;
      const rz = activeCamera.y - centerY;
      const height = 1.25;

      controls.target.set(rx, height, rz);

      // Reset camera up vector to default before lookAt
      camera.up.set(0, 1, 0);

      // 3. Position camera slightly behind the target in the opposite look direction (first-person look-around)
      const rad = ((activeCamera.rotation - 90) * Math.PI) / 180;
      const offset = 0.05; // 5cm offset
      const camX = rx - Math.cos(rad) * offset;
      const camZ = rz - Math.sin(rad) * offset;

      camera.position.set(camX, height, camZ);
      camera.lookAt(new THREE.Vector3(rx, height, rz));

      if (activeCamera.fov) {
        camera.fov = activeCamera.fov;
        camera.updateProjectionMatrix();
      }

      // Configure OrbitControls constraints for first-person look-around
      controls.enabled = true;
      controls.minDistance = 0.01;
      controls.maxDistance = 0.1;
      controls.maxPolarAngle = Math.PI - 0.05; // allow looking down at floor
      controls.minPolarAngle = 0.05;          // allow looking up at ceiling
      controls.update();

      // Trigger redraw
      if (renderer) {
        renderer.render(scene, camera);
      }
    } else {
      // Restore default constraints for dollhouse view
      controls.minDistance = 1;
      controls.maxDistance = 40;
      controls.maxPolarAngle = Math.PI / 2 - 0.05; // prevent going below ground
      controls.minPolarAngle = 0.05;

      if (renderMode === "Floorplan to 3D Floorplan") {
        // Calculate the bounding box of the floor plan to set the height dynamically
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        floorPlan.rooms.forEach((r) => {
          minX = Math.min(minX, r.x);
          maxX = Math.max(maxX, r.x + r.w);
          minY = Math.min(minY, r.y);
          maxY = Math.max(maxY, r.y + r.h);
        });
        const width = maxX - minX;
        const length = maxY - minY;
        const maxDim = Math.max(width, length, 5);
        const height = maxDim * 1.3;

        camera.position.set(0, height, 0);
        camera.up.set(0, 0, -1); // Align orientation with 2D layout (North is up)
        controls.target.set(0, 0, 0);
      } else {
        // Fallback to bird's eye dollhouse view
        camera.position.set(9, 9, 9);
        camera.up.set(0, 1, 0); // Restore default up vector
        controls.target.set(0, 0, 0);
      }
      controls.enabled = true;
      controls.update();

      // Trigger redraw
      if (renderer) {
        renderer.render(scene, camera);
      }
    }
  }, [activeCamera, floorPlan, renderMode]);

  const _handleZoomIn = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    camera.position.addScaledVector(direction, 1.5);
    controls.update();
  };

  const _handleZoomOut = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    camera.position.addScaledVector(direction, -1.5);
    controls.update();
  };

  const _handleResetCamera = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    if (activeCamera && renderMode !== "Floorplan to 3D Floorplan") {
      // Re-sync to activeCamera
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      floorPlan.rooms.forEach((r) => {
        minX = Math.min(minX, r.x);
        maxX = Math.max(maxX, r.x + r.w);
        minY = Math.min(minY, r.y);
        maxY = Math.max(maxY, r.y + r.h);
      });
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const rx = activeCamera.x - centerX;
      const rz = activeCamera.y - centerY;
      const height = 1.25;
      camera.position.set(rx, height, rz);
      camera.up.set(0, 1, 0);
      const rad = ((activeCamera.rotation - 90) * Math.PI) / 180;
      const targetX = rx + Math.cos(rad) * 10;
      const targetZ = rz + Math.sin(rad) * 10;
      camera.lookAt(new THREE.Vector3(targetX, height, targetZ));
      controls.target.set(targetX, height, targetZ);
    } else {
      if (renderMode === "Floorplan to 3D Floorplan") {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        floorPlan.rooms.forEach((r) => {
          minX = Math.min(minX, r.x);
          maxX = Math.max(maxX, r.x + r.w);
          minY = Math.min(minY, r.y);
          maxY = Math.max(maxY, r.y + r.h);
        });
        const width = maxX - minX;
        const length = maxY - minY;
        const maxDim = Math.max(width, length, 5);
        const height = maxDim * 1.3;
        camera.position.set(0, height, 0);
        camera.up.set(0, 0, -1);
        controls.target.set(0, 0, 0);
      } else {
        camera.position.set(9, 9, 9);
        camera.up.set(0, 1, 0);
        controls.target.set(0, 0, 0);
      }
    }
    controls.update();
  };

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{ minHeight: "350px", height: "100%" }}
    >
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
};
