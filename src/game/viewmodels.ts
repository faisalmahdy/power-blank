import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { WeaponId } from "./types";
import { WEAPONS } from "./weapons";

let rifleScene: THREE.Group | null = null;
const gunScenes = new Map<string, THREE.Group>();
let gunsPromise: Promise<void> | null = null;

export function preloadGuns(): Promise<void> {
  if (gunsPromise) return gunsPromise;
  const files = ["/game/rifle.glb", "/game/smg.glb", "/game/shotgun.glb", "/game/pistol.glb", "/game/sniper.glb"];
  gunsPromise = Promise.all(files.map((url) => new Promise<void>((resolve) => {
    new GLTFLoader().load(url, (gltf) => {
      gunScenes.set(url, gltf.scene);
      if (url === "/game/rifle.glb") rifleScene = gltf.scene;
      resolve();
    }, undefined, () => resolve());
  }))).then(() => undefined);
  return gunsPromise;
}

export function preloadRifle(): Promise<void> {
  return preloadGuns();
}

function mountRifle(body: THREE.Group, rd: boolean, lsr: boolean) {
  if (!rifleScene) return;
  const rifle = rifleScene.clone(true);
  rifle.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      m.geometry = m.geometry.clone();
      m.frustumCulled = false;
    }
  });
  rifle.rotation.y = Math.PI;
  rifle.scale.setScalar(0.64);
  rifle.position.set(0, -0.05, 0.06);
  rifle.name = "rifleMesh";
  body.add(rifle);
  addMuzzle(body, -0.62);
  const dk = black();
  if (rd) addOptic(body, 0, 0.12, -0.05, dk);
  if (lsr) addLaser(body, 0, -0.02, -0.28, dk);
  const mag = new THREE.Group();
  mag.name = "mag";
  const bolt = new THREE.Group();
  bolt.name = "bolt";
  body.add(mag, bolt);
}

function mountLoaded(
  body: THREE.Group,
  src: THREE.Group,
  len: number,
  flip: boolean,
  parts: string[],
  rd: boolean,
  lsr: boolean,
) {
  const gun = src.clone(true);
  gun.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      m.geometry = m.geometry.clone();
      m.frustumCulled = false;
    }
  });
  if (flip) gun.rotation.y = Math.PI;
  gun.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gun);
  const size = box.getSize(new THREE.Vector3());
  const s = len / Math.max(size.z, 0.05);
  gun.scale.multiplyScalar(s);
  gun.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(gun);
  const center = fitted.getCenter(new THREE.Vector3());
  gun.position.x -= center.x;
  gun.position.y -= fitted.min.y + 0.04;
  gun.position.z -= fitted.min.z + len * 0.72;
  gun.name = "gunMesh";
  body.add(gun);
  addMuzzle(body, -len * 0.72);
  const dk = black();
  if (rd) addOptic(body, 0, 0.1, -0.02, dk);
  if (lsr) addLaser(body, 0, -0.02, -len * 0.35, dk);
  for (const name of parts) {
    const p = new THREE.Group();
    p.name = name;
    body.add(p);
  }
}

const gunMetal = (c = 0x8a9098) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.72, roughness: 0.38 });
const wood = () => new THREE.MeshStandardMaterial({ color: 0x8a5a32, metalness: 0.05, roughness: 0.78 });
const black = () => new THREE.MeshStandardMaterial({ color: 0x2a2c32, metalness: 0.45, roughness: 0.5 });
const accent = () => new THREE.MeshStandardMaterial({ color: 0xff6a00, metalness: 0.15, roughness: 0.45 });

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

function tube(
  g: THREE.Object3D,
  r0: number,
  r1: number,
  len: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  name?: string,
) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 14), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  if (name) m.name = name;
  g.add(m);
  return m;
}

