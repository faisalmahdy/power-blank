import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Team, WeaponId } from "@/game/types";
import { createWorldGun } from "@/game/viewmodels";
import { createSoldier } from "@/game/world";

export function HangoutPreview({ team, weapon }: { team: Team; weapon: WeaponId }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = false;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 40);
    camera.position.set(1.15, 1.55, 3.05);
    camera.lookAt(0, 1.15, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    const hemi = new THREE.HemisphereLight(0xe8eef8, 0x5a4a38, 0.9);
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.8);
    sun.position.set(2, 4, 3);
    sun.castShadow = false;
    const wash = new THREE.PointLight(0xff6a00, 0.55);
    wash.position.set(0.4, 1.6, 1.2);
    scene.add(ambient, hemi, sun, wash);

    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 0.04, 48),
      new THREE.MeshLambertMaterial({ color: 0x1a1c22 }),
    );
    ground.position.y = 0;
    scene.add(ground);

    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(1.28, 1.28, 0.018, 48),
      new THREE.MeshBasicMaterial({
        color: team === "CT" ? 0x4aa3ff : 0xff4a4a,
        transparent: true,
        opacity: 0.55,
      }),
    );
    ring.position.y = -0.01;
    scene.add(ring);

    const soldier = createSoldier(team);
    soldier.position.set(0, 0, 0);
    soldier.getObjectByName("gunMount")?.add(createWorldGun(weapon));
    scene.add(soldier);

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });

    const fit = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? canvas.clientWidth;
      const h = parent?.clientHeight ?? canvas.clientHeight;
      if (w < 2 || h < 2) return;
      renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    fit();

    const observer = new ResizeObserver(fit);
    observer.observe(canvas.parentElement ?? canvas);

    let raf = 0;
    let last = performance.now();
    let t = 0;
    let alive = true;
    const loop = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      soldier.rotation.y += dt * 0.45;
      soldier.position.y = Math.sin(t * 2) * 0.02;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mats = mesh.material;
        if (Array.isArray(mats)) mats.forEach((m) => m.dispose());
        else mats?.dispose();
      });
      renderer.dispose();
    };
  }, [team, weapon]);

  return <canvas ref={canvasRef} className="block h-full w-full" style={{ display: "block" }} />;
}
