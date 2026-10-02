import * as THREE from "three";
import type { MapId, Team, Vec3 } from "./types";

export type MatId =
  | "concrete"
  | "metal"
  | "wood"
  | "brick"
  | "container"
  | "sand"
  | "plaster"
  | "rust"
  | "dark"
  | "accent";

export type AABB = {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
};

export type BombSite = {
  name: string;
  x: number;
  z: number;
  r: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type MapBuilt = {
  group: THREE.Group;
  colliders: AABB[];
  spawnsCT: Vec3[];
  spawnsTR: Vec3[];
  waypoints: Vec3[];
  sites: BombSite[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  fog: THREE.Fog;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  dispose: () => void;
};

export function inSite(s: BombSite, x: number, z: number): boolean {
  return x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ;
}

function siteRoom(name: string, x: number, z: number, minX: number, maxX: number, minZ: number, maxZ: number): BombSite {
  const hx = (maxX - minX) / 2;
  const hz = (maxZ - minZ) / 2;
  return { name, x, z, r: Math.min(hx, hz), minX, maxX, minZ, maxZ };
}

const TEX: Partial<Record<MatId, string>> = {
  concrete: "/game/concrete-tile.jpg",
  metal: "/game/metal-tile.jpg",
  wood: "/game/wood-tile.jpg",
  brick: "/game/brick-tile.jpg",
  container: "/game/container-tile.jpg",
  sand: "/game/sand-tile.jpg",
  plaster: "/game/plaster-tile.jpg",
  rust: "/game/rust-tile.jpg",
};

const FALLBACK: Record<MatId, number> = {
  concrete: 0x6a6e72,
  metal: 0x3a3d44,
  wood: 0x6b4a2a,
  brick: 0x7a3d32,
  container: 0x2f6a62,
  sand: 0xb59a6a,
  plaster: 0xb7b1a4,
  rust: 0x8a4a28,
  dark: 0x1a1c22,
  accent: 0xc45a10,
};

type BoxSpec = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  m: MatId;
  col?: boolean;
  rx?: number;
  rz?: number;
};

function aabbOf(b: BoxSpec): AABB {
  const hx = b.w / 2;
  const hy = b.h / 2;
  const hz = b.d / 2;
  return {
    minX: b.x - hx,
    maxX: b.x + hx,
    minY: b.y - hy,
    maxY: b.y + hy,
    minZ: b.z - hz,
    maxZ: b.z + hz,
  };
}

export function aabbHit(a: AABB, b: AABB): boolean {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY &&
    a.minZ < b.maxZ &&
    a.maxZ > b.minZ
  );
}

export function pointIn(a: AABB, x: number, y: number, z: number): boolean {
  return x >= a.minX && x <= a.maxX && y >= a.minY && y <= a.maxY && z >= a.minZ && z <= a.maxZ;
}

export function raycastAABB(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  boxes: AABB[],
): { t: number; x: number; y: number; z: number; nx: number; ny: number; nz: number; i: number } | null {
  let best = maxDist;
  let hit: ReturnType<typeof raycastAABB> = null;
  const invX = dx !== 0 ? 1 / dx : 1e12;
  const invY = dy !== 0 ? 1 / dy : 1e12;
  const invZ = dz !== 0 ? 1 / dz : 1e12;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]!;
    const tx1 = (b.minX - ox) * invX;
    const tx2 = (b.maxX - ox) * invX;
    const ty1 = (b.minY - oy) * invY;
    const ty2 = (b.maxY - oy) * invY;
    const tz1 = (b.minZ - oz) * invZ;
    const tz2 = (b.maxZ - oz) * invZ;
    const tmin = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2), Math.min(tz1, tz2));
    const tmax = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2), Math.max(tz1, tz2));
    if (tmax < 0 || tmin > tmax || tmin > best || tmin < 0) continue;
    const t = tmin;
    const x = ox + dx * t;
    const y = oy + dy * t;
    const z = oz + dz * t;
    const eps = 0.002;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    if (Math.abs(x - b.minX) < eps) nx = -1;
    else if (Math.abs(x - b.maxX) < eps) nx = 1;
    else if (Math.abs(y - b.minY) < eps) ny = -1;
    else if (Math.abs(y - b.maxY) < eps) ny = 1;
    else if (Math.abs(z - b.minZ) < eps) nz = -1;
    else nz = 1;
    best = t;
    hit = { t, x, y, z, nx, ny, nz, i };
  }
  return hit;
}

export function aabbExitT(
  b: AABB,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
): number {
  const invX = dx !== 0 ? 1 / dx : 1e12;
  const invY = dy !== 0 ? 1 / dy : 1e12;
  const invZ = dz !== 0 ? 1 / dz : 1e12;
  const tx1 = (b.minX - ox) * invX;
  const tx2 = (b.maxX - ox) * invX;
  const ty1 = (b.minY - oy) * invY;
  const ty2 = (b.maxY - oy) * invY;
  const tz1 = (b.minZ - oz) * invZ;
  const tz2 = (b.maxZ - oz) * invZ;
  const tmax = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2), Math.max(tz1, tz2));
  return Number.isFinite(tmax) ? Math.max(0.02, tmax) : 0.4;
}

export function moveCylinder(
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  dx: number,
  dy: number,
  dz: number,
  boxes: AABB[],
): { x: number; y: number; z: number; grounded: boolean; hit: boolean } {
  let hit = false;
  const step = 0.42;

  function blocked(nx: number, ny: number, nz: number): AABB | null {
    const body: AABB = {
      minX: nx - radius,
      maxX: nx + radius,
      minY: ny + 0.08,
      maxY: ny + height,
      minZ: nz - radius,
      maxZ: nz + radius,
    };
    for (const b of boxes) if (aabbHit(body, b)) return b;
    return null;
  }

  let nx = x + dx;
  if (blocked(nx, y, z)) {
    hit = true;
    const b = blocked(nx, y + step, z);
    if (!b && dy >= -0.02) {
      y += step;
      nx = x + dx;
      if (blocked(nx, y, z)) nx = x;
    } else nx = x;
  }
  x = nx;

  let nz = z + dz;
  if (blocked(x, y, nz)) {
    hit = true;
    const b = blocked(x, y + step, nz);
    if (!b && dy >= -0.02) {
      y += step;
      nz = z + dz;
      if (blocked(x, y, nz)) nz = z;
    } else nz = z;
  }
  z = nz;

  let ny = y + dy;
  if (ny < 0) {
    ny = 0;
    dy = 0;
  }
  if (blocked(x, ny, z)) {
    if (dy > 0) ny = y;
    else {
      let ground = 0;
      const feet: AABB = {
        minX: x - radius * 0.7,
        maxX: x + radius * 0.7,
        minY: ny,
        maxY: y + 0.2,
        minZ: z - radius * 0.7,
        maxZ: z + radius * 0.7,
      };
      for (const b of boxes) {
        if (aabbHit(feet, b) && b.maxY <= y + step + 0.05) ground = Math.max(ground, b.maxY);
      }
      ny = ground;
    }
  }

  let grounded = ny <= 0.02;
  const probe: AABB = {
    minX: x - radius * 0.6,
    maxX: x + radius * 0.6,
    minY: ny - 0.08,
    maxY: ny + 0.12,
    minZ: z - radius * 0.6,
    maxZ: z + radius * 0.6,
  };
  for (const b of boxes) {
    if (aabbHit(probe, b) && Math.abs(b.maxY - ny) < 0.14) grounded = true;
  }
  return { x, y: ny, z, grounded, hit };
}