function grip(g: THREE.Object3D, x: number, y: number, z: number, mat: THREE.Material) {
  const pts = [
    new THREE.Vector2(0.01, 0),
    new THREE.Vector2(0.026, 0.02),
    new THREE.Vector2(0.03, 0.07),
    new THREE.Vector2(0.018, 0.12),
    new THREE.Vector2(0.012, 0.15),
  ];
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 8), mat);
  m.position.set(x, y, z);
  m.rotation.x = 0.4;
  g.add(m);
  return m;
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

function irons(parent: THREE.Object3D, zRear: number, zFront: number) {
  const dk = black();
  const y = 0.08;
  const notchW = 0.01;
  const notchH = 0.024;
  const notchD = 0.01;
  const half = 0.013;
  box(parent, notchW, notchH, notchD, -half, y, zRear, dk);
  box(parent, notchW, notchH, notchD, half, y, zRear, dk);
  box(parent, 0.006, notchH, 0.008, 0, y, zFront, dk);
}

function buildCar15(body: THREE.Group, ext: boolean, rd: boolean, lsr: boolean) {
  const gm = gunMetal(0x7a8088);
  const dk = black();
  const rail = gunMetal(0x3a3e46);
  tube(body, 0.038, 0.042, 0.42, 0, 0.02, 0.02, gm);
  for (let i = 0; i < 4; i++) {
    box(body, 0.046, 0.01, 0.02, 0, 0.0, -0.14 - i * 0.06, dk);
  }
  tube(body, 0.028, 0.03, 0.2, 0, 0.055, -0.02, rail);
  tube(body, 0.016, 0.016, 0.46, 0, 0.02, -0.4, dk);
  tube(body, 0.022, 0.02, 0.05, 0, 0.02, -0.64, dk);
  grip(body, 0, -0.02, 0.1, dk);
  tube(body, 0.03, 0.034, 0.2, 0, 0.02, 0.32, gm);
  tube(body, 0.012, 0.016, 0.16, 0, 0.045, 0.46, dk);
  const magH = ext ? 0.22 : 0.16;
  box(body, 0.04, magH, 0.07, 0, -0.1 - magH * 0.15, 0.05, dk, "mag");
  box(body, 0.03, 0.018, 0.08, 0.04, 0.05, 0.06, dk, "bolt");
  box(body, 0.03, 0.09, 0.03, 0, -0.02, -0.18, dk);
  if (rd) addOptic(body, 0, 0.1, -0.02, dk);
  else box(body, 0.05, 0.05, 0.08, 0, 0.1, 0.08, dk);
  if (lsr) addLaser(body, 0, -0.04, -0.22, dk);
  irons(body, 0.16, -0.52);
  addMuzzle(body, -0.66);
}

function buildAk74(body: THREE.Group, ext: boolean, rd: boolean, lsr: boolean) {
  const gm = gunMetal(0xc8962a);
  const dk = black();
  const wd = wood();
  const magC = gunMetal(0xe6b422);
  tube(body, 0.04, 0.044, 0.4, 0, 0.015, 0.02, gm);
  for (let i = 0; i < 4; i++) {
    box(body, 0.046, 0.01, 0.02, 0, 0.0, -0.08 - i * 0.05, dk);
  }
  tube(body, 0.016, 0.018, 0.4, 0, 0.025, -0.38, dk);
  tube(body, 0.034, 0.03, 0.18, 0, 0.05, -0.16, wd);
  tube(body, 0.028, 0.024, 0.06, 0, 0.025, -0.6, dk);
  grip(body, 0, -0.01, 0.08, wd);
  tube(body, 0.036, 0.04, 0.22, 0, 0.01, 0.32, wd);
  const mag = box(body, 0.045, ext ? 0.24 : 0.18, 0.08, 0, -0.16, 0.05, magC, "mag");
  mag.rotation.z = 0.22;
  mag.rotation.x = 0.18;
  box(body, 0.025, 0.02, 0.1, 0.045, 0.05, 0.04, dk, "bolt");
  if (rd) addOptic(body, 0, 0.11, 0.02, dk);
  if (lsr) addLaser(body, 0, -0.035, -0.2, dk);
  irons(body, 0.12, -0.5);
  addMuzzle(body, -0.6);
}

