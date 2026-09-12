import * as THREE from "three";
import type { WeaponId } from "./types";
import { WEAPONS } from "./weapons";

const gunMetal = (c = 0x8a9098) => new THREE.MeshLambertMaterial({ color: c });
const wood = () => new THREE.MeshLambertMaterial({ color: 0x8a5a32 });
const black = () => new THREE.MeshLambertMaterial({ color: 0x2a2c32 });
const accent = () => new THREE.MeshLambertMaterial({ color: 0xff6a00 });

function box(
  g: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  name?: string,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (name) m.name = name;
  g.add(m);
  return m;
}
function cyl(
  g: THREE.Object3D,
  r: number,
  h: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  rx = 0,
  name?: string,
) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  if (name) m.name = name;
  g.add(m);
  return m;
}

function addOptic(g: THREE.Object3D, x: number, y: number, z: number, dk: THREE.Material) {
  const optic = new THREE.Group();
  optic.name = "optic";
  optic.position.set(x, y, z);
  box(optic, 0.034, 0.028, 0.055, 0, 0, 0, dk);
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.012, 10),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.55 }),
  );
  glass.rotation.x = Math.PI / 2;
  glass.position.set(0, 0.002, -0.018);
  optic.add(glass);
  g.add(optic);
}

function addLaser(g: THREE.Object3D, x: number, y: number, z: number, dk: THREE.Material) {
  const laser = new THREE.Group();
  laser.name = "laser";
  laser.position.set(x, y, z);
  box(laser, 0.016, 0.016, 0.05, 0, 0, 0, dk);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(0.0035, 0.0035, 0.38),
    new THREE.MeshBasicMaterial({ color: 0xff2424, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  beam.name = "beam";
  beam.position.set(0, 0, -0.24);
  laser.add(beam);
  g.add(laser);
}

function addMuzzle(g: THREE.Object3D, z: number) {
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0, depthWrite: false }),
  );
  flash.name = "muzzle";
  flash.position.set(0, 0.02, z);
  g.add(flash);
}

function addHands(g: THREE.Group, style: WeaponId) {
  const skin = new THREE.MeshLambertMaterial({ color: 0xc4a07a });
  const sleeve = new THREE.MeshLambertMaterial({ color: 0x1a3558 });
  const glove = new THREE.MeshLambertMaterial({ color: 0x2a2e36 });
  const handR = new THREE.Group();
  handR.name = "handR";
  box(handR, 0.055, 0.055, 0.08, 0.07, -0.1, 0.08, skin);
  box(handR, 0.07, 0.16, 0.07, 0.085, -0.2, 0.1, sleeve);
  box(handR, 0.03, 0.04, 0.05, 0.05, -0.08, 0.02, glove);
  g.add(handR);
  const handL = new THREE.Group();
  handL.name = "handL";
  const lx = style === "d50" || style === "g18c" || style === "knife" ? -0.02 : -0.06;
  const ly = style === "m870" ? -0.04 : -0.08;
  const lz = style === "m870" ? -0.16 : style === "sr98" ? -0.1 : 0.1;
  box(handL, 0.05, 0.05, 0.07, lx, ly, lz, skin);
  box(handL, 0.06, 0.12, 0.06, lx - 0.01, ly - 0.08, lz + 0.02, sleeve);
  g.add(handL);
}