function loadMats(loader: THREE.TextureLoader, aniso: number) {
  const mats: Partial<Record<MatId, THREE.MeshStandardMaterial>> = {};
  const colorMat = (id: MatId, map?: THREE.Texture) => {
    const m = new THREE.MeshStandardMaterial({
      color: map ? 0xffffff : FALLBACK[id],
      map: map ?? null,
      roughness: id === "metal" || id === "container" ? 0.45 : 0.82,
      metalness: id === "metal" || id === "container" || id === "rust" ? 0.35 : 0.04,
    });
    return m;
  };
  for (const id of Object.keys(TEX) as MatId[]) {
    const url = TEX[id];
    if (!url) continue;
    const mat = colorMat(id);
    loader.load(url, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = aniso;
      mat.map = t;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
    });
    mats[id] = mat;
  }
  mats.dark = colorMat("dark");
  mats.accent = colorMat("accent");
  return mats as Record<MatId, THREE.MeshStandardMaterial>;
}

function meshBox(b: BoxSpec, mats: Record<MatId, THREE.MeshStandardMaterial>): THREE.Mesh {
  const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
  const uv = geo.attributes.uv;
  if (uv) {
    const rx = Math.max(1, b.w / 2.5);
    const ry = Math.max(1, Math.max(b.h, b.d) / 2.5);
    for (let i = 0; i < uv.count; i++) {
      const ox = ((b.x * 0.37) % 1 + 1) % 1;
      const oy = ((b.z * 0.23 + b.y * 0.11) % 1 + 1) % 1;
      uv.setXY(i, uv.getX(i) * rx + ox, uv.getY(i) * ry + oy);
    }
    uv.needsUpdate = true;
  }
  const mesh = new THREE.Mesh(geo, mats[b.m]);
  mesh.position.set(b.x, b.y, b.z);
  mesh.castShadow = b.h < 5 && b.w < 8;
  mesh.receiveShadow = true;
  return mesh;
}

function buildFrom(
  boxes: BoxSpec[],
  extra: {
    spawnsCT: Vec3[];
    spawnsTR: Vec3[];
    sites: MapBuilt["sites"];
    bounds: MapBuilt["bounds"];
    fog: THREE.Fog;
    hemi: THREE.HemisphereLight;
    sun: THREE.DirectionalLight;
    lamps?: Array<{ x: number; y: number; z: number; c: number; i: number }>;
    fluoro?: { y: number; zs: number[]; w: number };
  },
  loader: THREE.TextureLoader,
  aniso: number,
): MapBuilt {
  const mats = loadMats(loader, aniso);
  const group = new THREE.Group();
  const colliders: AABB[] = [];
  for (const b of boxes) {
    group.add(meshBox(b, mats));
    if (b.col !== false) colliders.push(aabbOf(b));
  }
  const walkable = colliders.filter((c) => {
    if (c.maxY > 1.65) return true;
    for (const s of extra.sites) {
      const pad: AABB = {
        minX: s.x - 1.2,
        maxX: s.x + 1.2,
        minY: 0,
        maxY: 1.6,
        minZ: s.z - 1.2,
        maxZ: s.z + 1.2,
      };
      if (aabbHit(c, pad)) return false;
    }
    return true;
  });
  for (const s of extra.sites) {
    group.add(makeSiteLetter(s.name, s.x, s.z));
  }
  for (const l of extra.lamps ?? []) {
    const p = new THREE.PointLight(l.c, l.i, 28, 1.15);
    p.position.set(l.x, l.y, l.z);
    group.add(p);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      new THREE.MeshBasicMaterial({ color: l.c }),
    );
    bulb.position.copy(p.position);
    group.add(bulb);
  }
  if (extra.fluoro) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe8c0 });
    for (const z of extra.fluoro.zs) {
      const tube = new THREE.Mesh(new THREE.BoxGeometry(extra.fluoro.w, 0.08, 0.28), mat);
      tube.position.set(0, extra.fluoro.y, z);
      group.add(tube);
    }
  }
  addSpawnKits(group, extra.spawnsCT, extra.spawnsTR);
  group.add(extra.hemi);
  group.add(extra.sun);
  const waypoints: Vec3[] = [];
  const { minX, maxX, minZ, maxZ } = extra.bounds;
  for (let x = minX + 3; x <= maxX - 3; x += 3.5) {
    for (let z = minZ + 3; z <= maxZ - 3; z += 3.5) {
      const body: AABB = {
        minX: x - 0.4,
        maxX: x + 0.4,
        minY: 0.2,
        maxY: 1.6,
        minZ: z - 0.4,
        maxZ: z + 0.4,
      };
      if (!walkable.some((c) => aabbHit(body, c))) waypoints.push({ x, y: 0, z });
    }
  }
  return {
    group,
    colliders: walkable,
    spawnsCT: extra.spawnsCT,
    spawnsTR: extra.spawnsTR,
    waypoints,
    sites: extra.sites,
    bounds: extra.bounds,
    fog: extra.fog,
    hemi: extra.hemi,
    sun: extra.sun,
    dispose: () => {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) (mat as THREE.Material).dispose();
      });
    },
  };
}

function deco(
  list: BoxSpec[],
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  m: MatId,
) {
  list.push({ x, y, z, w, h, d, m, col: false });
}

function wall(
  list: BoxSpec[],
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  m: MatId,
) {
  list.push({ x, y, z, w, h, d, m });
}

function crate(list: BoxSpec[], x: number, z: number, y = 0.55, s = 1.1, m: MatId = "wood") {
  list.push({ x, y, z, w: s, h: s, d: s, m });
}

function stack(list: BoxSpec[], x: number, z: number, n: number, s = 1.15) {
  for (let i = 0; i < n; i++) crate(list, x, z, s / 2 + i * s, s);
}

function gatedWall(
  list: BoxSpec[],
  cx: number,
  cz: number,
  along: "x" | "z",
  length: number,
  height: number,
  thick: number,
  mat: MatId,
  door: boolean,
) {
  if (!door) {
    if (along === "x") wall(list, cx, height / 2, cz, length, height, thick, mat);
    else wall(list, cx, height / 2, cz, thick, height, length, mat);
    return;
  }
  const doorW = 1.85;
  const doorH = 2.2;
  const side = (length - doorW) / 2;
  if (side < 0.45) {
    if (along === "x") wall(list, cx, height / 2, cz, length, height, thick, mat);
    else wall(list, cx, height / 2, cz, thick, height, length, mat);
    return;
  }
  const yLint = doorH + (height - doorH) / 2;
  const lintH = Math.max(0.35, height - doorH);
  if (along === "x") {
    wall(list, cx - (doorW + side) / 2, doorH / 2, cz, side, doorH, thick, mat);
    wall(list, cx + (doorW + side) / 2, doorH / 2, cz, side, doorH, thick, mat);
    wall(list, cx, yLint, cz, length, lintH, thick, mat);
  } else {
    wall(list, cx, doorH / 2, cz - (doorW + side) / 2, thick, doorH, side, mat);
    wall(list, cx, doorH / 2, cz + (doorW + side) / 2, thick, doorH, side, mat);
    wall(list, cx, yLint, cz, thick, lintH, length, mat);
  }
}