function buildMp5(body: THREE.Group, ext: boolean, rd: boolean, lsr: boolean) {
  const gm = gunMetal(0x4a5060);
  const dk = black();
  tube(body, 0.034, 0.038, 0.3, 0, 0.015, 0.02, gm);
  for (let i = 0; i < 4; i++) {
    box(body, 0.046, 0.01, 0.02, 0, 0.0, -0.07 - i * 0.05, dk);
  }
  tube(body, 0.016, 0.018, 0.26, 0, 0.015, -0.26, dk);
  tube(body, 0.02, 0.018, 0.04, 0, 0.015, -0.4, dk);
  grip(body, 0, -0.02, 0.1, dk);
  tube(body, 0.026, 0.03, 0.16, 0, 0.01, 0.22, gm);
  tube(body, 0.01, 0.012, 0.1, 0, 0.02, 0.34, dk);
  const magH = ext ? 0.2 : 0.14;
  box(body, 0.032, magH, 0.055, 0, -0.1 - magH * 0.1, 0.04, gm, "mag");
  box(body, 0.028, 0.016, 0.07, 0.038, 0.045, 0.0, dk, "bolt");
  if (rd) addOptic(body, 0, 0.085, 0.0, dk);
  if (lsr) addLaser(body, 0, -0.03, -0.14, dk);
  irons(body, 0.1, -0.34);
  addMuzzle(body, -0.42);
}

function buildSr98(body: THREE.Group, _ext: boolean, _rd: boolean, lsr: boolean) {
  const gm = gunMetal(0xe6b422);
  const dk = black();
  const wd = wood();
  tube(body, 0.032, 0.036, 0.55, 0, 0.015, 0.02, gm);
  box(body, 0.05, 0.09, 0.02, 0, 0.0, 0.5, dk);
  box(body, 0.012, 0.02, 0.06, 0.03, 0.03, 0.04, dk);
  tube(body, 0.012, 0.014, 0.7, 0, 0.02, -0.52, dk);
  tube(body, 0.04, 0.038, 0.26, 0, 0.0, 0.36, wd);
  grip(body, 0, 0, 0.12, dk);
  box(body, 0.05, 0.08, 0.08, 0, -0.08, 0.04, dk, "mag");
  const bolt = box(body, 0.016, 0.016, 0.14, 0.05, 0.045, 0.02, gm, "bolt");
  bolt.rotation.z = 0.2;
  const optic = new THREE.Group();
  optic.name = "optic";
  optic.position.set(0, 0.09, 0.02);
  tube(optic, 0.022, 0.022, 0.2, 0, 0, 0, dk);
  tube(optic, 0.03, 0.03, 0.04, 0, 0, -0.1, dk);
  tube(optic, 0.03, 0.03, 0.04, 0, 0, 0.1, dk);
  body.add(optic);
  if (lsr) addLaser(body, 0, -0.03, -0.18, dk);
  addMuzzle(body, -0.88);
}

function buildM870(body: THREE.Group, ext: boolean, rd: boolean, lsr: boolean) {
  const gm = gunMetal(0x8a9098);
  const dk = black();
  const wd = wood();
  tube(body, 0.034, 0.038, 0.4, 0, 0.02, 0.04, gm);
  tube(body, 0.016, 0.016, 0.44, 0, 0.03, -0.36, dk);
  tube(body, 0.014, 0.014, ext ? 0.36 : 0.26, 0, -0.02, -0.2, dk);
  tube(body, 0.03, 0.026, 0.2, 0, 0.0, 0.3, wd);
  grip(body, 0, -0.02, 0.1, dk);
  tube(body, 0.026, 0.026, 0.14, 0, -0.01, -0.16, wd, "pump");
  box(body, 0.04, 0.08, 0.02, 0, 0.0, 0.41, dk);
  box(body, 0.012, 0.018, 0.05, 0.028, 0.03, 0.02, dk);
  box(body, 0.03, 0.03, 0.08, 0, -0.04, 0.12, dk, "mag");
  if (rd) addOptic(body, 0, 0.09, 0.04, dk);
  if (lsr) addLaser(body, 0, -0.05, -0.08, dk);
  irons(body, 0.14, -0.48);
  addMuzzle(body, -0.6);
}