function buildCar15(body: THREE.Group, ext: boolean, rd: boolean, lsr: boolean) {
  const gm = gunMetal(0x7a8088);
  const dk = black();
  const rail = gunMetal(0x3a3e46);
  box(body, 0.07, 0.085, 0.42, 0, 0.01, 0.02, gm);
  box(body, 0.06, 0.05, 0.22, 0, 0.06, -0.04, rail);
  cyl(body, 0.016, 0.42, 0, 0.02, -0.38, dk, Math.PI / 2);
  cyl(body, 0.022, 0.04, 0, 0.02, -0.6, dk, Math.PI / 2);
  box(body, 0.045, 0.12, 0.07, 0, -0.08, 0.1, dk);
  box(body, 0.038, 0.15, 0.05, 0, -0.16, 0.04, dk);
  box(body, 0.055, 0.07, 0.2, 0, 0.02, 0.3, gm);
  box(body, 0.02, 0.045, 0.16, 0, 0.04, 0.42, dk);
  const magH = ext ? 0.22 : 0.16;
  box(body, 0.04, magH, 0.07, 0, -0.1 - magH * 0.15, 0.05, dk, "mag");
  box(body, 0.03, 0.018, 0.08, 0.04, 0.05, 0.06, dk, "bolt");
  box(body, 0.03, 0.09, 0.03, 0, -0.02, -0.18, dk);
  if (rd) addOptic(body, 0, 0.1, -0.02, dk);
  else box(body, 0.05, 0.05, 0.08, 0, 0.1, 0.08, dk);
  if (lsr) addLaser(body, 0, -0.04, -0.22, dk);
  addMuzzle(body, -0.62);
}

function buildAk74(body: THREE.Group, ext: boolean, rd: boolean, lsr: boolean) {
  const gm = gunMetal(0x6a6e72);
  const dk = black();
  const wd = wood();
  const magC = gunMetal(0x4a3a28);
  box(body, 0.078, 0.09, 0.4, 0, 0.01, 0.02, gm);
  cyl(body, 0.018, 0.36, 0, 0.025, -0.36, dk, Math.PI / 2);
  box(body, 0.07, 0.045, 0.18, 0, 0.055, -0.16, wd);
  box(body, 0.05, 0.04, 0.16, 0, 0.08, -0.14, gm);
  cyl(body, 0.028, 0.05, 0, 0.025, -0.56, dk, Math.PI / 2);
  box(body, 0.05, 0.16, 0.05, 0, -0.12, 0.04, wd);
  box(body, 0.07, 0.08, 0.22, 0, 0.01, 0.3, wd);
  const mag = box(body, 0.045, ext ? 0.24 : 0.18, 0.08, 0, -0.16, 0.05, magC, "mag");
  mag.rotation.z = 0.22;
  mag.rotation.x = 0.18;
  box(body, 0.025, 0.02, 0.1, 0.045, 0.05, 0.04, dk, "bolt");
  if (rd) addOptic(body, 0, 0.11, 0.02, dk);
  if (lsr) addLaser(body, 0, -0.035, -0.2, dk);
  addMuzzle(body, -0.58);
}

function buildMp5(body: THREE.Group, ext: boolean, rd: boolean, lsr: boolean) {
  const gm = gunMetal(0x4a5060);
  const dk = black();
  box(body, 0.065, 0.08, 0.3, 0, 0.01, 0.02, gm);
  cyl(body, 0.02, 0.26, 0, 0.015, -0.26, dk, Math.PI / 2);
  box(body, 0.05, 0.06, 0.16, 0, 0.0, 0.22, gm);
  box(body, 0.018, 0.04, 0.12, 0, 0.03, 0.34, dk);
  box(body, 0.038, 0.12, 0.045, 0, -0.09, 0.06, dk);
  const magH = ext ? 0.2 : 0.14;
  box(body, 0.032, magH, 0.055, 0, -0.1 - magH * 0.1, 0.04, gm, "mag");
  box(body, 0.028, 0.016, 0.07, 0.038, 0.045, 0.0, dk, "bolt");
  if (rd) addOptic(body, 0, 0.085, 0.0, dk);
  if (lsr) addLaser(body, 0, -0.03, -0.14, dk);
  addMuzzle(body, -0.42);
}

