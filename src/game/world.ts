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
  concrete: "/game/concrete.jpg",
  metal: "/game/metal.jpg",
  wood: "/game/wood.jpg",
  brick: "/game/brick.jpg",
  container: "/game/container.jpg",
  sand: "/game/sand.jpg",
  plaster: "/game/plaster.jpg",
  rust: "/game/rust.jpg",
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
      uv.setXY(i, uv.getX(i) * rx, uv.getY(i) * ry);
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
  return buildDepot(loader, aniso);
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
  const cloth = ct ? 0x1a3558 : 0x3d2a18;
  const pants = ct ? 0x15283f : 0x2a2214;
  const vest = ct ? 0x2e6bb0 : 0xa33a28;
  const skin = 0xc4a07a;
  const dark = 0x121418;
  const helmC = ct ? 0x1c2c44 : 0x2a1c14;
  const visorC = ct ? 0x3ad0ff : 0xff4a2a;
  const lamb = (c: number, em = 0) =>
    new THREE.MeshLambertMaterial({ color: c, emissive: em ? c : 0x000000, emissiveIntensity: em });
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, name?: string) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (name) m.name = name;
    g.add(m);
    return m;
  };
  const mCloth = lamb(cloth);
  const mPants = lamb(pants);
  const mVest = lamb(vest, 0.12);
  const mSkin = lamb(skin);
  const mDark = lamb(dark);
  const mHelm = lamb(helmC);
  const mVisor = lamb(visorC, 0.35);

  box(0.4, 0.22, 0.26, mPants, 0, 0.92, 0);
  box(0.46, 0.54, 0.3, mVest, 0, 1.3, 0, "body");
  box(0.18, 0.16, 0.08, mVest, 0.14, 1.28, 0.18);
  box(0.18, 0.16, 0.08, mVest, -0.14, 1.28, 0.18);
  box(0.12, 0.1, 0.08, mVest, 0, 1.12, 0.16);
  box(0.32, 0.42, 0.16, mDark, 0, 1.28, -0.22);
  box(0.22, 0.12, 0.22, mCloth, 0, 1.52, 0);
  const head = box(0.26, 0.28, 0.26, mSkin, 0, 1.7, 0, "head");
  void head;
  box(0.32, 0.14, 0.34, mHelm, 0, 1.84, 0.02);
  box(0.24, 0.07, 0.08, mVisor, 0, 1.72, 0.14);
  if (!ct) box(0.3, 0.08, 0.08, lamb(0x6a2018), 0, 1.62, 0.08);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.48, 0.13), mCloth);
  armL.position.set(-0.3, 1.28, 0.06);
  armL.rotation.x = -1.05;
  armL.name = "armL";
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.48, 0.13), mCloth);
  armR.position.set(0.3, 1.28, 0.06);
  armR.rotation.x = -1.12;
  armR.name = "armR";
  g.add(armL, armR);
  box(0.12, 0.1, 0.12, mSkin, -0.3, 1.02, 0.28);
  box(0.12, 0.1, 0.12, mSkin, 0.3, 1.02, 0.28);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.17), mPants);
  legL.position.set(-0.12, 0.38, 0);
  legL.name = "legL";
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.17), mPants);
  legR.position.set(0.12, 0.38, 0);
  legR.name = "legR";
  g.add(legL, legR);
  box(0.16, 0.12, 0.26, mDark, -0.12, 0.06, 0.05);
  box(0.16, 0.12, 0.26, mDark, 0.12, 0.06, 0.05);
  box(0.16, 0.1, 0.16, mDark, -0.12, 0.55, 0.08);
  box(0.16, 0.1, 0.16, mDark, 0.12, 0.55, 0.08);

  const mount = new THREE.Group();
  mount.name = "gunMount";
  mount.position.set(0.2, 1.16, 0.34);
  g.add(mount);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return g;
}

export const TEAM_COLOR = { CT: 0x4aa3ff, TR: 0xff4a4a };