function buildD50(body: THREE.Group, _ext: boolean, rd: boolean, lsr: boolean) {
  const gm = gunMetal(0x8a9098);
  const dk = black();
  tube(body, 0.028, 0.03, 0.22, 0, 0.045, -0.02, gm, "slide");
  box(body, 0.032, 0.008, 0.012, 0, 0.06, 0.02, dk);
  box(body, 0.032, 0.008, 0.012, 0, 0.06, 0.04, dk);
  box(body, 0.02, 0.03, 0.03, 0, 0.02, 0.11, dk);
  tube(body, 0.016, 0.018, 0.12, 0, 0.04, -0.18, dk);
  grip(body, 0, 0.02, 0.06, dk);
  box(body, 0.04, 0.1, 0.035, 0, -0.04, 0.04, gm, "mag");
  if (rd) addOptic(body, 0, 0.09, 0.0, dk);
  if (lsr) addLaser(body, 0, -0.02, -0.08, dk);
  addMuzzle(body, -0.26);
}

function buildG18(body: THREE.Group, ext: boolean, rd: boolean, lsr: boolean) {
  const gm = gunMetal(0x3a3e46);
  const dk = black();
  tube(body, 0.022, 0.024, 0.18, 0, 0.042, 0.0, gm, "slide");
  tube(body, 0.012, 0.012, 0.1, 0, 0.038, -0.12, dk);
  grip(body, 0, -0.01, 0.05, dk);
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
  tube(body, 0.018, 0.016, 0.1, 0, -0.02, 0.08, wd);
  cyl(body, 0.028, 0.012, 0, -0.02, 0.02, dk, Math.PI / 2);
  tube(body, 0.016, 0.002, 0.22, 0, 0.01, -0.08, blade);
  addMuzzle(body, -0.12);
}

function buildNade(body: THREE.Group, id: WeaponId) {
  const col = id === "he" ? 0x3a4a28 : id === "flash" ? 0xc8c4a8 : 0x6a6a62;
  const sph = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), gunMetal(col));
  sph.position.set(0, 0, -0.04);
  body.add(sph);
  box(body, 0.012, 0.06, 0.03, 0.01, 0.035, -0.02, black());
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
  const mesh =
    id === "mp5n" ? { src: gunScenes.get("/game/smg.glb"), len: 0.78, flip: true, parts: ["mag", "bolt"] }
    : id === "m870" ? { src: gunScenes.get("/game/shotgun.glb"), len: 0.95, flip: true, parts: ["pump"] }
    : id === "sr98" ? { src: gunScenes.get("/game/sniper.glb"), len: 1.12, flip: false, parts: ["bolt", "mag"] }
    : id === "d50" ? { src: gunScenes.get("/game/pistol.glb"), len: 0.42, flip: true, parts: ["slide", "mag"] }
    : id === "g18c" ? { src: gunScenes.get("/game/pistol.glb"), len: 0.34, flip: true, parts: ["slide", "mag"] }
    : null;
  if (mesh?.src) {
    mountLoaded(body, mesh.src, mesh.len, mesh.flip, mesh.parts, rd, lsr);
  } else if (id === "car15") {
    if (rifleScene) mountRifle(body, rd, lsr);
    else buildCar15(body, ext, rd, lsr);
  } else if (id === "ak74") buildAk74(body, ext, rd, lsr);
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