function buildSr98(body: THREE.Group, _ext: boolean, _rd: boolean, lsr: boolean) {
  const gm = gunMetal(0x6a7078);
  const dk = black();
  const wd = wood();
  box(body, 0.065, 0.07, 0.52, 0, 0.01, 0.02, gm);
  cyl(body, 0.014, 0.62, 0, 0.015, -0.5, dk, Math.PI / 2);
  box(body, 0.08, 0.07, 0.24, 0, 0.0, 0.34, wd);
  box(body, 0.04, 0.14, 0.045, 0, -0.1, 0.1, dk);
  box(body, 0.05, 0.08, 0.08, 0, -0.08, 0.04, dk, "mag");
  const bolt = box(body, 0.016, 0.016, 0.12, 0.05, 0.04, 0.02, gm, "bolt");
  bolt.rotation.z = 0.2;
  const optic = new THREE.Group();
  optic.name = "optic";
  optic.position.set(0, 0.1, 0.02);
  cyl(optic, 0.022, 0.16, 0, 0, 0, dk, Math.PI / 2);
  cyl(optic, 0.028, 0.04, 0, 0, -0.08, dk, Math.PI / 2);
  cyl(optic, 0.028, 0.04, 0, 0, 0.08, dk, Math.PI / 2);
  body.add(optic);
  box(body, 0.01, 0.08, 0.01, -0.03, -0.06, -0.28, dk);
  box(body, 0.01, 0.08, 0.01, 0.03, -0.06, -0.28, dk);
  if (lsr) addLaser(body, 0, -0.03, -0.18, dk);
  addMuzzle(body, -0.82);
}

function buildM870(body: THREE.Group, ext: boolean, rd: boolean, lsr: boolean) {
  const gm = gunMetal(0x8a9098);
  const dk = black();
  const wd = wood();
  box(body, 0.065, 0.07, 0.4, 0, 0.02, 0.04, gm);
  cyl(body, 0.016, 0.44, 0, 0.03, -0.36, dk, Math.PI / 2);
  cyl(body, 0.014, ext ? 0.36 : 0.26, 0, -0.02, -0.2, dk, Math.PI / 2);
  box(body, 0.055, 0.06, 0.2, 0, 0.0, 0.3, wd);
  box(body, 0.04, 0.14, 0.045, 0, -0.1, 0.08, dk);
  const pump = box(body, 0.05, 0.05, 0.14, 0, -0.02, -0.16, wd, "pump");
  void pump;
  box(body, 0.03, 0.03, 0.08, 0, -0.04, 0.12, dk, "mag");
  if (rd) addOptic(body, 0, 0.09, 0.04, dk);
  if (lsr) addLaser(body, 0, -0.05, -0.08, dk);
  addMuzzle(body, -0.6);
}

function buildD50(body: THREE.Group, _ext: boolean, rd: boolean, lsr: boolean) {
  const gm = gunMetal(0x5a5e66);
  const dk = black();
  const slide = box(body, 0.055, 0.055, 0.24, 0, 0.045, -0.02, gm, "slide");
  void slide;
  cyl(body, 0.018, 0.14, 0, 0.04, -0.18, dk, Math.PI / 2);
  box(body, 0.05, 0.14, 0.055, 0, -0.06, 0.06, dk);
  box(body, 0.04, 0.1, 0.035, 0, -0.04, 0.04, gm, "mag");
  if (rd) addOptic(body, 0, 0.09, 0.0, dk);
  if (lsr) addLaser(body, 0, -0.02, -0.08, dk);
  addMuzzle(body, -0.28);
}

function buildG18(body: THREE.Group, ext: boolean, rd: boolean, lsr: boolean) {
  const gm = gunMetal(0x3a3e46);
  const dk = black();
  box(body, 0.045, 0.045, 0.18, 0, 0.04, 0.0, gm, "slide");
  cyl(body, 0.012, 0.1, 0, 0.038, -0.12, dk, Math.PI / 2);
  box(body, 0.04, 0.12, 0.045, 0, -0.05, 0.04, dk);
  const magH = ext ? 0.16 : 0.1;
  box(body, 0.032, magH, 0.04, 0, -0.08 - (ext ? 0.03 : 0), 0.04, gm, "mag");
  if (rd) addOptic(body, 0, 0.08, 0.0, dk);
  if (lsr) addLaser(body, 0, -0.015, -0.06, dk);
  addMuzzle(body, -0.18);
}