function hollowHouse(
  list: BoxSpec[],
  x: number,
  z: number,
  w: number,
  d: number,
  floors: number,
  doors: Array<"n" | "s" | "e" | "w">,
  mat: MatId = "brick",
  opt?: { crate?: boolean },
) {
  const h = floors * 2.85;
  const t = 0.38;
  gatedWall(list, x, z + d / 2 - t / 2, "x", w, h, t, mat, doors.includes("n"));
  gatedWall(list, x, z - d / 2 + t / 2, "x", w, h, t, mat, doors.includes("s"));
  gatedWall(list, x + w / 2 - t / 2, z, "z", d, h, t, mat, doors.includes("e"));
  gatedWall(list, x - w / 2 + t / 2, z, "z", d, h, t, mat, doors.includes("w"));
  wall(list, x, h + 0.12, z, w + 0.15, 0.24, d + 0.15, "plaster");
  if (opt?.crate !== false) {
    const cx = x + (doors.includes("w") ? 1.5 : doors.includes("e") ? -1.5 : Math.min(1.6, w * 0.22));
    const cz = z + (doors.includes("s") ? 1.1 : doors.includes("n") ? -1.1 : -Math.min(1.1, d * 0.18));
    crate(list, cx, cz, 0.5, 1.0, "wood");
  }
  deco(list, x, 0.03, z, Math.min(3.2, w * 0.45), 0.04, Math.min(2.4, d * 0.4), "sand");
}

function addSpawnKits(group: THREE.Group, cts: Vec3[], trs: Vec3[]) {
  const avg = (arr: Vec3[]) => ({
    x: arr.reduce((s, p) => s + p.x, 0) / Math.max(1, arr.length),
    z: arr.reduce((s, p) => s + p.z, 0) / Math.max(1, arr.length),
  });
  const mark = (x: number, z: number, c: number, i: number) => {
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.32, depthWrite: false }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(x, 0.05, z);
    group.add(pad);
    const light = new THREE.PointLight(c, i, 18, 1.15);
    light.position.set(x, 3.4, z);
    group.add(light);
  };
  const ct = avg(cts);
  const tr = avg(trs);
  mark(ct.x, ct.z, 0x4aa3ff, 7.5);
  mark(tr.x, tr.z, 0xff4a4a, 7.5);
}

function makeSiteLetter(ch: string, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const col = ch === "A" ? 0xff6a00 : 0xffb020;
  const m = new THREE.MeshBasicMaterial({ color: col });
  const add = (w: number, h: number, d: number, px: number, py: number, pz: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(px, py, pz);
    g.add(mesh);
  };
  if (ch === "A") {
    add(0.22, 2.15, 0.2, -0.46, 1.15, 0);
    add(0.22, 2.15, 0.2, 0.46, 1.15, 0);
    add(0.96, 0.2, 0.2, 0, 1.05, 0);
    add(0.52, 0.2, 0.2, 0, 2.05, 0);
  } else {
    add(0.22, 2.15, 0.2, -0.4, 1.15, 0);
    add(0.72, 0.2, 0.2, 0.1, 2.12, 0);
    add(0.66, 0.2, 0.2, 0.08, 1.15, 0);
    add(0.72, 0.2, 0.2, 0.1, 0.18, 0);
    add(0.2, 0.86, 0.2, 0.44, 1.64, 0);
    add(0.2, 0.86, 0.2, 0.44, 0.62, 0);
  }
  const pole = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.9, 0.14),
    new THREE.MeshLambertMaterial({ color: 0x2a2d36 }),
  );
  pole.position.set(0, 0.28, 0);
  g.add(pole);
  g.position.set(x, 0, z);
  g.rotation.y = Math.atan2(-x, -z);
  g.scale.setScalar(1.15);
  return g;
}

export function buildMap(id: MapId, loader: THREE.TextureLoader, aniso: number): MapBuilt {
  if (id === "harbor") return buildHarbor(loader, aniso);
  if (id === "bazaar") return buildBazaar(loader, aniso);
  if (id === "library") return buildLibrary(loader, aniso);
  if (id === "street") return buildStreet(loader, aniso);
  return buildDepot(loader, aniso);
}

