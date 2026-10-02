import * as THREE from "three";
import type { WeaponId } from "./types";
import { createWorldGun } from "./viewmodels";
import { createSoldier } from "./world";

const thumbs = new Map<string, string>();
let thumbGL: THREE.WebGLRenderer | null = null;

function thumbRenderer() {
  if (thumbGL) return thumbGL;
  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = 160;
  thumbGL = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  thumbGL.setSize(360, 160, false);
  thumbGL.setClearColor(0x000000, 0);
  return thumbGL;
}

function plateGold(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshLambertMaterial | undefined;
    if (!mat?.color) return;
    const hex = mat.color.getHex();
    if (hex === 0xff2a2a || hex === 0xff2424) return;
    mesh.material = new THREE.MeshLambertMaterial({
      color: 0xe6b422,
      emissive: 0x7a5410,
      emissiveIntensity: 0.45,
    });
  });
}

function frameGun(id: WeaponId, gold: boolean) {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xdde7f5, 1.35));
  const key = new THREE.DirectionalLight(0xfff1cc, 2.4);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7eb6ff, 1.1);
  rim.position.set(-4, 1, -2);
  scene.add(rim);
  const gun = createWorldGun(id);
  if (gold) plateGold(gun);
  gun.rotation.set(0.08, 2.35, 0.02);
  scene.add(gun);
  const box = new THREE.Box3().setFromObject(gun);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  gun.position.sub(center);
  const dist = Math.max(size.x, size.y, size.z, 0.4) * 1.55;
  const cam = new THREE.PerspectiveCamera(30, 360 / 160, 0.02, 30);
  cam.position.set(dist * 0.05, dist * 0.22, dist);
  cam.lookAt(0, 0, 0);
  return { scene, cam, gun };
}

export function gunThumb(id: WeaponId): string {
  const gold = id === "ak74" || id === "sr98";
  const key = gold ? `${id}-gold` : id;
  const hit = thumbs.get(key);
  if (hit) return hit;
  const r = thumbRenderer();
  const { scene, cam, gun } = frameGun(id, gold);
  r.render(scene, cam);
  const url = r.domElement.toDataURL("image/png");
  thumbs.set(key, url);
  gun.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    }
  });
  return url;
}

export function shieldThumb(): string {
  const hit = thumbs.get("shield");
  if (hit) return hit;
  const r = thumbRenderer();
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const key = new THREE.DirectionalLight(0xfff1cc, 2);
  key.position.set(2, 3, 4);
  scene.add(key);
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.9, 0.06),
    new THREE.MeshLambertMaterial({ color: 0x2a313c }),
  );
  const window = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.16, 0.07),
    new THREE.MeshLambertMaterial({ color: 0x8fd0ff, emissive: 0x1a4a6a, emissiveIntensity: 0.4 }),
  );
  window.position.y = 0.22;
  scene.add(plate, window);
  const cam = new THREE.PerspectiveCamera(30, 360 / 160, 0.02, 20);
  cam.position.set(0.4, 0.2, 2.1);
  cam.lookAt(0, 0, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL("image/png");
  thumbs.set("shield", url);
  plate.geometry.dispose();
  window.geometry.dispose();
  return url;
}

export function mountSoldier(
  canvas: HTMLCanvasElement,
  gun: WeaponId,
): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const w = canvas.clientWidth || 240;
  const h = canvas.clientHeight || 320;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h, false);
  renderer.setClearColor(0x071426, 1);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xc5d7ee, 1.15));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 32),
    new THREE.MeshLambertMaterial({ color: 0x121820 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const man = createSoldier("CT");
  const weapon = createWorldGun(gun);
  man.getObjectByName("gunMount")?.add(weapon);
  scene.add(man);
  const cam = new THREE.PerspectiveCamera(32, w / h, 0.1, 30);
  cam.position.set(1.35, 1.35, 2.55);
  cam.lookAt(0, 1.12, 0);
  let raf = 0;
  let t = 0;
  const loop = () => {
    t += 0.016;
    man.rotation.y = 0.45 + Math.sin(t * 0.55) * 0.55;
    const swing = Math.sin(t * 1.6) * 0.12;
    const legL = man.getObjectByName("legL");
    const legR = man.getObjectByName("legR");
    const armL = man.getObjectByName("armL");
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
    if (armL) armL.rotation.x = -1.05 + Math.sin(t * 1.2) * 0.06;
    renderer.render(scene, cam);
    raf = requestAnimationFrame(loop);
  };
  loop();
  return () => {
    cancelAnimationFrame(raf);
    renderer.dispose();
    floor.geometry.dispose();
  };
}