function buildKnife(body: THREE.Group) {
  const dk = black();
  const blade = gunMetal(0xc8d0dc);
  const wd = wood();
  box(body, 0.035, 0.035, 0.1, 0, -0.02, 0.08, wd);
  const ring = cyl(body, 0.028, 0.012, 0, -0.02, 0.14, dk, Math.PI / 2);
  void ring;
  const b = box(body, 0.018, 0.008, 0.22, 0, 0.01, -0.08, blade);
  b.rotation.z = 0.35;
  addMuzzle(body, -0.12);
}

function buildNade(body: THREE.Group, id: WeaponId) {
  const col = id === "he" ? 0x3a4a28 : id === "flash" ? 0xc8c4a8 : 0x6a6a62;
  const sph = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), gunMetal(col));
  sph.position.set(0, 0, -0.04);
  body.add(sph);
  box(body, 0.02, 0.08, 0.02, 0.04, 0.04, 0, black());
  addMuzzle(body, -0.12);
}

export function createViewmodel(id: WeaponId, world = false): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  g.add(body);
  const kits = WEAPONS[id]?.kits ?? [];
  const ext = kits.includes("ext");
  const rd = kits.includes("rd");
  const lsr = kits.includes("lsr");
  if (id === "car15") buildCar15(body, ext, rd, lsr);
  else if (id === "ak74") buildAk74(body, ext, rd, lsr);
  else if (id === "mp5n") buildMp5(body, ext, rd, lsr);
  else if (id === "sr98") buildSr98(body, ext, rd, lsr);
  else if (id === "m870") buildM870(body, ext, rd, lsr);
  else if (id === "d50") buildD50(body, ext, rd, lsr);
  else if (id === "g18c") buildG18(body, ext, rd, lsr);
  else if (id === "knife") buildKnife(body);
  else buildNade(body, id);
  if (!world) addHands(g, id);
  g.userData.style = WEAPONS[id]?.reloadStyle ?? "none";
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.frustumCulled = false;
  });
  return g;
}

export function createWorldGun(id: WeaponId): THREE.Group {
  const g = createViewmodel(id, true);
  g.scale.setScalar(0.58);
  g.rotation.set(0.15, Math.PI, 0);
  return g;
}

export type VmPose = {
  reload: number;
  kick: number;
  cycle: number;
  ads: number;
  empty: boolean;
};

type Rest = { px: number; py: number; pz: number; rx: number; ry: number; rz: number };

function cacheRest(root: THREE.Group) {
  if (root.userData.rest) return;
  const rest: Record<string, Rest> = {};
  root.traverse((o) => {
    if (!o.name) return;
    rest[o.name] = {
      px: o.position.x,
      py: o.position.y,
      pz: o.position.z,
      rx: o.rotation.x,
      ry: o.rotation.y,
      rz: o.rotation.z,
    };
  });
  root.userData.rest = rest;
}

function applyNamed(
  root: THREE.Group,
  name: string,
  fn: (o: THREE.Object3D, r: Rest) => void,
) {
  const rest = root.userData.rest as Record<string, Rest>;
  const o = root.getObjectByName(name);
  const r = rest?.[name];
  if (!o || !r) return;
  o.position.set(r.px, r.py, r.pz);
  o.rotation.set(r.rx, r.ry, r.rz);
  fn(o, r);
}