function buildStreet(loader: THREE.TextureLoader, aniso: number): MapBuilt {
  const b: BoxSpec[] = [];
  const W = 36;
  const D = 64;
  wall(b, 0, -0.2, 0, W, 0.4, D, "concrete");
  wall(b, 0, 0.02, 0, 8, 0.08, D - 2, "dark");
  wall(b, 0, 3.2, D / 2, W, 6.4, 0.6, "brick");
  wall(b, 0, 3.2, -D / 2, W, 6.4, 0.6, "brick");
  wall(b, W / 2, 3.2, 0, 0.6, 6.4, D, "brick");
  wall(b, -W / 2, 3.2, 0, 0.6, 6.4, D, "brick");

  const block = (x: number, z: number, w: number, d: number, h: number, m: MatId) => {
    wall(b, x, h / 2, z, w, h, d, m);
  };
  block(-12, -20, 10, 14, 8, "plaster");
  block(-12, 6, 10, 16, 7, "brick");
  block(-12, 24, 10, 10, 6, "plaster");
  block(12, -18, 10, 16, 9, "brick");
  block(12, 8, 10, 12, 6.5, "plaster");
  block(12, 24, 10, 8, 7, "brick");

  wall(b, -2.2, 1.15, 2, 2.4, 2.1, 6.2, "metal");
  wall(b, -2.2, 2.35, 4.2, 2.2, 1.3, 2.2, "metal");
  deco(b, -2.2, 1.15, 2, 2.42, 0.28, 6.22, "accent");
  wall(b, -3.5, 0.45, -0.6, 0.5, 0.9, 0.5, "dark");
  wall(b, -0.9, 0.45, -0.6, 0.5, 0.9, 0.5, "dark");
  wall(b, -3.5, 0.45, 4.6, 0.5, 0.9, 0.5, "dark");
  wall(b, -0.9, 0.45, 4.6, 0.5, 0.9, 0.5, "dark");

  deco(b, -6.2, 5.2, -20, 0.4, 6, 0.4, "rust");
  deco(b, -6.2, 8.4, -20, 2.4, 0.7, 0.2, "accent");
  deco(b, 6.4, 6.4, 8, 0.35, 8, 0.35, "metal");
  deco(b, 6.4, 10.2, 8, 1.6, 0.5, 0.2, "accent");

  // dark window grid on street faces, two floors, only over existing block z-ranges
  const facade = (faceX: number, z0: number, z1: number) => {
    const margin = 1.2;
    const usable = z1 - z0 - margin * 2;
    const n = Math.max(2, Math.round(usable / 2.05));
    for (let i = 0; i < n; i++) {
      const z = z0 + margin + (usable * i) / (n - 1);
      deco(b, faceX, 1.8, z, 0.08, 0.9, 0.7, "dark");
      deco(b, faceX, 4.05, z, 0.08, 0.9, 0.7, "dark");
    }
  };
  facade(-6.94, -27, -13);
  facade(-6.94, -2, 14);
  facade(-6.94, 19, 29);
  facade(6.94, -26, -10);
  facade(6.94, 2, 14);
  facade(6.94, 20, 28);

  // crosswalk paint on asphalt only
  for (const base of [12, -8]) {
    for (const dz of [-0.72, 0, 0.72]) {
      deco(b, 0, 0.075, base + dz, 6.2, 0.02, 0.34, "dark");
    }
  }

  // sidewalk props (non-colliding)
  deco(b, -5.2, 0.45, -11.3, 0.55, 0.9, 0.55, "metal");
  deco(b, -5.75, 0.41, -11.9, 0.48, 0.82, 0.48, "metal");
  deco(b, 5.45, 0.45, 5.8, 0.55, 0.9, 0.55, "metal");
  deco(b, 5.95, 0.38, 6.45, 0.46, 0.76, 0.46, "rust");
  const cone = (x: number, z: number) => {
    deco(b, x, 0.12, z, 0.36, 0.24, 0.36, "accent");
    deco(b, x, 0.38, z, 0.2, 0.32, 0.2, "accent");
  };
  cone(-4.55, 12.7);
  cone(4.55, 12.7);
  cone(-4.55, -8.6);
  cone(4.55, -8.6);
  deco(b, -5.85, 1.25, 21.2, 0.1, 2.5, 0.1, "metal");
  deco(b, -5.85, 2.35, 21.2, 0.08, 0.7, 1.2, "accent");

  const lampPost = (x: number, z: number) => {
    const s = x < 0 ? 1 : -1;
    deco(b, x, 2.75, z, 0.12, 5.5, 0.12, "dark");
    deco(b, x + s * 0.3, 5.42, z, 0.68, 0.08, 0.16, "metal");
    deco(b, x + s * 0.55, 5.28, z, 0.34, 0.14, 0.3, "accent");
  };
  lampPost(-5.7, -16);
  lampPost(5.7, -18);
  lampPost(-5.7, 9.5);
  lampPost(5.7, 21);

  // low sidewalk cover only — h ≤ 0.9, whole box in 4.2 ≤ |x| ≤ 7.2, |z| < 22
  wall(b, -5.5, 0.38, -8.2, 1.8, 0.76, 0.42, "concrete");
  wall(b, -5.9, 0.4, 4.4, 0.8, 0.8, 0.7, "metal");
  wall(b, 5.4, 0.36, 13.4, 1.6, 0.72, 0.4, "concrete");
  wall(b, 6.0, 0.42, -14.2, 0.6, 0.84, 1.2, "rust");

  const sun = new THREE.DirectionalLight(0xfff4e0, 1.7);
  sun.position.set(-10, 22, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  const hemi = new THREE.HemisphereLight(0xc5ddff, 0x6a5a48, 1.15);

  return buildFrom(
    b,
    {
      spawnsCT: [
        { x: -2, y: 0, z: 26 },
        { x: 0, y: 0, z: 27 },
        { x: 2, y: 0, z: 26 },
        { x: -1, y: 0, z: 24.5 },
        { x: 1, y: 0, z: 24.5 },
      ],
      spawnsTR: [
        { x: -2, y: 0, z: -26 },
        { x: 0, y: 0, z: -27 },
        { x: 2, y: 0, z: -26 },
        { x: -1, y: 0, z: -24.5 },
        { x: 1, y: 0, z: -24.5 },
      ],
      sites: [
        siteRoom("A", 12, -4, 9, 15, -7.2, -0.8),
        siteRoom("B", -12, 16.5, -15, -9, 14.6, 18.4),
      ],
      bounds: { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 },
      fog: new THREE.Fog(0x9eb6d6, 40, 110),
      hemi,
      sun,
      lamps: [
        { x: -5.7, y: 5.5, z: -16, c: 0xffc56a, i: 7.5 },
        { x: 5.7, y: 5.5, z: -18, c: 0xffc56a, i: 8 },
        { x: -5.7, y: 5.5, z: 9.5, c: 0xffd28a, i: 7 },
        { x: 5.7, y: 5.5, z: 21, c: 0xffd28a, i: 8 },
      ],
    },
    loader,
    aniso,
  );
}

function buildLibrary(loader: THREE.TextureLoader, aniso: number): MapBuilt {
  const b: BoxSpec[] = [];
  const W = 40;
  const D = 34;
  const H = 8;
  wall(b, 0, -0.15, 0, W, 0.3, D, "wood");
  wall(b, 0, H / 2, D / 2, W, H, 0.6, "plaster");
  wall(b, 0, H / 2, -D / 2, W, H, 0.6, "plaster");
  wall(b, W / 2, H / 2, 0, 0.6, H, D, "plaster");
  wall(b, -W / 2, H / 2, 0, 0.6, H, D, "plaster");
  wall(b, 0, H + 0.1, 0, W, 0.2, D, "wood");

  const shelf = (x: number, z: number, tall = true) => {
    wall(b, x, tall ? 1.6 : 0.9, z, 1.1, tall ? 3.2 : 1.8, 3.4, "wood");
  };
  for (const z of [-10, -4, 4, 10]) {
    shelf(-8.2, z);
    shelf(8.2, z);
  }
  shelf(-8.2, 0, false);
  shelf(8.2, 0, false);

  wall(b, 0, 3.09, 0, 3.4, 0.3, 12, "wood");
  deco(b, -1.85, 3.7, 0, 0.12, 0.9, 12, "wood");
  deco(b, 1.85, 3.7, 0, 0.12, 0.9, 12, "wood");
  for (let i = 0; i < 9; i++) {
    const h = 0.36 * (i + 1);
    wall(b, 0, h / 2, 12.2 - i * 0.72, 3.4, h, 0.72, "wood");
    wall(b, 0, h / 2, -12.2 + i * 0.72, 3.4, h, 0.72, "wood");
  }

  for (const z of [-8, 0, 8]) {
    deco(b, -4, 0.02, z, 1.4, 0.04, 1.1, "plaster");
    deco(b, 4, 0.02, z, 1.2, 0.04, 0.9, "plaster");
  }

  wall(b, 15.2, 0.7, 4.2, 1.6, 1.4, 1.2, "wood");
  wall(b, -15.2, 0.7, 4.2, 1.6, 1.4, 1.2, "wood");

  const sun = new THREE.DirectionalLight(0xfff1d6, 1.35);
  sun.position.set(6, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 50;
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  const hemi = new THREE.HemisphereLight(0xfff6e8, 0x4a3a28, 1.35);

  return buildFrom(
    b,
    {
      spawnsCT: [
        { x: -2, y: 0, z: 14.4 },
        { x: 0, y: 0, z: 14.8 },
        { x: 2, y: 0, z: 14.4 },
        { x: -1, y: 0, z: 13.2 },
        { x: 1, y: 0, z: 13.2 },
      ],
      spawnsTR: [
        { x: -2, y: 0, z: -14.4 },
        { x: 0, y: 0, z: -14.8 },
        { x: 2, y: 0, z: -14.4 },
        { x: -1, y: 0, z: -13.2 },
        { x: 1, y: 0, z: -13.2 },
      ],
      sites: [
        siteRoom("A", 15.2, 0, 13.2, 18.4, -3.2, 3.2),
        siteRoom("B", -15.2, 0, -18.4, -13.2, -3.2, 3.2),
      ],
      bounds: { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 },
      fog: new THREE.Fog(0xc4b39a, 28, 70),
      hemi,
      sun,
      lamps: [
        { x: -6, y: 6.4, z: -8, c: 0xffe0b0, i: 8 },
        { x: 6, y: 6.4, z: 8, c: 0xffe0b0, i: 8 },
        { x: 0, y: 6.6, z: 0, c: 0xfff4d8, i: 10 },
      ],
    },
    loader,
    aniso,
  );
}

function buildDepot(loader: THREE.TextureLoader, aniso: number): MapBuilt {
  const b: BoxSpec[] = [];
  const W = 44;
  const D = 34;
  const H = 7.2;
  wall(b, 0, -0.15, 0, W, 0.3, D, "concrete");
  wall(b, 0, H + 0.1, 0, W, 0.2, D, "metal");
  wall(b, 0, H / 2, D / 2, W, H, 0.7, "metal");
  wall(b, 0, H / 2, -D / 2, W, H, 0.7, "metal");
  wall(b, W / 2, H / 2, 0, 0.7, H, D, "metal");
  wall(b, -W / 2, H / 2, 0, 0.7, H, D, "metal");

  // spawn wings only — keep the center lane open to mid
  wall(b, -14.2, 1.5, 15.4, 4.6, 3, 3.4, "metal");
  wall(b, 14.2, 1.5, 15.4, 4.6, 3, 3.4, "metal");
  wall(b, -14.2, 1.5, -15.4, 4.6, 3, 3.4, "metal");
  wall(b, 14.2, 1.5, -15.4, 4.6, 3, 3.4, "metal");
  wall(b, -9.2, 0.42, 12.4, 7.4, 0.84, 0.45, "rust");
  wall(b, 9.2, 0.42, 12.4, 7.4, 0.84, 0.45, "rust");
  wall(b, -9.2, 0.42, -12.4, 7.4, 0.84, 0.45, "rust");
  wall(b, 9.2, 0.42, -12.4, 7.4, 0.84, 0.45, "rust");

  // mid crates — sides only, open spine down x=0
  stack(b, 3.4, 1.6, 3);
  stack(b, -3.4, 1.6, 3);
  stack(b, 3.4, -1.8, 2);
  stack(b, -3.4, -1.8, 2);
  crate(b, 6.4, 0.4);
  crate(b, -6.4, 0.4);
  crate(b, 6.2, -3.2, 0.55, 1.3);
  crate(b, -6.2, -3.2, 0.55, 1.3);
  crate(b, 7.4, 3.6, 0.7, 1.4, "rust");
  crate(b, -7.4, 3.6, 0.7, 1.4, "rust");

  // columns
  for (const x of [-12, 12]) {
    for (const z of [-8, 8]) {
      wall(b, x, 3.5, z, 1.1, 7, 1.1, "accent");
    }
  }

  // side rooms with doorways into A/B — pad is empty, cover in corners
  gatedWall(b, 16.5, 0, "z", 10, 3.6, 0.45, "plaster", true);
  gatedWall(b, -16.5, 0, "z", 10, 3.6, 0.45, "plaster", true);
  wall(b, 19.2, 1.6, 5.2, 5, 3.2, 0.4, "plaster");
  wall(b, 19.2, 1.6, -5.2, 5, 3.2, 0.4, "plaster");
  wall(b, -19.2, 1.6, 5.2, 5, 3.2, 0.4, "plaster");
  wall(b, -19.2, 1.6, -5.2, 5, 3.2, 0.4, "plaster");
  crate(b, 20.7, 4.0, 0.5, 0.95, "wood");
  crate(b, 20.7, -4.0, 0.5, 0.95, "wood");
  crate(b, -20.7, 4.0, 0.5, 0.95, "wood");
  crate(b, -20.7, -4.0, 0.5, 0.95, "wood");

  // catwalk
  wall(b, 0, 3.35, 0.2, 18, 0.18, 2.4, "metal");
  wall(b, 0, 4.1, 1.3, 18, 0.7, 0.12, "metal");
  wall(b, 0, 4.1, -0.9, 18, 0.7, 0.12, "metal");
  // stairs west
  for (let i = 0; i < 8; i++) {
    wall(b, -10.6, 0.22 + i * 0.4, -3.2 - i * 0.42, 1.6, 0.2, 0.7, "metal");
  }
  for (let i = 0; i < 8; i++) {
    wall(b, 10.6, 0.22 + i * 0.4, 3.2 + i * 0.42, 1.6, 0.2, 0.7, "metal");
  }

  // low cover mid lanes — gap on the spine
  wall(b, 6.6, 0.48, 8.2, 3.4, 0.96, 0.5, "rust");
  wall(b, -6.6, 0.48, -8.2, 3.4, 0.96, 0.5, "rust");
  wall(b, 10, 0.55, 5, 0.5, 1.1, 3.2, "metal");
  wall(b, -10, 0.55, -5, 0.5, 1.1, 3.2, "metal");

  // hazard spine + office glass + hanging gantry
  deco(b, 0, 0.03, 0, 1.1, 0.04, 28, "accent");
  deco(b, 0, 0.03, 8, 8, 0.04, 0.45, "accent");
  deco(b, 0, 0.03, -8, 8, 0.04, 0.45, "accent");
  wall(b, 16.5, 3.4, 0, 0.12, 2.2, 6.4, "plaster");
  wall(b, -16.5, 3.4, 0, 0.12, 2.2, 6.4, "plaster");
  deco(b, 0, 6.6, 0, 22, 0.12, 0.18, "rust");
  crate(b, 12.4, 8.2, 0.45, 0.9, "metal");
  crate(b, -12.4, -8.2, 0.45, 0.9, "metal");
  crate(b, 12.2, -8.4, 0.7, 1.2, "rust");
  crate(b, -12.2, 8.4, 0.7, 1.2, "rust");
  // site markers — empty plates inside the rooms
  deco(b, 18.5, 0.04, 0, 3.2, 0.05, 3.2, "accent");
  deco(b, -18.5, 0.04, 0, 3.2, 0.05, 3.2, "accent");

  // wall ribs outside the site pads, lane paint, pallets, gantry sign
  for (const x of [21.2, -21.2]) {
    for (const z of [-12, -9.5, -7, -4.75, 4.75, 7, 9.5, 12]) {
      deco(b, x, 3.15, z, 0.08, 5.5, 0.18, "dark");
    }
  }
  deco(b, 2.2, 0.04, 0, 0.22, 0.025, 14.8, "accent");
  deco(b, -2.2, 0.04, 0, 0.22, 0.025, 14.8, "accent");
  deco(b, 7.9, 0.06, 0.45, 1.15, 0.1, 0.9, "wood");
  deco(b, -7.9, 0.06, 0.45, 1.15, 0.1, 0.9, "wood");
  deco(b, 6.3, 0.06, -4.7, 1.2, 0.1, 0.8, "wood");
  deco(b, -6.3, 0.06, -4.7, 1.2, 0.1, 0.8, "wood");
  deco(b, 0, 5.8, 6, 2.4, 0.72, 0.07, "accent");
  deco(b, -1.05, 6.52, 6, 0.05, 1.15, 0.05, "dark");
  deco(b, 1.05, 6.52, 6, 0.05, 1.15, 0.05, "dark");

  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(8, 18, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  const hemi = new THREE.HemisphereLight(0xe8eef8, 0x5a4a38, 1.58);

  const lamps = [];
  for (const x of [-10, 0, 10]) {
    for (const z of [-12, 0, 12]) {
      lamps.push({ x, y: 6.4, z, c: 0xffd090, i: 12.5 });
    }
  }

  return buildFrom(
    b,
    {
      spawnsCT: [
        { x: -3, y: 0, z: 15.6 },
        { x: 0, y: 0, z: 15.8 },
        { x: 3, y: 0, z: 15.6 },
        { x: -1.5, y: 0, z: 14.4 },
        { x: 1.5, y: 0, z: 14.4 },
      ],
      spawnsTR: [
        { x: -3, y: 0, z: -15.6 },
        { x: 0, y: 0, z: -15.8 },
        { x: 3, y: 0, z: -15.6 },
        { x: -1.5, y: 0, z: -14.4 },
        { x: 1.5, y: 0, z: -14.4 },
      ],
      sites: [
        siteRoom("A", 18.5, 0, 17.35, 21.35, -4.4, 4.4),
        siteRoom("B", -18.5, 0, -21.35, -17.35, -4.4, 4.4),
      ],
      bounds: { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 },
      fog: new THREE.Fog(0xd4d8e0, 50, 118),
      hemi,
      sun,
      lamps,
      fluoro: { y: 6.92, zs: [-10, 0, 10], w: 20 },
    },
    loader,
    aniso,
  );
}

function container(list: BoxSpec[], x: number, z: number, layers: number, rot = false) {
  const w = rot ? 2.5 : 6.1;
  const d = rot ? 6.1 : 2.5;
  for (let i = 0; i < layers; i++) {
    list.push({ x, y: 1.3 + i * 2.55, z, w, h: 2.5, d, m: "container" });
  }
}

function buildHarbor(loader: THREE.TextureLoader, aniso: number): MapBuilt {
  const b: BoxSpec[] = [];
  const W = 56;
  const D = 42;
  wall(b, 0, -0.2, 0, W, 0.4, D, "sand");
  wall(b, 0, 4, D / 2, W, 8, 0.8, "metal");
  wall(b, 0, 4, -D / 2, W, 8, 0.8, "metal");
  wall(b, W / 2, 4, 0, 0.8, 8, D, "metal");
  wall(b, -W / 2, 4, 0, 0.8, 8, D, "metal");

  // warehouse shed north — wide center gap so CT spawn sees the yard
  wall(b, -12, 3.2, 16.5, 8, 6.4, 0.5, "metal");
  wall(b, 12, 3.2, 16.5, 8, 6.4, 0.5, "metal");
  wall(b, -11, 3.2, 13, 0.5, 6.4, 7, "metal");
  wall(b, 11, 3.2, 13, 0.5, 6.4, 7, "metal");
  wall(b, 0, 6.4, 13, 22, 0.3, 7, "metal");

  container(b, -8, 0, 2);
  container(b, -8, 4, 1);
  container(b, -8, -4, 3);
  container(b, 8, 0, 2);
  container(b, 8, 4, 3);
  container(b, 8, -4, 1);
  container(b, -16, 2, 2);
  container(b, 16, -2, 2);
  container(b, 16, 2, 3);
  container(b, -16, 8, 2);

  stack(b, 2.4, 1.2, 2);
  stack(b, -2.4, -1.2, 2);
  crate(b, 4, 10, 0.6, 1.2, "wood");
  crate(b, -4, -10, 0.6, 1.2, "wood");
  wall(b, 0, 0.62, 0, 2.6, 1.05, 0.45, "rust");
  wall(b, 12, 0.7, 12, 4, 1.4, 0.5, "rust");
  wall(b, -12, 0.7, -12, 4, 1.4, 0.5, "rust");
  // waist-high mid lanes
  wall(b, 0, 0.52, 3.4, 6.2, 1.05, 0.42, "rust");
  wall(b, 0, 0.52, -3.4, 6.2, 1.05, 0.42, "rust");
  wall(b, 4.2, 0.5, 0, 0.42, 1.0, 5.4, "metal");
  wall(b, -4.2, 0.5, 0, 0.42, 1.0, 5.4, "metal");
  crate(b, 5.2, 7.1, 0.42, 0.82, "rust");
  crate(b, 6.1, 7.4, 0.38, 0.72, "metal");
  crate(b, -5.2, -7.1, 0.42, 0.82, "rust");
  crate(b, -6.0, -7.5, 0.38, 0.72, "metal");
  // cover at site doors — not on the pad
  crate(b, 11.1, 5.8, 0.45, 0.9, "wood");
  crate(b, -11.1, -5.8, 0.45, 0.9, "wood");
  // close north shed south wall with a wide door
  gatedWall(b, 0, 9.6, "x", 22, 6.4, 0.45, "metal", true);

  // site sheds — empty pads, door toward mid
  hollowHouse(b, 16, 8, 8, 8, 1, ["w"], "metal", { crate: false });
  hollowHouse(b, -16, -8, 8, 8, 1, ["e"], "metal", { crate: false });
  crate(b, 18.7, 10.7, 0.5, 0.9, "wood");
  crate(b, -18.7, -10.7, 0.5, 0.9, "wood");

  // crane + barrels + dock stripe
  wall(b, 22, 6.2, -14, 0.7, 12.4, 0.7, "metal");
  wall(b, 22, 6.2, -9.2, 0.7, 12.4, 0.7, "metal");
  wall(b, 22, 12.4, -11.6, 0.55, 0.55, 9.2, "rust");
  wall(b, 18.4, 12.1, -11.6, 7.4, 0.35, 0.45, "rust");
  crate(b, 4.8, 14.2, 0.45, 0.85, "rust");
  crate(b, -5.2, -14.2, 0.45, 0.85, "metal");
  deco(b, 0, 0.05, 0, 2.2, 0.04, 36, "accent");
  deco(b, 16, 0.05, 8, 4, 0.05, 4, "accent");
  deco(b, -16, 0.05, -8, 4, 0.05, 4, "accent");

  // bollards, dock stripe, container doors, crane board — non-colliding
  for (const x of [6, -6]) {
    for (const z of [-12, -6, 6, 12]) {
      deco(b, x, 0.35, z, 0.25, 0.7, 0.25, "accent");
    }
  }
  deco(b, 0, 0.06, 6, 10, 0.02, 0.38, "dark");
  deco(b, -8, 1.3, 1.3, 2.2, 1.6, 0.06, "rust");
  deco(b, 8, 1.3, 1.3, 2.2, 1.6, 0.06, "rust");
  deco(b, 21.55, 8, -11, 0.06, 0.85, 1.45, "accent");

  const sun = new THREE.DirectionalLight(0xffd2a8, 2.25);
  sun.position.set(-12, 22, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.camera.far = 70;
  const hemi = new THREE.HemisphereLight(0xffe2c4, 0x5a3824, 1.48);
  const lamps = [];
  for (const x of [-12, 0, 12]) {
    for (const z of [-10, 4, 16]) {
      lamps.push({ x, y: 7.2, z, c: 0xffc070, i: 10 });
    }
  }

  return buildFrom(
    b,
    {
      spawnsCT: [
        { x: -3, y: 0, z: 18.2 },
        { x: 0, y: 0, z: 18.4 },
        { x: 3, y: 0, z: 18.2 },
        { x: -1.6, y: 0, z: 16.6 },
        { x: 1.6, y: 0, z: 16.6 },
      ],
      spawnsTR: [
        { x: -3, y: 0, z: -18.2 },
        { x: 0, y: 0, z: -18.4 },
        { x: 3, y: 0, z: -18.2 },
        { x: -1.6, y: 0, z: -16.6 },
        { x: 1.6, y: 0, z: -16.6 },
      ],
      sites: [
        siteRoom("A", 16, 8, 13.05, 19.45, 4.7, 11.3),
        siteRoom("B", -16, -8, -19.45, -13.05, -11.3, -4.7),
      ],
      bounds: { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 },
      fog: new THREE.Fog(0xdcc49a, 54, 124),
      hemi,
      sun,
      lamps,
      fluoro: { y: 7.85, zs: [-12, 2, 14], w: 24 },
    },
    loader,
    aniso,
  );
}

function buildBazaar(loader: THREE.TextureLoader, aniso: number): MapBuilt {
  const b: BoxSpec[] = [];
  const W = 42;
  const D = 38;
  wall(b, 0, -0.15, 0, W, 0.3, D, "concrete");
  wall(b, 0, 4, D / 2, W, 8, 0.7, "brick");
  wall(b, 0, 4, -D / 2, W, 8, 0.7, "brick");
  wall(b, W / 2, 4, 0, 0.7, 8, D, "brick");
  wall(b, -W / 2, 4, 0, 0.7, 8, D, "brick");

  hollowHouse(b, -12, -10, 10, 8, 2, ["n", "e"], "brick", { crate: false });
  hollowHouse(b, 12, -10, 10, 8, 2, ["n", "w"], "brick");
  hollowHouse(b, -12, 10, 10, 8, 2, ["s", "e"], "brick");
  hollowHouse(b, 12, 10, 10, 8, 2, ["s", "w"], "brick", { crate: false });

  // stalls along street
  for (const x of [-6, -2, 2, 6]) {
    wall(b, x, 0.7, 0, 1.8, 1.4, 1.2, "wood");
    wall(b, x, 1.5, 0.1, 1.9, 0.12, 1.4, "accent");
  }
  for (const z of [-4, 4]) {
    wall(b, 3.4, 0.65, z, 1.4, 1.3, 2.2, "wood");
  }

  crate(b, 4.5, 3.2);
  crate(b, -4.5, -3.2);
  stack(b, 7.5, 0, 2);
  stack(b, -7.5, 0, 2);
  wall(b, 0, 0.55, 8.5, 5, 1.1, 0.45, "rust");
  wall(b, 0, 0.55, -8.5, 5, 1.1, 0.45, "rust");

  // mid arches + carpets + extra stalls
  wall(b, -3.6, 1.35, 6.4, 0.45, 2.7, 0.45, "brick");
  wall(b, 3.6, 1.35, 6.4, 0.45, 2.7, 0.45, "brick");
  wall(b, 0, 2.75, 6.4, 7.6, 0.4, 0.45, "plaster");
  wall(b, -3.6, 1.35, -6.4, 0.45, 2.7, 0.45, "brick");
  wall(b, 3.6, 1.35, -6.4, 0.45, 2.7, 0.45, "brick");
  wall(b, 0, 2.75, -6.4, 7.6, 0.4, 0.45, "plaster");
  deco(b, 0, 0.04, 0, 5.4, 0.05, 12, "accent");
  deco(b, 12, 0.04, 10, 3.2, 0.05, 3.2, "sand");
  deco(b, -12, 0.04, -10, 3.2, 0.05, 3.2, "sand");
  crate(b, 15.3, 12.3, 0.5, 0.95, "wood");
  crate(b, -15.3, -12.3, 0.5, 0.95, "wood");
  crate(b, 8.4, 4.2, 0.4, 0.8, "wood");
  crate(b, -8.4, -4.2, 0.4, 0.8, "wood");

  // stairs onto north-west roof
  for (let i = 0; i < 14; i++) {
    wall(b, -6.85, 0.18 + i * 0.4, 14.15 - i * 0.08, 1.45, 0.18, 0.65, "plaster");
  }

  // Side-stall awnings only (z = ±4). The z = 0 stall row already has roofs.
  for (const z of [-4, 4]) {
    for (const x of [-8, 3.4, 8]) {
      deco(b, x, 2.15, z, 2.2, 0.08, 1.1, "accent");
    }
  }
  // Lanterns just outside the arch posts at (±3.6, ±6.4).
  for (const x of [-5.2, 5.2]) {
    for (const z of [-6.4, 6.4]) {
      deco(b, x, 3.29, z, 0.06, 0.7, 0.06, "dark");
      deco(b, x, 2.8, z, 0.28, 0.28, 0.28, "accent");
    }
  }
  // Open-market rugs, off the stall row and the crates at (±4.5, ±3.2).
  deco(b, -5, 0.05, 2, 2.4, 0.04, 1.6, "sand");
  deco(b, 5, 0.05, -2, 2.4, 0.04, 1.6, "sand");
  // Street windows: NW house (-12, 10) and SE house (12, -10) only. Site houses skipped.
  deco(b, -7, 1.6, 8.5, 0.08, 0.9, 0.7, "dark");
  deco(b, -7, 1.6, 11.5, 0.08, 0.9, 0.7, "dark");
  deco(b, 7, 1.6, -11.5, 0.08, 0.9, 0.7, "dark");
  deco(b, 7, 1.6, -8.5, 0.08, 0.9, 0.7, "dark");
  // Market sign over the crossing, above head height. Pole runs from y=1.6 up to the board.
  deco(b, 0, 3.4, 0, 1.6, 0.5, 0.08, "accent");
  deco(b, 0, 2.375, 0, 0.08, 1.55, 0.08, "dark");

  const sun = new THREE.DirectionalLight(0xc8d4f0, 1.42);
  sun.position.set(4, 18, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const hemi = new THREE.HemisphereLight(0x8899cc, 0x3a2418, 1.28);
  const lamps = [];
  for (const x of [-8, 0, 8]) {
    for (const z of [-8, 0, 8]) {
      lamps.push({ x, y: 3.6, z, c: 0xff9944, i: 7.6 });
    }
  }

  return buildFrom(
    b,
    {
      spawnsCT: [
        { x: -2, y: 0, z: 16.8 },
        { x: 0, y: 0, z: 17 },
        { x: 2, y: 0, z: 16.8 },
        { x: -3.2, y: 0, z: 15.4 },
        { x: 3.2, y: 0, z: 15.4 },
      ],
      spawnsTR: [
        { x: -2, y: 0, z: -16.8 },
        { x: 0, y: 0, z: -17 },
        { x: 2, y: 0, z: -16.8 },
        { x: -3.2, y: 0, z: -15.4 },
        { x: 3.2, y: 0, z: -15.4 },
      ],
      sites: [
        siteRoom("A", 12, 10, 8.35, 16.35, 7.25, 13.35),
        siteRoom("B", -12, -10, -16.35, -8.35, -13.35, -7.25),
      ],
      bounds: { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 },
      fog: new THREE.Fog(0x2a3144, 34, 88),
      hemi,
      sun,
      lamps,
    },
    loader,
    aniso,
  );
}

export function createSoldier(team: Team): THREE.Group {
  const g = new THREE.Group();
  const ct = team === "CT";
  const cloth = new THREE.Color(ct ? 0x1a3558 : 0x3d2a18);
  const pants = new THREE.Color(ct ? 0x15283f : 0x2a2214);
  const vest = new THREE.Color(ct ? 0x2e6bb0 : 0xa33a28);
  const skin = new THREE.Color(0xc4a07a);
  const dark = new THREE.Color(0x121418);
  const helmC = ct ? 0x1c2c44 : 0x2a1c14;
  const visorC = ct ? 0x3ad0ff : 0xff4a2a;

  const bones: THREE.Bone[] = [];
  const bone = (name: string, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    parent.add(b);
    bones.push(b);
    return b;
  };
  const hips = bone("hips", g, 0, 0.92, 0);
  const legL = bone("legL", hips, -0.1, 0, 0);
  const shinL = bone("shinL", legL, 0, -0.42, 0);
  const legR = bone("legR", hips, 0.1, 0, 0);
  const shinR = bone("shinR", legR, 0, -0.42, 0);
  const spine = bone("spine", hips, 0, 0.16, 0);
  const chest = bone("body", spine, 0, 0.28, 0);
  const head = bone("head", chest, 0, 0.28, 0);
  const armL = bone("armL", chest, -0.22, 0.08, 0.02);
  armL.rotation.x = -1.05;
  const foreL = bone("foreL", armL, 0, -0.28, 0);
  const armR = bone("armR", chest, 0.22, 0.08, 0.04);
  armR.rotation.x = -1.15;
  const foreR = bone("foreR", armR, 0, -0.26, 0);
  hips.updateMatrixWorld(true);

  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const skinI: number[] = [];
  const skinW: number[] = [];
  const idx: number[] = [];
  let base = 0;
  const v = new THREE.Vector3();
  const nn = new THREE.Vector3();
  const push = (src: THREE.BufferGeometry, boneIndex: number, color: THREE.Color, matrix: THREE.Matrix4) => {
    const p = src.getAttribute("position");
    const n = src.getAttribute("normal");
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const start = base;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p as THREE.BufferAttribute, i).applyMatrix4(matrix);
      nn.fromBufferAttribute(n as THREE.BufferAttribute, i).applyMatrix3(nm).normalize();
      pos.push(v.x, v.y, v.z);
      nor.push(nn.x, nn.y, nn.z);
      col.push(color.r, color.g, color.b);
      skinI.push(boneIndex, 0, 0, 0);
      skinW.push(1, 0, 0, 0);
    }
    const index = src.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i++) idx.push(start + index.getX(i));
    } else {
      for (let i = 0; i < p.count; i++) idx.push(start + i);
    }
    base += p.count;
    src.dispose();
  };
  const limb = (b: THREE.Bone, r0: number, r1: number, len: number, color: THREE.Color) => {
    const geo = new THREE.CylinderGeometry(r0, r1, len, 8);
    geo.translate(0, -len / 2, 0);
    push(geo, bones.indexOf(b), color, b.matrixWorld);
  };
  limb(legL, 0.07, 0.06, 0.42, pants);
  limb(shinL, 0.055, 0.05, 0.4, pants);
  limb(legR, 0.07, 0.06, 0.42, pants);
  limb(shinR, 0.055, 0.05, 0.4, pants);
  const pelvis = new THREE.SphereGeometry(0.12, 8, 6);
  push(pelvis, bones.indexOf(hips), cloth, hips.matrixWorld);
  const torso = new THREE.CylinderGeometry(0.16, 0.14, 0.28, 8);
  torso.translate(0, 0.14, 0);
  push(torso, bones.indexOf(spine), vest, spine.matrixWorld);
  const chestGeo = new THREE.BoxGeometry(0.36, 0.28, 0.2);
  chestGeo.translate(0, 0.08, 0.02);
  push(chestGeo, bones.indexOf(chest), vest, chest.matrixWorld);
  const skull = new THREE.SphereGeometry(0.12, 10, 8);
  skull.translate(0, 0.06, 0);
  push(skull, bones.indexOf(head), skin, head.matrixWorld);
  limb(armL, 0.055, 0.045, 0.28, cloth);
  limb(foreL, 0.045, 0.04, 0.24, cloth);
  limb(armR, 0.055, 0.045, 0.28, cloth);
  limb(foreR, 0.045, 0.04, 0.24, cloth);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinI, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinW, 4));
  geo.setIndex(idx);
  const mesh = new THREE.SkinnedMesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  mesh.name = "skin";
  mesh.frustumCulled = false;
  mesh.add(hips);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  g.add(mesh);

  const lamb = (c: number, em = 0) =>
    new THREE.MeshLambertMaterial({ color: c, emissive: em ? c : 0x000000, emissiveIntensity: em });
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.32), lamb(helmC));
  helm.position.set(0, 0.14, 0.02);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.06), lamb(visorC, 0.45));
  visor.position.set(0, 0.05, 0.12);
  head.add(helm, visor);
  const boot = (parent: THREE.Bone, x: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.16), lamb(0x121418));
    m.position.set(x, -0.4, 0.03);
    parent.add(m);
  };
  boot(shinL, 0);
  boot(shinR, 0);

  const mount = new THREE.Group();
  mount.name = "gunMount";
  mount.position.set(0.2, 1.16, 0.34);
  g.add(mount);
  return g;
}

export const TEAM_COLOR = { CT: 0x4aa3ff, TR: 0xff4a4a };