export function poseViewmodel(root: THREE.Group, p: VmPose): void {
  cacheRest(root);
  const style = (root.userData.style as string) || "mag";
  const rel = Math.max(0, Math.min(1, p.reload));
  const cyc = Math.max(0, Math.min(1, p.cycle));
  const kick = Math.max(0, p.kick);

  applyNamed(root, "body", (o) => {
    o.rotation.x -= kick * 0.12;
    o.position.z += kick * 0.03;
    if (style === "tube" && rel > 0) o.rotation.z += Math.sin(rel * Math.PI) * 0.18;
  });

  applyNamed(root, "mag", (o) => {
    o.visible = true;
    if (rel <= 0) return;
    if (rel < 0.32) {
      const t = rel / 0.32;
      o.position.y -= t * 0.22;
      o.position.z += t * 0.08;
      o.rotation.x += t * 0.6;
    } else if (rel < 0.48) {
      o.position.y -= 0.32;
      o.visible = rel < 0.4;
    } else if (rel < 0.78) {
      const t = (rel - 0.48) / 0.3;
      o.visible = true;
      o.position.y -= (1 - t) * 0.22;
      o.rotation.x += (1 - t) * 0.4;
    }
  });

  applyNamed(root, "bolt", (o) => {
    const rack = rel > 0.78 ? (rel - 0.78) / 0.22 : 0;
    const pull = rack < 0.5 ? rack * 2 : (1 - rack) * 2;
    const cycPull = style === "bolt" ? (cyc < 0.5 ? cyc * 2 : (1 - cyc) * 2) : cyc * 0.25 * (1 - rel);
    o.position.z += Math.max(pull, cycPull) * 0.09;
    if (style === "bolt") o.rotation.z += Math.min(cyc, 1 - cyc) * 0.8;
  });

  applyNamed(root, "slide", (o) => {
    if (p.empty && rel <= 0) o.position.z += 0.055;
    else if (rel > 0.75) o.position.z += (1 - (rel - 0.75) / 0.25) * 0.055;
    else if (cyc > 0) o.position.z += (cyc < 0.45 ? cyc / 0.45 : 1 - (cyc - 0.45) / 0.55) * 0.04;
    o.position.z += kick * 0.02;
  });

  applyNamed(root, "pump", (o) => {
    const src = rel > 0 ? rel : cyc;
    const t = src < 0.5 ? src * 2 : (1 - src) * 2;
    o.position.z += t * 0.1;
  });

  applyNamed(root, "handL", (o) => {
    if (rel > 0.05 && rel < 0.78) {
      o.position.y -= Math.sin(Math.min(1, rel / 0.5) * Math.PI) * 0.12;
      o.position.z += 0.06;
    } else if (rel >= 0.78) {
      o.position.z += 0.04;
      o.position.y += 0.02;
    } else if (cyc > 0.05 && style === "tube") {
      o.position.z += Math.sin(cyc * Math.PI) * 0.08;
    }
  });

  const beam = root.getObjectByName("beam");
  if (beam) beam.visible = p.ads < 0.4 && rel < 0.05;
}

export type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  r: number;
  g: number;
  b: number;
};

export function createParticleSystem(max = 220) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const sizes = new Float32Array(max);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  const mat = new THREE.PointsMaterial({
    size: 0.08,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const pool: Particle[] = [];
  function spawn(p: Partial<Particle> & Pick<Particle, "x" | "y" | "z">) {
    if (pool.length >= max) pool.shift();
    pool.push({
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0.35,
      max: 0.35,
      size: 0.08,
      r: 1,
      g: 0.5,
      b: 0.2,
      ...p,
    });
  }
  function update(dt: number) {
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        pool.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 6 * dt;
    }
    pos.fill(0);
    col.fill(0);
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i]!;
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
      const a = p.life / p.max;
      col[i * 3] = p.r * a;
      col[i * 3 + 1] = p.g * a;
      col[i * 3 + 2] = p.b * a;
    }
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    geo.setDrawRange(0, pool.length);
  }
  return { points, spawn, update, dispose: () => { geo.dispose(); mat.dispose(); } };
}
