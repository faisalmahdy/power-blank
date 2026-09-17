import * as THREE from "three";
import type { GameEvent, HudSnapshot, MatchConfig, ScoreRow, Team, WeaponId } from "./types";
import { WEAPONS, fireInterval, magOf, recoilOf, spreadOf } from "./weapons";
import { createInput, isCoarsePointer, type InputHandle } from "./input";
import { createAudio } from "./audio";
import {
  buildMap,
  createSoldier,
  inSite,
  moveCylinder,
  raycastAABB,
  aabbExitT,
  type AABB,
  type BombSite,
  type MapBuilt,
} from "./world";
import { createParticleSystem, createViewmodel, createWorldGun, poseViewmodel } from "./viewmodels";
import { BOT_NAMES, STR } from "./strings";

const STEP = 1 / 60;
const GRAV = 24;
const JUMP = 7.4;
const RADIUS = 0.34;
const HEIGHT = 1.72;
const ROUNDS_TO_WIN = 5;
const PLANT_TIME = 3.5;
const DEFUSE_TIME = 5;
const BOMB_FUSE = 40;
const PICK_TIME = 0.85;
const ROUND_TIME = 120;
const BLAST_R = 8.2;
/** 5-4-3-2-1 each last 1s, then MISSION START, then guns. */
const FREEZE_COUNT = 5;
const FREEZE_GO = 1.2;

export type EngineHandle = {
  dispose: () => void;
  setPaused: (p: boolean) => void;
  getHud: () => HudSnapshot;
  getScoreRows: () => ScoreRow[];
  getSpray: () => { shotI: number; recoilP: number; recoilY: number; weapon: WeaponId };
  requestLock: () => void;
  input: InputHandle;
  buy: (id: WeaponId) => boolean;
  buyArmor: () => boolean;
};

type Actor = {
  id: string;
  name: string;
  team: Team;
  bot: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vy: number;
  vz: number;
  hp: number;
  armor: number;
  alive: boolean;
  spawnProt: number;
  respawn: number;
  weapon: WeaponId;
  mag: number;
  reserve: number;
  fireCd: number;
  reloadT: number;
  shotI: number;
  recoilP: number;
  recoilY: number;
  crouch: boolean;
  shotGap: number;
  mesh: THREE.Group;
  gun: THREE.Group;
  kills: number;
  deaths: number;
  assists: number;
  rkills: number;
  ping: number;
  skill: number;
  wp: number;
  seeT: number;
  stuck: number;
  tx: number;
  tz: number;
  nades: number;
  lastHitBy: string | null;
  bob: number;
  plantT: number;
  strafeDir: number;
  primary: WeaponId;
  pistol: WeaponId;
  flashT: number;
  ammo: Partial<Record<WeaponId, { mag: number; reserve: number }>>;
};

type Nade = {
  kind: WeaponId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuse: number;
  mesh: THREE.Object3D;
  team: Team;
  srcId: string;
};

type Smoke = { x: number; z: number; r: number; life: number; mesh: THREE.Mesh };

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function createBombProp(): THREE.Group {
  const g = new THREE.Group();
  g.name = "bomb";
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.18, 0.32),
    new THREE.MeshStandardMaterial({
      color: 0x3a3d2c,
      metalness: 0.38,
      roughness: 0.52,
      emissive: 0x1a0800,
      emissiveIntensity: 0.22,
    }),
  );
  g.add(body);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.045, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xc45a10 }),
  );
  stripe.position.y = 0.03;
  g.add(stripe);
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff3300, emissiveIntensity: 1.4 }),
  );
  led.name = "led";
  led.position.set(0.14, 0.12, 0.08);
  g.add(led);
  const ant = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6),
    new THREE.MeshStandardMaterial({ color: 0x222226, metalness: 0.8, roughness: 0.3 }),
  );
  ant.position.set(-0.12, 0.22, -0.08);
  g.add(ant);
  const light = new THREE.PointLight(0xff3300, 0.35, 4.5);
  light.name = "bombLight";
  light.position.set(0, 0.22, 0);
  g.add(light);
  return g;
}

export function createEngine(
  canvas: HTMLCanvasElement,
  cfg: MatchConfig,
  onEvent: (e: GameEvent) => void,
): EngineHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: cfg.quality === "high",
    powerPreference: "high-performance",
    alpha: false,
  });
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, cfg.quality === "high" && !isCoarsePointer() ? 1.5 : 1.15),
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = cfg.map === "harbor" ? 1.68 : cfg.map === "bazaar" ? 1.4 : 1.62;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.enabled = cfg.quality === "high" && !isCoarsePointer();
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(cfg.settings.fov, 1, 0.05, 220);
  const overlay = new THREE.Scene();
  const overlayCam = new THREE.PerspectiveCamera(65, 1, 0.02, 8);
  overlay.add(new THREE.AmbientLight(0xffffff, 1.25));
  const gunLight = new THREE.DirectionalLight(0xfff1dc, 2.45);
  gunLight.position.set(0.4, 0.8, 0.6);
  overlay.add(gunLight);

  const loader = new THREE.TextureLoader();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const world: MapBuilt = buildMap(cfg.map, loader, aniso);
  scene.add(world.group);
  scene.add(new THREE.AmbientLight(0xffffff, 0.58));
  scene.fog = world.fog;
  scene.background = new THREE.Color(world.fog.color);

  const audio = createAudio();
  audio.setGains(cfg.settings.master, cfg.settings.sfx, cfg.settings.music);
  const input = createInput(canvas);
  const fx = createParticleSystem();
  scene.add(fx.points);

  const yawObj = new THREE.Object3D();
  const pitchObj = new THREE.Object3D();
  yawObj.add(pitchObj);
  pitchObj.add(camera);
  scene.add(yawObj);

  let viewGun = createViewmodel(cfg.loadout.primary);
  overlay.add(viewGun);

  const actors: Actor[] = [];
  const nades: Nade[] = [];
  const smokes: Smoke[] = [];
  const decals: THREE.Mesh[] = [];
  const tracers: Array<{ line: THREE.Line; life: number }> = [];

  let paused = false;
  let ended = false;
  let freeze = FREEZE_COUNT + FREEZE_GO;
  let matchTime = cfg.mode === "tdm" ? 360 : ROUND_TIME;
  let round = 1;
  let roundsCT = 0;
  let roundsTR = 0;
  let scoreCT = 0;
  let scoreTR = 0;
  let bombPlanted = false;
  let bombTime = 0;
  let bombX = 0;
  let bombZ = 0;
  let bombMesh: THREE.Group | null = null;
  let carrier: Actor | null = null;
  let plantProg = 0;
  let defuseProg = 0;
  let pickProg = 0;
  let bombLoose = false;
  let plantSite: BombSite | null = null;
  let announcer = "5";
  let announcerT = 1.15;
  let bannerKind: HudSnapshot["bannerKind"] = "count";
  let bannerTeam: Team | null = null;
  let firstBlood = false;
  let roundMvp = "";
  let bombWarn = false;
  let killMsg = "";
  let killMsgT = 0;
  let killBy = false;
  let killGun = "";
  let hitmarker = 0;
  let headshotMk = false;
  let hurt = 0;
  let hurtDir = 0;
  let flash = 0;
  let trauma = 0;
  let hitStop = 0;
  let streak = 0;
  let lookingName = "";
  let lookingTeam: Team | null = null;
  let lookingHp = 0;
  let siteHint = "";
  let money = 4000;
  const MONEY_CAP = 12000;
  const ARMOR_COST = 400;
  let nadeId: WeaponId = cfg.loadout.nade;
  let lastGun: WeaponId = cfg.loadout.primary;
  let cookT = 0;
  let lockedPlanter: string | null = null;
  let lockedDefuser: string | null = null;
  let pendingWin: Team | null = null;
  let pendingWinT = 0;
  let matchOver: Team | "draw" | null = null;
  let matchOverT = 0;
  let matchPoint = false;
  let kitFrac = 0;
  let cookMax = 1.7;
  const T = STR[cfg.settings.locale] ?? STR.en;
  const unlocked = new Set<WeaponId>([
    cfg.loadout.primary,
    cfg.loadout.pistol,
    "knife",
    cfg.loadout.nade,
    ...(cfg.unlocked ?? []),
  ]);
  let last = performance.now();
  let acc = 0;
  let disposed = false;
  let bob = 0;
  let adsAmt = 0;
  let vmKick = 0;
  let vmDrop = 0;
  let vmCycle = 0;
  let fovKick = 0;
  let roundResetting = 0;
  let captured = false;
  let live = false;
  const touchPlay = isCoarsePointer();

  const names = BOT_NAMES.filter((n) => n !== cfg.nickname.toUpperCase());
  let ni = 0;

  function makeActor(name: string, team: Team, bot: boolean, spawn: { x: number; z: number }): Actor {
    const mesh = createSoldier(team);
    const primary: WeaponId = bot
      ? team === "CT"
        ? Math.random() < 0.7
          ? "car15"
          : pick(["car15", "mp5n", "sr98"])
        : Math.random() < 0.7
          ? "ak74"
          : pick(["ak74", "mp5n", "m870"])
      : cfg.loadout.primary;
    const gun = createWorldGun(primary);
    mesh.getObjectByName("gunMount")?.add(gun);
    scene.add(mesh);
    const def = WEAPONS[primary];
    const a: Actor = {
      id: bot ? `bot-${name}` : "player",
      name,
      team,
      bot,
      x: spawn.x,
      y: 0,
      z: spawn.z,
      yaw: team === "CT" ? 0 : Math.PI,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      hp: 100,
      armor: 100,
      alive: true,
      spawnProt: 2.8,
      respawn: 0,
      weapon: primary,
      mag: magOf(def),
      reserve: def.reserve,
      fireCd: 0,
      reloadT: 0,
      shotI: 0,
      recoilP: 0,
      recoilY: 0,
      crouch: false,
      shotGap: 1,
      mesh,
      gun,
      kills: 0,
      deaths: 0,
      assists: 0,
      rkills: 0,
      ping: bot ? 18 + Math.floor(Math.random() * 50) : 12,
      skill: bot ? rand(0.42, 0.88) : 1,
      wp: Math.floor(Math.random() * Math.max(1, world.waypoints.length)),
      seeT: 0,
      stuck: 0,
      tx: spawn.x,
      tz: spawn.z,
      nades: bot ? 1 : 1,
      lastHitBy: null,
      bob: 0,
      plantT: 0,
      strafeDir: Math.random() < 0.5 ? 1 : -1,
      primary,
      pistol: bot ? (Math.random() < 0.5 ? "d50" : "g18c") : cfg.loadout.pistol,
      flashT: 0,
      ammo: {},
    };
    const pistol = a.pistol;
    a.ammo[primary] = { mag: magOf(def), reserve: def.reserve };
    a.ammo[pistol] = { mag: magOf(WEAPONS[pistol]), reserve: WEAPONS[pistol].reserve };
    mesh.position.set(a.x, a.y, a.z);
    mesh.rotation.y = a.yaw + Math.PI;
    return a;
  }

  const spCT = world.spawnsCT;
  const spTR = world.spawnsTR;
  const player = makeActor(cfg.nickname.toUpperCase(), cfg.team, false, pick(cfg.team === "CT" ? spCT : spTR));
  actors.push(player);

  const per = Math.max(3, Math.round(cfg.botCount / 2));
  for (const team of ["CT", "TR"] as Team[]) {
    const have = actors.filter((a) => a.team === team).length;
    for (let i = have; i < per; i++) {
      const sp = pick(team === "CT" ? spCT : spTR);
      const n = names[ni % names.length]!;
      ni++;
      actors.push(makeActor(n, team, true, { x: sp.x + rand(-1.2, 1.2), z: sp.z + rand(-1.2, 1.2) }));
    }
  }

  if (cfg.mode === "demolition") {
    plantSite = chooseSite();
    bombMesh = createBombProp();
    bombMesh.visible = false;
    scene.add(bombMesh);
  }

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 800;
    const h = canvas.clientHeight || canvas.parentElement?.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    overlayCam.aspect = camera.aspect;
    overlayCam.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement || canvas);

  function los(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.2) return true;
    const hit = raycastAABB(ax, ay, az, dx / dist, dy / dist, dz / dist, dist - 0.2, world.colliders);
    if (hit) return false;
    for (const s of smokes) {
      const t = ((s.x - ax) * dx + (s.z - az) * dz) / (dist * dist);
      if (t < 0 || t > 1) continue;
      const px = ax + dx * t;
      const pz = az + dz * t;
      if (Math.hypot(px - s.x, pz - s.z) < s.r * 0.85) return false;
    }
    return true;
  }

  function actorAABBs(a: Actor): { head: AABB; body: AABB } {
    const crouched = a.crouch;
    const headMin = crouched ? 0.92 : 1.5;
    const headMax = crouched ? 1.22 : 1.82;
    const half = crouched ? 0.2 : 0.22;
    return {
      head: {
        minX: a.x - 0.13,
        maxX: a.x + 0.13,
        minY: a.y + headMin,
        maxY: a.y + headMax,
        minZ: a.z - 0.13,
        maxZ: a.z + 0.13,
      },
      body: {
        minX: a.x - half,
        maxX: a.x + half,
        minY: a.y + 0.12,
        maxY: a.y + headMin,
        minZ: a.z - (crouched ? 0.2 : 0.18),
        maxZ: a.z + (crouched ? 0.2 : 0.18),
      },
    };
  }

  function rayActors(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    max: number,
    skip: Actor,
  ): { actor: Actor; t: number; head: boolean; x: number; y: number; z: number } | null {
    let best: ReturnType<typeof rayActors> = null;
    for (const a of actors) {
      if (a === skip || !a.alive) continue;
      const boxes = actorAABBs(a);
      for (const [box, head] of [
        [boxes.head, true],
        [boxes.body, false],
      ] as const) {
        const hit = raycastAABB(ox, oy, oz, dx, dy, dz, max, [box]);
        if (hit && (!best || hit.t < best.t)) {
          best = { actor: a, t: hit.t, head, x: hit.x, y: hit.y, z: hit.z };
        }
      }
    }
    return best;
  }

  function addDecal(x: number, y: number, z: number, nx: number, ny: number, nz: number, blood = false) {
    const size = blood ? 0.42 : 0.12;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({
        color: blood ? 0x6a1010 : 0x1a120c,
        transparent: true,
        opacity: blood ? 0.85 : 0.75,
        depthWrite: false,
      }),
    );
    m.position.set(x + nx * 0.015, y + ny * 0.015, z + nz * 0.015);
    m.lookAt(x + nx, y + ny, z + nz);
    scene.add(m);
    decals.push(m);
    if (decals.length > 64) {
      const old = decals.shift()!;
      scene.remove(old);
      old.geometry.dispose();
      (old.material as THREE.Material).dispose();
    }
  }

  function tracer(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    color = 0xffe08a,
  ) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(ax, ay, az),
      new THREE.Vector3(bx, by, bz),
    ]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }),
    );
    scene.add(line);
    tracers.push({ line, life: 0.16 });
  }

  function burst(x: number, y: number, z: number, n: number, r: number, g: number, b: number, spd: number) {
    for (let i = 0; i < n; i++) {
      fx.spawn({
        x,
        y,
        z,
        vx: rand(-spd, spd),
        vy: rand(0.4, spd),
        vz: rand(-spd, spd),
        life: rand(0.15, 0.45),
        max: 0.45,
        r,
        g,
        b,
      });
    }
  }

  function killFeedWeapon(id: WeaponId): WeaponId {
    return id;
  }

  function announce(s: string, t = 1.6, kind: HudSnapshot["bannerKind"] = "", team: Team | null = null) {
    if (matchOver && kind !== "match" && kind !== "round") return;
    announcer = s;
    announcerT = t;
    bannerKind = kind;
    bannerTeam = team;
    if (kind === "count") {
      const n = Number(s);
      if (n >= 1 && n <= 5) {
        audio.tick(n);
        trauma = Math.max(trauma, 0.14);
      }
    } else if (kind === "mission") {
      audio.radio("go");
      audio.slam();
      trauma = Math.max(trauma, 0.28);
    } else if (kind === "blood" || kind === "multi") {
      audio.slam();
      trauma = Math.max(trauma, kind === "blood" ? 0.38 : 0.28);
    } else if (kind === "down") {
      audio.radio("down");
    } else if (kind === "bomb") {
      audio.radio(s === T.tenSeconds ? "ten" : "plant");
    } else if (kind === "defuse") {
      audio.radio("defuse");
    } else if (kind === "round" || kind === "match") {
      audio.radio("win");
      audio.slam();
      trauma = Math.max(trauma, kind === "match" ? 0.52 : 0.42);
    }
  }

  function armRound() {
    if (live) return;
    live = true;
    freeze = FREEZE_COUNT + FREEZE_GO;
    announce("5", 1.2, "count");
  }

  function applyDamage(a: Actor, dmg: number, head: boolean, src: Actor, weapon: WeaponId) {
    if (!a.alive || a.spawnProt > 0 || ended || matchOver) return;
    if (a.team === src.team && !(a === src && WEAPONS[weapon].tribe === "nade")) return;
    let d = dmg;
    if (bombPlanted && a.bot && a.team === "CT" && a.plantT > 0.1) d *= 0.32;
    const vestHit = a === player && a.armor > 8;
    if (head) d *= WEAPONS[weapon].headMul;
    if (a.armor > 0 && !head && WEAPONS[weapon].tribe !== "sr") {
      const absorbed = d * (WEAPONS[weapon].tribe === "nade" ? 0.28 : 0.45);
      a.armor = Math.max(0, a.armor - absorbed);
      d -= absorbed;
    } else if (a.armor > 0 && head) {
      a.armor = Math.max(0, a.armor - d * 0.15);
      d *= 0.92;
    }
    a.hp -= d;
    const prevHit = a.lastHitBy;
    a.lastHitBy = src.id;
    if (a === player) {
      hurt = Math.min(1, 0.62 + (head ? 0.2 : 0));
      let ang = Math.atan2(-(src.x - player.x), -(src.z - player.z)) - player.yaw;
      while (ang > Math.PI) ang -= Math.PI * 2;
      while (ang < -Math.PI) ang += Math.PI * 2;
      hurtDir = ang;
      trauma = Math.min(1, trauma + 0.35);
      audio.hurt(worldPan(src.x, src.z), vestHit);
    }
    burst(a.x, a.y + (head ? 1.62 : 1.1), a.z, head ? 32 : 20, 0.95, 0.07, 0.05, 3.6);
    addDecal(a.x, a.y + 0.05, a.z, 0, 1, 0, true);
    if (a.hp <= 0) {
      a.hp = 0;
      a.alive = false;
      a.deaths++;
      a.respawn = cfg.mode === "tdm" ? 3.2 : 99;
      src.kills++;
      src.rkills++;
      if (prevHit && prevHit !== src.id) {
        const as = actors.find((x) => x.id === prevHit);
        if (as) as.assists++;
      }
      a.mesh.rotation.x = 1.15;
      a.mesh.rotation.z = src.x > a.x ? 0.35 : -0.35;
      a.mesh.position.y = 0.18;
      if (src.team === "CT") scoreCT++;
      else scoreTR++;
      if (!firstBlood) {
        firstBlood = true;
        announce(T.firstBlood, 2.2, "blood");
      } else if (src.team === player.team && src !== player && announcerT <= 0.12 && freeze <= 0) {
        announce(T.enemyDown, 1.05, "down");
      }
      if (src === player) {
        streak++;
        killMsg = a.name;
        killMsgT = 1.8;
        killBy = false;
        killGun = WEAPONS[weapon].name;
        hitStop = 0.05;
        if (streak >= 5) announce(T.ace, 1.8, "multi");
        else if (streak === 4) announce(T.quad, 1.7, "multi");
        else if (streak === 3) announce(T.triple, 1.6, "multi");
        else if (streak === 2) announce(T.double, 1.5, "multi");
        else if (head && announcerT < 0.4) announce(T.headshot, 1.05, "down");
        trauma = Math.min(1, trauma + 0.42 * cfg.settings.shake);
      }
      if (a === player) {
        streak = 0;
        trauma = Math.min(1, trauma + 0.5);
        killMsg = src.name;
        killMsgT = 2.2;
        killBy = true;
        killGun = WEAPONS[weapon].name;
      }
      if (carrier === a) {
        carrier = null;
        bombX = a.x;
        bombZ = a.z;
      }
      onEvent({
        type: "kill",
        killer: src.name,
        victim: a.name,
        weapon: killFeedWeapon(weapon),
        head,
        isPlayerKill: src === player,
        isPlayerDeath: a === player,
        killerTeam: src.team,
        victimTeam: a.team,
      });
      audio.hit(head);
    }
  }

  function fire(a: Actor, origin: THREE.Vector3, dir: THREE.Vector3) {
    const w = WEAPONS[a.weapon];
    if (a.fireCd > 0 || a.reloadT > 0 || !a.alive) return;
    if (w.slot === "nade") {
      if (a.nades <= 0) return;
      a.nades--;
      a.fireCd = 1.1;
      throwNade(a, origin, dir, a.weapon);
      if (a === player && a.nades <= 0) stowNade();
      audio.whoosh();
      return;
    }
    if (w.slot === "melee") {
      a.fireCd = fireInterval(w);
      vmKick = 0.28;
      audio.gun("knife");
      const lung = 4.2;
      a.vx += dir.x * lung;
      a.vz += dir.z * lung;
      const hit = rayActors(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, w.range, a);
      if (hit) {
        applyDamage(hit.actor, w.dmg, hit.head, a, w.id);
        if (a === player) {
          hitmarker = 0.18;
          headshotMk = hit.head;
          audio.hit(hit.head);
        }
      }
      return;
    }
    if (a.mag <= 0) {
      if (a === player) audio.empty();
      if (a.reserve > 0) startReload(a);
      return;
    }
    a.mag--;
    a.fireCd = fireInterval(w);
    const rec = recoilOf(w, a.shotI);
    a.shotI++;
    a.shotGap = 0;
    a.recoilP += rec[0];
    a.recoilY += rec[1];
    if (a === player) {
      vmKick = 0.08 + w.dmg * 0.001;
      trauma = Math.min(1, trauma + 0.08 * cfg.settings.shake);
      audio.gun(w.id);
      if (w.reloadStyle === "tube" || w.reloadStyle === "bolt" || w.reloadStyle === "slide") {
        vmCycle = 1;
        audio.cycle(w.id);
      }
      const mz = viewGun.getObjectByName("muzzle") as THREE.Mesh | undefined;
      if (mz) {
        const mat = mz.material as THREE.MeshBasicMaterial;
        mat.opacity = 1;
        mz.scale.setScalar(2.6);
      }
    } else {
      audio.gun(w.id, Math.hypot(a.x - player.x, a.z - player.z), worldPan(a.x, a.z));
    }
    const rightCas = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    fx.spawn({
      x: origin.x + rightCas.x * 0.18,
      y: origin.y - 0.04,
      z: origin.z + rightCas.z * 0.18,
      vx: rightCas.x * rand(1.6, 3.4) + dir.x * 0.4,
      vy: rand(2.2, 4.2),
      vz: rightCas.z * rand(1.6, 3.4) + dir.z * 0.4,
      life: 0.55,
      max: 0.55,
      r: 0.92,
      g: 0.72,
      b: 0.22,
    });
    const moving = Math.hypot(a.vx, a.vz) > 0.4;
    const ads = a === player && adsAmt > 0.5;
    const crouch = a.crouch;
    const airborne = a.y > 0.1;
    const spread =
      spreadOf(w, moving, ads, crouch, airborne) + (a.bot ? (1 - a.skill) * 0.025 : 0);
    for (let p = 0; p < w.pellets; p++) {
      const d = dir.clone();
      if (spread > 0.0004) {
        const right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
        const up = new THREE.Vector3().crossVectors(right, d).normalize();
        if (w.pellets > 1) {
          d.addScaledVector(right, rand(-spread, spread));
          d.addScaledVector(up, rand(-spread, spread));
        } else {
          d.addScaledVector(right, rand(-spread, spread));
          d.addScaledVector(up, rand(-spread * 0.45, spread * 0.45));
        }
        d.normalize();
      }
      let ox = origin.x;
      let oy = origin.y;
      let oz = origin.z;
      let remain = w.range;
      let dmgMul = 1;
      let walls = 0;
      const maxWalls = w.penetration > 0.55 ? 2 : w.penetration > 0.15 ? 1 : 0;
      let end = origin.clone().addScaledVector(d, remain * 0.6);
      for (let hop = 0; hop < maxWalls + 1 && remain > 0.4; hop++) {
        const worldHit = raycastAABB(ox, oy, oz, d.x, d.y, d.z, remain, world.colliders);
        const actHit = rayActors(ox, oy, oz, d.x, d.y, d.z, remain, a);
        if (actHit && (!worldHit || actHit.t < worldHit.t)) {
          end.set(actHit.x, actHit.y, actHit.z);
          const fall = clamp(1 - (actHit.t / w.range) * 0.4, 0.55, 1);
          applyDamage(actHit.actor, w.dmg * fall * dmgMul, actHit.head, a, w.id);
          if (a === player) {
            hitmarker = 0.16;
            headshotMk = actHit.head;
            audio.hit(actHit.head);
          }
          break;
        }
        if (!worldHit) {
          end.set(ox + d.x * remain, oy + d.y * remain, oz + d.z * remain);
          break;
        }
        end.set(worldHit.x, worldHit.y, worldHit.z);
        addDecal(worldHit.x, worldHit.y, worldHit.z, worldHit.nx, worldHit.ny, worldHit.nz);
        burst(worldHit.x, worldHit.y, worldHit.z, 4, 0.55, 0.5, 0.4, 1.4);
        const box = world.colliders[worldHit.i];
        if (!box || walls >= maxWalls) break;
        const thick = aabbExitT(box, worldHit.x + d.x * 0.002, worldHit.y + d.y * 0.002, worldHit.z + d.z * 0.002, d.x, d.y, d.z);
        if (thick > w.penetration * 1.55) break;
        walls++;
        dmgMul *= clamp(1 - thick / (w.penetration * 2.2), 0.28, 0.82);
        ox = worldHit.x + d.x * (thick + 0.05);
        oy = worldHit.y + d.y * (thick + 0.05);
        oz = worldHit.z + d.z * (thick + 0.05);
        remain -= worldHit.t + thick;
      }
      if (p === 0) {
        const col =
          w.id === "sr98" ? 0xffffff : w.id === "mp5n" || w.id === "g18c" ? 0xffc070 : 0xffe08a;
        tracer(origin.x, origin.y, origin.z, end.x, end.y, end.z, col);
      }
    }
    if (a.mag <= 0 && a.reserve > 0) startReload(a);
  }

  function recoverRecoil(a: Actor, dt: number) {
    const w = WEAPONS[a.weapon];
    a.shotGap += dt;
    const gap =
      w.tribe === "ak" ? 0.36 : w.tribe === "ar" ? 0.3 : w.tribe === "smg" || w.tribe === "autoPistol" ? 0.15 : 0.22;
    if (a.fireCd <= 0) {
      a.recoilP = Math.max(0, a.recoilP - w.recover * dt);
      a.recoilY += (0 - a.recoilY) * Math.min(1, 5.5 * dt);
    }
    if (a.shotGap > gap) {
      a.shotI = 0;
    }
  }

  function startReload(a: Actor) {
    const w = WEAPONS[a.weapon];
    if (w.slot === "melee" || w.slot === "nade") return;
    if (a.reloadT > 0 || a.reserve <= 0 || a.mag >= magOf(w)) return;
    a.reloadT = w.reload;
    a.shotI = 0;
    if (a === player) {
      audio.reload(w.id);
      vmDrop = 0.18;
    }
  }

  function finishReload(a: Actor) {
    const w = WEAPONS[a.weapon];
    if (w.id === "m870") {
      if (a.mag < magOf(w) && a.reserve > 0) {
        a.mag++;
        a.reserve--;
        if (a.mag < magOf(w) && a.reserve > 0) a.reloadT = w.reload;
      }
      return;
    }
    const need = magOf(w) - a.mag;
    const take = Math.min(need, a.reserve);
    a.mag += take;
    a.reserve -= take;
  }

  function switchWeapon(a: Actor, id: WeaponId) {
    if (a.weapon === id) return;
    a.ammo[a.weapon] = { mag: a.mag, reserve: a.reserve };
    a.weapon = id;
    a.reloadT = 0;
    a.shotI = 0;
    const def = WEAPONS[id];
    const saved = a.ammo[id];
    if (saved) {
      a.mag = saved.mag;
      a.reserve = saved.reserve;
    } else {
      a.mag = magOf(def);
      a.reserve = def.reserve;
    }
    a.gun.removeFromParent();
    a.gun.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    a.gun = createWorldGun(id);
    a.mesh.getObjectByName("gunMount")?.add(a.gun);
    if (a === player) {
      overlay.remove(viewGun);
      viewGun.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      viewGun = createViewmodel(id);
      overlay.add(viewGun);
      vmDrop = 0.2;
      vmCycle = 0;
      audio.ui();
    }
  }

  function buy(id: WeaponId): boolean {
    if (!player.alive) return false;
    const w = WEAPONS[id];
    const owned = unlocked.has(id) || w.price === 0;
    if (freeze <= FREEZE_GO) return false;
    if (!owned) {
      audio.empty();
      return false;
    }
    if (w.slot === "primary") player.primary = id;
    if (w.slot === "pistol") player.pistol = id;
    if (w.slot === "nade") {
      nadeId = id;
      player.nades = 1;
    }
    switchWeapon(player, id);
    if (w.slot !== "melee") {
      player.mag = magOf(w);
      player.reserve = w.reserve;
      player.ammo[id] = { mag: magOf(w), reserve: w.reserve };
    }
    return true;
  }

  function buyArmor(): boolean {
    if (!player.alive || freeze <= FREEZE_GO) return false;
    if (player.armor >= 100) return false;
    if (money < ARMOR_COST) {
      audio.empty();
      return false;
    }
    money -= ARMOR_COST;
    player.armor = 100;
    audio.ui();
    return true;
  }

  function fuseOf(kind: WeaponId) {
    return kind === "smoke" ? 1.35 : kind === "flash" ? 1.55 : 1.7;
  }

  function throwNade(a: Actor, origin: THREE.Vector3, dir: THREE.Vector3, kind: WeaponId, fuse?: number) {
    const mesh = createWorldGun(kind);
    mesh.scale.setScalar(0.72);
    mesh.position.copy(origin);
    scene.add(mesh);
    const speed = 11.2;
    nades.push({
      kind,
      x: origin.x,
      y: origin.y,
      z: origin.z,
      vx: dir.x * speed + a.vx * 0.35,
      vy: dir.y * speed + 5.4,
      vz: dir.z * speed + a.vz * 0.35,
      fuse: fuse ?? fuseOf(kind),
      mesh,
      team: a.team,
      srcId: a.id,
    });
  }

  function explode(n: Nade) {
    burst(n.x, n.y, n.z, n.kind === "he" ? 36 : 22, 1, 0.45, 0.12, n.kind === "he" ? 7 : 4);
    const src = actors.find((x) => x.id === n.srcId) ?? player;
    if (n.kind === "he") {
      audio.boom(worldPan(n.x, n.z));
      trauma = Math.min(1, trauma + 0.78 * cfg.settings.shake);
      const w = WEAPONS.he;
      for (const a of actors) {
        if (!a.alive) continue;
        const dist = Math.hypot(a.x - n.x, a.y + 1 - n.y, a.z - n.z);
        if (dist > w.range) continue;
        if (dist > 1.4 && !los(n.x, n.y, n.z, a.x, a.y + 1.1, a.z)) continue;
        const fall = dist <= 1.8 ? 1 : (1 - (dist - 1.8) / (w.range - 1.8)) ** 2;
        applyDamage(a, w.dmg * fall, false, src, "he");
      }
    } else if (n.kind === "flash") {
      audio.gun("flash", Math.hypot(n.x - player.x, n.z - player.z), worldPan(n.x, n.z));
      audio.whoosh();
      for (const a of actors) {
        if (!a.alive) continue;
        const dist = Math.hypot(a.x - n.x, a.z - n.z);
        if (dist > 18) continue;
        if (!los(n.x, n.y, n.z, a.x, a.y + 1.55, a.z)) continue;
        const to = new THREE.Vector3(n.x - a.x, n.y - (a.y + 1.55), n.z - a.z).normalize();
        const fwd = new THREE.Vector3(-Math.sin(a.yaw), 0, -Math.cos(a.yaw));
        const looking = fwd.dot(to) > 0.18;
        const amt = looking ? clamp(1.2 - dist / 18, 0.55, 1) : clamp(0.48 - dist / 24, 0.14, 0.4);
        if (a === player) flash = Math.max(flash, amt);
        else a.flashT = Math.max(a.flashT, looking ? 3.4 : 1.15);
      }
    } else {
      audio.whoosh();
      const spots: Array<[number, number]> = [
        [0, 0],
        [2.05, 0.55],
        [-1.85, 1.15],
        [1.15, -1.7],
        [-0.7, -1.85],
      ];
      for (const [ox, oz] of spots) {
        const cloud = new THREE.Mesh(
          new THREE.SphereGeometry(2.85, 10, 8),
          new THREE.MeshBasicMaterial({ color: 0x8a8880, transparent: true, opacity: 0.78, depthWrite: false }),
        );
        cloud.position.set(n.x + ox, 1.35, n.z + oz);
        scene.add(cloud);
        smokes.push({ x: n.x + ox, z: n.z + oz, r: 3.05, life: 14, mesh: cloud });
      }
    }
    scene.remove(n.mesh);
    n.mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }

  function restock(a: Actor) {
    const ids = new Set<WeaponId>([a.primary, a.pistol]);
    for (const k of Object.keys(a.ammo) as WeaponId[]) ids.add(k);
    for (const id of ids) {
      const def = WEAPONS[id];
      if (!def || def.slot === "nade" || def.slot === "melee") continue;
      a.ammo[id] = { mag: magOf(def), reserve: def.reserve };
    }
    a.nades = 1;
    a.reloadT = 0;
    a.shotI = 0;
    a.shotGap = 1;
    a.recoilP = 0;
    a.recoilY = 0;
    a.flashT = 0;
    a.hp = 100;
    a.armor = 100;
    const cur = WEAPONS[a.weapon];
    if (cur.slot === "nade" || cur.slot === "melee") {
      a.mag = 0;
      a.reserve = 0;
    } else {
      const saved = a.ammo[a.weapon];
      a.mag = saved?.mag ?? magOf(cur);
      a.reserve = saved?.reserve ?? cur.reserve;
    }
    if (!a.bot) {
      cookT = 0;
      lastGun = a.primary;
    }
  }

  function clearWorldFX() {
    while (nades.length) {
      const n = nades.pop()!;
      scene.remove(n.mesh);
      n.mesh.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    }
    while (smokes.length) {
      const s = smokes.pop()!;
      scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      (s.mesh.material as THREE.Material).dispose();
    }
  }

  function spawnActor(a: Actor) {
    const list = a.team === "CT" ? spCT : spTR;
    const s = pick(list);
    a.x = s.x + rand(-0.8, 0.8);
    a.y = 0;
    a.z = s.z + rand(-0.8, 0.8);
    a.hp = 100;
    a.armor = 100;
    a.alive = true;
    a.spawnProt = 2.8;
    a.vy = 0;
    a.mesh.rotation.x = 0;
    a.mesh.rotation.z = 0;
    a.mesh.position.set(a.x, a.y, a.z);
    a.mesh.rotation.y = a.yaw + Math.PI;
    a.mesh.visible = a.bot;
    a.plantT = 0;
    if (a.weapon !== a.primary) switchWeapon(a, a.primary);
    restock(a);
    a.yaw = a.team === "CT" ? 0 : Math.PI;
    if (!a.bot) cookT = 0;
  }

  function forwardOf(yaw: number) {
    return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  }
  function rightOf(yaw: number) {
    return { x: Math.cos(yaw), z: -Math.sin(yaw) };
  }
  function worldPan(x: number, z: number) {
    const dx = x - player.x;
    const dz = z - player.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.2) return 0;
    const r = rightOf(player.yaw);
    return Math.max(-1, Math.min(1, (dx * r.x + dz * r.z) / dist));
  }

  function chooseSite() {
    const sites = world.sites;
    if (!sites.length) return null;
    const from =
      player.team === "TR" && player.alive
        ? player
        : (actors.find((a) => a.team === "TR" && a.alive) ?? player);
    let best = sites[0]!;
    let bestScore = Infinity;
    for (const s of sites) {
      let ctNear = 0;
      for (const a of actors) {
        if (a.team === "CT" && a.alive && Math.hypot(a.x - s.x, a.z - s.z) < 16) ctNear++;
      }
      const dist = Math.hypot(from.x - s.x, from.z - s.z);
      const score = ctNear * 9 + dist * 0.18 + Math.random() * 6;
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best;
  }

  function atSite(s: BombSite, x: number, z: number) {
    if (inSite(s, x, z)) return true;
    const m = 1.1;
    return x >= s.minX - m && x <= s.maxX + m && z >= s.minZ - m && z <= s.maxZ + m;
  }

  function spineGate(x: number, z: number, tx: number, tz: number) {
    if (z > 5.4 && tz < z - 0.5) {
      if (Math.abs(x) > 2.2) return { x: 0, z };
      return { x: 0, z: Math.max(4.2, z - 4.2) };
    }
    if (z < -5.4 && tz > z + 0.5) {
      if (Math.abs(x) > 2.2) return { x: 0, z };
      return { x: 0, z: Math.min(-4.2, z + 4.2) };
    }
    if (Math.abs(x) > 7.5 && Math.abs(tx - x) > 8 && Math.abs(z) < 7 && Math.sign(x) !== Math.sign(tx || 1)) {
      return { x: 0, z };
    }
    return null;
  }

  function towardSite(s: BombSite, x: number, z: number) {
    const gate = spineGate(x, z, s.x, s.z);
    if (gate) return gate;
    if (inSite(s, x, z) || Math.hypot(x - s.x, z - s.z) < 2.1) return { x: s.x, z: s.z };
    const doorX = s.x >= 0 ? s.minX - 1.15 : s.maxX + 1.15;
    const past = s.x >= 0 ? x >= s.minX - 0.25 : x <= s.maxX + 0.25;
    if (!past) return { x: doorX, z: s.z };
    return { x: s.x, z: s.z };
  }

  function towardBomb(x: number, z: number) {
    if (Math.hypot(x - bombX, z - bombZ) < 2.2) return { x: bombX, z: bombZ };
    const gate = spineGate(x, z, bombX, bombZ);
    if (gate) return gate;
    const pad = world.sites.find((s) => atSite(s, bombX, bombZ));
    if (pad && !atSite(pad, x, z)) return towardSite(pad, x, z);
    return { x: bombX, z: bombZ };
  }

  function otherSite(site: { name: string } | null) {
    return world.sites.find((s) => s.name !== site?.name) ?? world.sites[0] ?? null;
  }

  function closestAlive(team: Team, x: number, z: number): Actor | null {
    let best: Actor | null = null;
    let bestD = Infinity;
    for (const a of actors) {
      if (!a.alive || a.team !== team) continue;
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  function lockedBot(slot: "plant" | "defuse", team: Team, x: number, z: number): Actor | null {
    let id = slot === "plant" ? lockedPlanter : lockedDefuser;
    const still = id ? actors.find((a) => a.id === id && a.bot && a.alive && a.team === team) : null;
    if (!still) {
      id = closestBot(team, x, z)?.id ?? null;
      if (slot === "plant") lockedPlanter = id;
      else lockedDefuser = id;
    }
    return id ? actors.find((a) => a.id === id) ?? null : null;
  }

  function closestBot(team: Team, x: number, z: number): Actor | null {
    let best: Actor | null = null;
    let bestD = Infinity;
    for (const a of actors) {
      if (!a.bot || !a.alive || a.team !== team) continue;
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  function belt(): WeaponId[] {
    return [player.primary, player.pistol, "knife", nadeId];
  }

  function stowNade() {
    const back = WEAPONS[lastGun]?.slot === "nade" ? player.primary : lastGun;
    cookT = 0;
    switchWeapon(player, back);
  }

  function pickSlot(id: WeaponId) {
    if (!player.alive) return;
    if (WEAPONS[id].slot === "nade" && player.nades <= 0) {
      audio.empty();
      if (WEAPONS[player.weapon].slot === "nade") stowNade();
      return;
    }
    if (WEAPONS[id].slot === "nade") {
      if (WEAPONS[player.weapon].slot !== "nade") lastGun = player.weapon;
    } else {
      lastGun = id;
    }
    if (cookT > 0 && player.weapon !== id) cookT = 0;
    switchWeapon(player, id);
  }

  function cycleSlot(dir: number) {
    const b = belt();
    let i = b.indexOf(player.weapon);
    if (i < 0) i = 0;
    for (let n = 0; n < 4; n++) {
      i = (i + dir + 4) % 4;
      const id = b[i]!;
      if (WEAPONS[id].slot === "nade" && player.nades <= 0) continue;
      pickSlot(id);
      return;
    }
  }

  function handleInventory() {
    const act = input.actions;
    if (act.justSlot === 1) pickSlot(player.primary);
    if (act.justSlot === 2) pickSlot(player.pistol);
    if (act.justSlot === 3) pickSlot("knife");
    if (act.justSlot === 4) pickSlot(nadeId);
    if (act.wheel > 0) cycleSlot(1);
    if (act.wheel < 0) cycleSlot(-1);
    if (act.knife) pickSlot("knife");
  }

  function updatePlayer(dt: number) {
    const act = input.actions;
    player.crouch = !!act.crouch;
    if (!player.alive) {
      player.respawn -= dt;
      if (cfg.mode === "tdm" && player.respawn <= 0) {
        spawnActor(player);
        player.mesh.visible = false;
      }
      return;
    }
    const wdef = WEAPONS[player.weapon];
    const wantAds = act.ads && wdef.slot !== "melee" && wdef.slot !== "nade" && !act.sprint;
    adsAmt = THREE.MathUtils.damp(adsAmt, wantAds ? 1 : 0, 12, dt);
    if (freeze > 0) {
      player.vx = 0;
      player.vz = 0;
      player.vy -= GRAV * dt;
      const held = moveCylinder(
        player.x,
        player.y,
        player.z,
        RADIUS,
        act.crouch ? 1.25 : HEIGHT,
        0,
        player.vy * dt,
        0,
        world.colliders,
      );
      player.x = held.x;
      player.y = held.y;
      player.z = held.z;
      if (held.grounded && player.vy < 0) player.vy = 0;
      if (act.justReload) startReload(player);
      return;
    }
    const speed =
      (act.crouch ? 2.6 : act.sprint && !wantAds ? 8.6 : 6.15) * wdef.speed * (wantAds ? 0.72 : 1);
    const f = forwardOf(player.yaw);
    const r = rightOf(player.yaw);
    const wishX = f.x * act.moveY + r.x * act.moveX;
    const wishZ = f.z * act.moveY + r.z * act.moveX;
    const accel = player.y > 0.08 ? 8 : 18;
    player.vx += (wishX * speed - player.vx) * Math.min(1, accel * dt);
    player.vz += (wishZ * speed - player.vz) * Math.min(1, accel * dt);
    if (act.justJump && player.y <= 0.05) player.vy = JUMP;
    player.vy -= GRAV * dt;
    const moved = moveCylinder(
      player.x,
      player.y,
      player.z,
      RADIUS,
      act.crouch ? 1.25 : HEIGHT,
      player.vx * dt,
      player.vy * dt,
      player.vz * dt,
      world.colliders,
    );
    player.x = moved.x;
    player.y = moved.y;
    player.z = moved.z;
    if (moved.grounded && player.vy < -2.4) audio.land();
    if (moved.grounded && player.vy < 0) player.vy = 0;
    const moving = Math.hypot(player.vx, player.vz) > 1.2 && moved.grounded;
    if (moving) {
      player.bob += dt * (act.sprint ? 10 : 8);
      audio.foot(!!act.sprint, 0, player.id, !!act.crouch);
    }
    if (act.justReload) startReload(player);

    if (wdef.slot === "nade" && freeze <= 0 && player.alive && player.nades > 0) {
      if (act.fire && cookT <= 0) {
        cookMax = fuseOf(player.weapon);
        cookT = cookMax;
        audio.ui();
      }
      if (cookT > 0) {
        cookT -= dt;
        vmKick = 0.05 + (1 - cookT / cookMax) * 0.14;
        const eye = new THREE.Vector3(player.x, player.y + (act.crouch ? 1.15 : 1.58), player.z);
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        if (cookT <= 0) {
          player.nades = 0;
          cookT = 0;
          explode({
            kind: player.weapon,
            x: player.x,
            y: player.y + 0.45,
            z: player.z,
            vx: 0,
            vy: 0,
            vz: 0,
            fuse: 0,
            mesh: new THREE.Group(),
            team: player.team,
            srcId: player.id,
          });
          stowNade();
        } else if (!act.fire) {
          player.nades--;
          throwNade(player, eye, dir, player.weapon, Math.max(0.18, cookT));
          cookT = 0;
          audio.whoosh();
          if (player.nades <= 0) stowNade();
        }
      }
    } else {
      if (cookT > 0) cookT = 0;
      if (wdef.slot === "nade" && player.nades <= 0) {
        stowNade();
      } else if (act.fire && (wdef.automatic || act.justFire) && freeze <= 0) {
        const eye = new THREE.Vector3(player.x, player.y + (act.crouch ? 1.15 : 1.58), player.z);
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        fire(player, eye, dir);
      }
    }

    siteHint = "";
    plantProg = Math.max(0, plantProg);
    defuseProg = Math.max(0, defuseProg);
    pickProg = Math.max(0, pickProg);
    if (cfg.mode === "demolition" && freeze <= 0 && roundResetting <= 0) {
      if (bombPlanted) {
        plantProg = 0;
        pickProg = 0;
      }
      if (!bombPlanted && bombLoose && player.team === "TR" && Math.hypot(player.x - bombX, player.z - bombZ) < 1.5) {
        siteHint = T.pickBomb;
        if (act.use && Math.hypot(player.vx, player.vz) < 1.3) {
          pickProg += dt;
          if (pickProg >= PICK_TIME) {
            bombLoose = false;
            carrier = null;
            pickProg = 0;
          }
        } else pickProg = 0;
      } else {
        pickProg = 0;
      }
      if (!bombPlanted && player.team === "TR" && player.alive) {
        const site = world.sites.find((s) => inSite(s, player.x, player.z));
        if (site) {
          siteHint = `${T.holdPlant} ${site.name}`;
          if (act.use && Math.hypot(player.vx, player.vz) < 1.3) {
            plantProg += dt;
            if (plantProg >= PLANT_TIME) {
              bombPlanted = true;
              bombTime = BOMB_FUSE;
              bombX = player.x;
              bombZ = player.z;
              plantSite = site;
              plantProg = 0;
              carrier = null;
              bombLoose = false;
              bombWarn = false;
              announce(T.planted, 2.2, "bomb", "TR");
              audio.plant();
              matchTime = Math.max(matchTime, BOMB_FUSE);
              for (const a of actors) {
                if (a.alive && a.team === "CT") a.spawnProt = Math.max(a.spawnProt, 1.65);
              }
            }
          } else plantProg = 0;
        } else {
          plantProg = 0;
          if (!plantSite) plantSite = chooseSite();
        }
      }
      if (bombPlanted && player.team === "CT") {
        if (Math.hypot(player.x - bombX, player.z - bombZ) < 1.6) {
          siteHint = T.holdDefuse;
          if (act.use && Math.hypot(player.vx, player.vz) < 1.3) {
            defuseProg += dt;
            if (defuseProg >= DEFUSE_TIME) {
              defuseWin();
            }
          } else defuseProg = 0;
        } else defuseProg = 0;
      }
    }
  }

  function updateBots(dt: number) {
    if (!pendingWin) kitFrac = 0;
    for (const b of actors) {
      if (!b.bot) continue;
      if (!b.alive) {
        b.respawn -= dt;
        if (cfg.mode === "tdm" && b.respawn <= 0) spawnActor(b);
        continue;
      }
      b.spawnProt = freeze > 0 ? b.spawnProt : Math.max(0, b.spawnProt - dt);
      b.fireCd = Math.max(0, b.fireCd - dt);
      b.flashT = Math.max(0, b.flashT - dt);
      if (b.reloadT > 0) {
        b.reloadT -= dt;
        if (b.reloadT <= 0) finishReload(b);
      }
      recoverRecoil(b, dt);
      if (freeze > 0) {
        b.vx = 0;
        b.vz = 0;
        b.vy -= GRAV * dt;
        const held = moveCylinder(b.x, b.y, b.z, RADIUS, HEIGHT, 0, b.vy * dt, 0, world.colliders);
        b.x = held.x;
        b.y = held.y;
        b.z = held.z;
        if (held.grounded && b.vy < 0) b.vy = 0;
        b.mesh.position.set(b.x, b.y, b.z);
        continue;
      }
      const enemies = actors.filter((a) => a.alive && a.team !== b.team);
      let target: Actor | null = null;
      let best = 1e9;
      for (const e of enemies) {
        const d = Math.hypot(e.x - b.x, e.z - b.z);
        const see = los(b.x, b.y + 1.5, b.z, e.x, e.y + 1.45, e.z);
        const onKit = bombPlanted && e.team === "CT" && e.plantT > 0.12;
        if (onKit && d > 2.55) continue;
        if (see && d < best) {
          best = d;
          target = e;
        }
      }

      let goalX = b.tx;
      let goalZ = b.tz;
      let doingObj = false;
      let rushing = false;
      let commit = false;

      if (cfg.mode === "demolition" && freeze <= 0) {
        if (!plantSite) plantSite = chooseSite();
        const site = plantSite ?? world.sites[0] ?? null;
        rushing = true;
        const execute = matchTime < ROUND_TIME - 12;
        const playerPlanting = player.alive && player.team === "TR" && plantProg > 0.2;
        const playerDefusing = player.alive && player.team === "CT" && defuseProg > 0.2;

        if (!bombPlanted && bombLoose && b.team === "TR") {
          const contest =
            player.alive && player.team === "TR" && Math.hypot(player.x - bombX, player.z - bombZ) < 2.4;
          goalX = bombX;
          goalZ = bombZ;
          if (!contest && Math.hypot(b.x - bombX, b.z - bombZ) < 1.6) {
            b.plantT += dt;
            b.vx *= 0.15;
            b.vz *= 0.15;
            if (b.plantT >= PICK_TIME) {
              bombLoose = false;
              carrier = null;
              b.plantT = 0;
            }
          }
        } else if (!bombPlanted && b.team === "TR" && site) {
          const planter = lockedBot("plant", "TR", site.x, site.z);
          const isPlanter = !playerPlanting && planter === b;
          if (isPlanter) {
            const aim = towardSite(site, b.x, b.z);
            goalX = aim.x;
            goalZ = aim.z;
            const here = atSite(site, b.x, b.z);
            const ctOnSite = actors.some(
              (a) => a.alive && a.team === "CT" && Math.hypot(a.x - site.x, a.z - site.z) < 6.5,
            );
            if (here && (!ctOnSite || execute)) {
              doingObj = true;
              b.plantT += dt;
              b.vx *= 0.12;
              b.vz *= 0.12;
              if (b.plantT >= PLANT_TIME) {
                bombPlanted = true;
                bombTime = BOMB_FUSE;
                bombX = THREE.MathUtils.clamp(b.x, site.minX + 0.4, site.maxX - 0.4);
                bombZ = THREE.MathUtils.clamp(b.z, site.minZ + 0.4, site.maxZ - 0.4);
                plantSite = site;
                b.plantT = 0;
                carrier = null;
                bombLoose = false;
                bombWarn = false;
                announce(T.planted, 2.2, "bomb", "TR");
                audio.plant();
                matchTime = Math.max(matchTime, BOMB_FUSE);
                for (const a of actors) {
                  if (a.alive && a.team === "CT") a.spawnProt = Math.max(a.spawnProt, 1.65);
                }
              }
            } else if (!here) {
              commit = true;
              b.plantT = 0;
            } else {
              b.plantT = 0;
            }
          } else {
            const ang = (b.wp % 8) * 0.9;
            goalX = site.x + Math.cos(ang) * 6.2;
            goalZ = site.z + Math.sin(ang) * 6.2;
            if (Math.hypot(b.x - site.x, b.z - site.z) > 9) commit = true;
            b.plantT = 0;
          }
        } else if (bombPlanted && b.team === "TR") {
          const ang = (b.wp % 8) * 0.85;
          const rad = 6.2 + (b.wp % 3) * 1.1;
          goalX = bombX + Math.cos(ang) * rad;
          goalZ = bombZ + Math.sin(ang) * rad;
          const dHold = Math.hypot(b.x - bombX, b.z - bombZ);
          if (dHold > 8.8 || dHold < 5.2) commit = true;
        } else if (bombPlanted && b.team === "CT") {
          const aim = towardBomb(b.x, b.z);
          const d = Math.hypot(b.x - bombX, b.z - bombZ);
          const kitter = closestBot("CT", bombX, bombZ);
          if (!playerDefusing && kitter === b && d < 2.8) {
            goalX = bombX;
            goalZ = bombZ;
            doingObj = true;
            b.plantT += dt;
            kitFrac = Math.max(kitFrac, b.plantT / DEFUSE_TIME);
            b.vx *= 0.08;
            b.vz *= 0.08;
            if (b.plantT >= DEFUSE_TIME) defuseWin();
          } else {
            goalX = aim.x;
            goalZ = aim.z;
            commit = true;
            if (d > 3.2) b.plantT = 0;
            if (kitter && kitter !== b && kitter.plantT > 0.2 && d < 10) {
              const ang = (b.wp % 8) * 0.9;
              goalX = bombX + Math.cos(ang) * 5.8;
              goalZ = bombZ + Math.sin(ang) * 5.8;
              commit = false;
            }
          }
        } else if (!bombPlanted && b.team === "CT" && world.sites.length) {
          const defaulting = matchTime > ROUND_TIME - 10.5;
          if (defaulting) {
            goalX = b.wp % 2 === 0 ? -2.2 : 2.2;
            goalZ = 13.2;
            if (Math.hypot(b.x - goalX, b.z - goalZ) > 1.8) commit = true;
          } else {
            const s = world.sites[b.wp % world.sites.length]!;
            const aim = towardSite(s, b.x, b.z);
            goalX = aim.x;
            goalZ = aim.z;
            if (!atSite(s, b.x, b.z)) commit = true;
          }
        }

        if (!doingObj && b.stuck > 0.32 && world.waypoints.length && Math.hypot(goalX - b.x, goalZ - b.z) > 2.2) {
          const gx = goalX;
          const gz = goalZ;
          let best = world.waypoints[0]!;
          let bd = Infinity;
          for (const wp of world.waypoints) {
            const toMe = Math.hypot(wp.x - b.x, wp.z - b.z);
            if (toMe < 2.2) continue;
            const score = Math.hypot(wp.x - gx, wp.z - gz) + toMe * 0.22;
            if (score < bd) {
              bd = score;
              best = wp;
            }
          }
          goalX = best.x;
          goalZ = best.z;
        }
      }

      if (target && !doingObj && !commit) {
        b.seeT += dt;
        b.tx = target.x;
        b.tz = target.z;
        const dx = target.x - b.x;
        const dz = target.z - b.z;
        const wantYaw = Math.atan2(-dx, -dz);
        let dyaw = wantYaw - b.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        b.yaw += dyaw * Math.min(1, (2.4 + b.skill * 4) * dt);
        b.pitch = clamp(-Math.atan2(target.y + 1.4 - (b.y + 1.5), Math.hypot(dx, dz)), -0.6, 0.6);
        if (b.stuck > 0.35) b.strafeDir *= -1;
        const r = rightOf(b.yaw);
        const dist = Math.hypot(dx, dz);
        if (rushing) {
          const gdx = goalX - b.x;
          const gdz = goalZ - b.z;
          const glen = Math.hypot(gdx, gdz) || 1;
          const speed = bombPlanted && b.team === "TR" ? 3.6 : bombPlanted && b.team === "CT" ? 6.15 : 5.5;
          const hold = glen < 1.15 ? 0 : 1;
          const strafe = glen < 4 ? 0.08 : glen < 8 ? 0.18 : 0.48;
          b.vx += ((gdx / glen) * speed * hold + r.x * b.strafeDir * strafe - b.vx) * Math.min(1, 10 * dt);
          b.vz += ((gdz / glen) * speed * hold + r.z * b.strafeDir * strafe - b.vz) * Math.min(1, 10 * dt);
        } else {
          const hold = dist < 7 ? -0.15 : dist < 13 ? 0.05 : 1;
          const f = forwardOf(b.yaw);
          const speed = dist < 6 ? 2.4 : 5.2;
          const wishX = f.x * hold + r.x * b.strafeDir * 0.7;
          const wishZ = f.z * hold + r.z * b.strafeDir * 0.7;
          b.vx += (wishX * speed - b.vx) * Math.min(1, 10 * dt);
          b.vz += (wishZ * speed - b.vz) * Math.min(1, 10 * dt);
        }
        if (dist < 2.1 && b.weapon !== "knife") switchWeapon(b, "knife");
        else if (dist > 3.4 && b.weapon === "knife") switchWeapon(b, b.primary);
        const flashed = b.flashT > 0.22;
        if (flashed) b.seeT = 0;
        if (
          !flashed &&
          b.nades > 0 &&
          dist > 9 &&
          dist < 16.5 &&
          b.seeT > 0.45 &&
          freeze <= 0 &&
          b.fireCd <= 0 &&
          !(bombPlanted && target.team === "CT" && target.plantT > 0.1)
        ) {
          const origin = new THREE.Vector3(b.x, b.y + 1.5, b.z);
          const dir = new THREE.Vector3(target.x - b.x, 0.22, target.z - b.z).normalize();
          const kind: WeaponId = Math.random() < 0.48 ? "flash" : "he";
          throwNade(b, origin, dir, kind);
          b.nades = 0;
          b.fireCd = 2.4;
          audio.whoosh();
        }
        const burstOk = WEAPONS[b.weapon].automatic ? b.shotI % 5 !== 4 : true;
        if (
          !flashed &&
          b.seeT > 0.18 / b.skill &&
          dist < WEAPONS[b.weapon].range * 0.75 &&
          b.reloadT <= 0 &&
          freeze <= 0 &&
          burstOk
        ) {
          const origin = new THREE.Vector3(b.x, b.y + 1.5, b.z);
          const dir = new THREE.Vector3(target.x - b.x, target.y + 1.4 - origin.y, target.z - b.z).normalize();
          dir.x += rand(-1, 1) * (1 - b.skill) * 0.08;
          dir.y += rand(-1, 1) * (1 - b.skill) * 0.05;
          dir.z += rand(-1, 1) * (1 - b.skill) * 0.08;
          dir.normalize();
          fire(b, origin, dir);
        }
      } else if (!doingObj) {
        b.seeT = Math.max(0, b.seeT - dt);
        if (!commit) {
          const wps = world.waypoints;
          if (goalX === b.tx && goalZ === b.tz && wps.length) {
            const wp = wps[b.wp % wps.length]!;
            goalX = wp.x;
            goalZ = wp.z;
            if (Math.hypot(wp.x - b.x, wp.z - b.z) < 1.4) b.wp = (b.wp + 1 + Math.floor(Math.random() * 3)) % wps.length;
          }
        }
        const dx = goalX - b.x;
        const dz = goalZ - b.z;
        const wantYaw = Math.atan2(-dx, -dz);
        let dyaw = wantYaw - b.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        b.yaw += dyaw * Math.min(1, 2.5 * dt);
        if (!commit) {
          const f = forwardOf(b.yaw);
          const rushSpd = rushing ? 5.6 : 4.8;
          b.vx += (f.x * rushSpd - b.vx) * Math.min(1, 8 * dt);
          b.vz += (f.z * rushSpd - b.vz) * Math.min(1, 8 * dt);
        }
      }
      b.vy -= GRAV * dt;
      if (commit && !doingObj) {
        const dxg = goalX - b.x;
        const dzg = goalZ - b.z;
        const dg = Math.hypot(dxg, dzg);
        if (dg > 0.05) {
          const sp = dg < 1.7 ? 3.6 : 6.7;
          b.vx += ((dxg / dg) * sp - b.vx) * Math.min(1, 16 * dt);
          b.vz += ((dzg / dg) * sp - b.vz) * Math.min(1, 16 * dt);
        }
        if (bombPlanted && b.team === "CT" && Math.abs(b.x) < 3.4 && Math.abs(b.z) > 4.4) {
          if (bombZ < b.z - 1) {
            b.vx *= 0.35;
            b.vz = -6.8;
          } else if (bombZ > b.z + 1) {
            b.vx *= 0.35;
            b.vz = 6.8;
          }
        }
        if (bombPlanted && b.team === "CT" && Math.abs(b.z - bombZ) < 3.8 && Math.abs(bombX - b.x) > 3.2) {
          b.vz *= 0.4;
          b.vx = Math.sign(bombX - b.x) * 6.8;
        }
        if (b.stuck > 0.18) {
          const r = rightOf(Math.atan2(-dxg, -dzg));
          b.vx += r.x * b.strafeDir * 7.2;
          b.vz += r.z * b.strafeDir * 7.2;
          if (b.stuck > 0.35) {
            const inv = dg > 0.05 ? 1 / dg : 1;
            b.x += r.x * b.strafeDir * 1.2 + dxg * inv * 0.4;
            b.z += r.z * b.strafeDir * 1.2 + dzg * inv * 0.4;
            if (b.y < 0.2) b.vy = 5.6;
            b.stuck = 0.05;
            b.strafeDir *= -1;
          }
        }
      }
      const beforeX = b.x;
      const beforeZ = b.z;
      const moved = moveCylinder(b.x, b.y, b.z, RADIUS, HEIGHT, b.vx * dt, b.vy * dt, b.vz * dt, world.colliders);
      b.x = moved.x;
      b.y = moved.y;
      b.z = moved.z;
      if (moved.grounded && b.vy < 0) b.vy = 0;
      if (moved.grounded && Math.hypot(b.vx, b.vz) > 1.2) {
        const dist = Math.hypot(b.x - player.x, b.z - player.z);
        audio.foot(rushing, dist, b.id, false, worldPan(b.x, b.z));
      }
      if (Math.hypot(b.vx, b.vz) > 1.4 && Math.hypot(b.x - beforeX, b.z - beforeZ) < 0.045) {
        b.stuck += dt;
        if (b.stuck > 0.35) b.strafeDir *= -1;
      } else if (Math.hypot(b.x - beforeX, b.z - beforeZ) < 0.002) {
        b.stuck += dt;
        if (b.stuck > 0.45) b.strafeDir *= -1;
      } else b.stuck = 0;
      if (bombPlanted && b.team === "CT" && commit && !doingObj && Math.hypot(b.x - beforeX, b.z - beforeZ) < 0.04) {
        const nx = bombX - b.x;
        const nz = bombZ - b.z;
        const nl = Math.hypot(nx, nz) || 1;
        b.x += (nx / nl) * 1.5;
        b.z += (nz / nl) * 1.5;
        const unstick = moveCylinder(b.x, b.y, b.z, RADIUS, HEIGHT, (nx / nl) * 0.5, 0.02, (nz / nl) * 0.5, world.colliders);
        b.x = unstick.x;
        b.y = unstick.y;
        b.z = unstick.z;
      }
      b.bob += Math.hypot(b.vx, b.vz) * dt;
      b.mesh.position.set(b.x, b.y, b.z);
      b.mesh.rotation.y = b.yaw + Math.PI;
      const legL = b.mesh.getObjectByName("legL");
      const legR = b.mesh.getObjectByName("legR");
      if (legL && legR) {
        legL.rotation.x = Math.sin(b.bob * 8) * 0.4;
        legR.rotation.x = Math.cos(b.bob * 8) * 0.4;
      }
    }
  }

  function living(team: Team) {
    return actors.filter((a) => a.team === team && a.alive).length;
  }

  function defuseWin() {
    if (ended || roundResetting > 0 || pendingWin) return;
    bombPlanted = false;
    defuseProg = 0;
    kitFrac = 1;
    announce(T.defused, 2.6, "defuse", "CT");
    audio.plant();
    pendingWin = "CT";
    pendingWinT = 2.55;
  }

  function endRound(winner: Team) {
    if (roundResetting > 0 || ended) return;
    if (winner === "CT") roundsCT++;
    else roundsTR++;
    const top = actors.slice().sort((a, b) => b.rkills - a.rkills || b.kills - a.kills)[0];
    roundMvp = top && top.rkills > 0 ? top.name : "";
    announce(winner === "CT" ? T.ctWin : T.trWin, 2.15, "round", winner);
    onEvent({ type: "roundEnd", winner });
    money = Math.min(MONEY_CAP, money + (winner === cfg.team ? 2400 : 1400));
    if (roundsCT >= ROUNDS_TO_WIN || roundsTR >= ROUNDS_TO_WIN) {
      matchOver = roundsCT === roundsTR ? "draw" : roundsCT > roundsTR ? "CT" : "TR";
      matchOverT = 4.5;
      return;
    }
    matchPoint = roundsCT === ROUNDS_TO_WIN - 1 || roundsTR === ROUNDS_TO_WIN - 1;
    roundResetting = 5.2;
  }

  function detonate() {
    burst(bombX, 0.45, bombZ, 56, 1, 0.38, 0.1, 10);
    audio.boom(worldPan(bombX, bombZ));
    trauma = 1;
    for (const a of actors) {
      if (!a.alive) continue;
      const d = Math.hypot(a.x - bombX, a.z - bombZ);
      if (d > BLAST_R) continue;
      const fall = d <= 2.6 ? 1 : Math.max(0, 1 - (d - 2.6) / (BLAST_R - 2.6));
      if (fall * 220 < 35) continue;
      a.hp = 0;
      a.alive = false;
      a.deaths++;
      a.mesh.rotation.x = 1.15;
      a.mesh.position.y = 0.12;
      burst(a.x, a.y + 1.05, a.z, 16, 1, 0.28, 0.06, 3);
      if (a === player) {
        hurt = 1;
        trauma = 1;
      }
    }
    endRound("TR");
  }

  function finish(winner: Team | "draw") {
    if (ended) return;
    ended = true;
    paused = true;
    input.unlock();
    const rows = getRows();
    const mvp = rows.slice().sort((a, b) => b.kills - a.kills || b.assists - a.assists)[0]?.name ?? player.name;
    const gpWin = winner === cfg.team ? 400 : winner === "draw" ? 180 : 120;
    const gpKill = player.kills * 50;
    const gpAssist = player.assists * 20;
    const gpBonus = mvp === player.name ? 80 : 0;
    const gp = gpWin + gpKill + gpAssist + gpBonus;
    onEvent({
      type: "matchEnd",
      winner,
      rows,
      playerKills: player.kills,
      playerDeaths: player.deaths,
      playerAssists: player.assists,
      mvp,
      gp,
      gpWin,
      gpKill,
      gpAssist,
      gpBonus,
      scoreCT: cfg.mode === "tdm" ? scoreCT : roundsCT,
      scoreTR: cfg.mode === "tdm" ? scoreTR : roundsTR,
    });
  }

  function getRows(): ScoreRow[] {
    return actors.map((a) => ({
      id: a.id,
      name: a.name,
      team: a.team,
      kills: a.kills,
      deaths: a.deaths,
      assists: a.assists,
      ping: a.ping,
      bot: a.bot,
      alive: a.alive,
      rkills: a.rkills,
    }));
  }

  function resetRound() {
    round++;
    freeze = FREEZE_COUNT + FREEZE_GO;
    announce("5", 1.2, "count");
    bombWarn = false;
    matchTime = ROUND_TIME;
    bombPlanted = false;
    bombTime = 0;
    plantProg = 0;
    defuseProg = 0;
    pickProg = 0;
    bombLoose = false;
    carrier = null;
    siteHint = "";
    firstBlood = false;
    streak = 0;
    lockedPlanter = null;
    lockedDefuser = null;
    pendingWin = null;
    pendingWinT = 0;
    kitFrac = 0;
    clearWorldFX();
    for (const a of actors) {
      spawnActor(a);
      a.rkills = 0;
    }
    player.mesh.visible = false;
    if (cfg.mode === "demolition") {
      plantSite = chooseSite();
    }
    roundResetting = 0;
  }

  function updateMatch(dt: number) {
    if (ended) return;
    if (pendingWin) {
      pendingWinT -= dt;
      if (pendingWinT <= 0) {
        const w = pendingWin;
        pendingWin = null;
        endRound(w);
      }
      return;
    }
    if (matchOver) {
      matchOverT -= dt;
      if (matchOverT <= 2.25 && bannerKind !== "match") {
        announce(T.matchOver, 2.25, "match", matchOver === "draw" ? null : matchOver);
      }
      if (matchOverT <= 0) {
        const w = matchOver;
        matchOver = null;
        finish(w);
      }
      return;
    }
    if (roundResetting > 0) {
      roundResetting -= dt;
      if (roundResetting <= 0) resetRound();
      return;
    }
    if (freeze > 0) {
      if (live) {
        const prev = freeze;
        freeze = Math.max(0, freeze - dt);
        const nowN = Math.ceil(freeze - FREEZE_GO);
        const prevN = Math.ceil(prev - FREEZE_GO);
        if (nowN !== prevN && nowN >= 1 && nowN <= 5) announce(String(nowN), 1.2, "count");
        if (prev > FREEZE_GO && freeze <= FREEZE_GO) {
          if (matchPoint) {
            const mpTeam =
              roundsCT >= ROUNDS_TO_WIN - 1 && roundsTR < ROUNDS_TO_WIN - 1
                ? "CT"
                : roundsTR >= ROUNDS_TO_WIN - 1 && roundsCT < ROUNDS_TO_WIN - 1
                  ? "TR"
                  : null;
            announce(T.matchPoint, 1.9, "mission", mpTeam);
          } else {
            announce(T.mission, 1.85, "mission");
          }
          if (cfg.mode === "demolition" && !plantSite) plantSite = chooseSite();
        }
      }
      return;
    }
    matchTime -= dt;
    if (bombPlanted) {
      bombTime -= dt;
      const interval = bombTime < 10 ? 0.25 : bombTime < 20 ? 0.55 : 1;
      if (Math.floor(bombTime / interval) !== Math.floor((bombTime + dt) / interval)) audio.beep();
      if (!bombWarn && bombTime < 10) {
        bombWarn = true;
        announce(T.tenSeconds, 1.6, "bomb");
      }
      if (bombTime <= 0) {
        detonate();
      }
    }
    if (cfg.mode === "tdm") {
      if (scoreCT >= 40 || scoreTR >= 40 || matchTime <= 0) {
        finish(scoreCT === scoreTR ? "draw" : scoreCT > scoreTR ? "CT" : "TR");
      }
    } else {
      if (living("CT") === 0) endRound("TR");
      else if (living("TR") === 0 && !bombPlanted) endRound("CT");
      else if (matchTime <= 0 && !bombPlanted) endRound("CT");
    }
  }

  function updateNades(dt: number) {
    for (let i = nades.length - 1; i >= 0; i--) {
      const n = nades[i]!;
      n.vy -= GRAV * dt;
      let nx = n.x + n.vx * dt;
      let ny = n.y + n.vy * dt;
      let nz = n.z + n.vz * dt;
      const hit = raycastAABB(n.x, n.y, n.z, Math.sign(n.vx) || 0, Math.sign(n.vy) || 0, Math.sign(n.vz) || 0, 0.4, world.colliders);
      const body = moveCylinder(n.x, n.y, n.z, 0.08, 0.16, n.vx * dt, n.vy * dt, n.vz * dt, world.colliders);
      nx = body.x;
      ny = body.y;
      nz = body.z;
      if (body.hit) {
        n.vx *= -0.48;
        n.vz *= -0.48;
        n.vy *= 0.32;
      }
      if (body.grounded) {
        n.vy = Math.abs(n.vy) > 1.2 ? Math.abs(n.vy) * 0.38 : 0;
        n.vx *= 0.72;
        n.vz *= 0.72;
      }
      n.x = nx;
      n.y = Math.max(0.08, ny);
      n.z = nz;
      n.fuse -= dt;
      n.mesh.position.set(n.x, n.y, n.z);
      n.mesh.rotation.x += dt * 9;
      n.mesh.rotation.z += dt * 6;
      if (n.fuse <= 0) {
        explode(n);
        nades.splice(i, 1);
      }
      void hit;
    }
    for (let i = smokes.length - 1; i >= 0; i--) {
      smokes[i]!.life -= dt;
      if (smokes[i]!.life <= 0) {
        scene.remove(smokes[i]!.mesh);
        smokes[i]!.mesh.geometry.dispose();
        (smokes[i]!.mesh.material as THREE.Material).dispose();
        smokes.splice(i, 1);
      } else {
        const s = smokes[i]!;
        const mat = s.mesh.material as THREE.MeshBasicMaterial;
        const fade = s.life < 3 ? s.life / 3 : 1;
        mat.opacity = 0.78 * fade;
        s.mesh.scale.setScalar(1 + (1 - fade) * 0.15);
      }
    }
  }

  function lookAt(name: string, team: Team | null, hp: number) {
    lookingName = name;
    lookingTeam = team;
    lookingHp = hp;
  }

  const hud: HudSnapshot = {
    hp: 100,
    armor: 100,
    ammo: 30,
    reserve: 90,
    weapon: cfg.loadout.primary,
    weaponName: WEAPONS[cfg.loadout.primary].name,
    yaw: 0,
    x: 0,
    z: 0,
    ads: false,
    reloading: false,
    planting: 0,
    defusing: 0,
    alive: true,
    respawnIn: 0,
    timer: matchTime,
    scoreCT: 0,
    scoreTR: 0,
    round: 1,
    roundsCT: 0,
    roundsTR: 0,
    hitmarker: 0,
    headshot: false,
    hurt: 0,
    flash: 0,
    killMsg: "",
    killBy: false,
    killGun: "",
    announcer: "",
    streak: 0,
    bombPlanted: false,
    bombTime: 0,
    siteHint: "",
    allies: [],
    enemies: [],
    lookingName: "",
    lookingTeam: null,
    lookingHp: 0,
    paused: false,
    locked: false,
    mouseLocked: false,
    mode: cfg.mode,
    map: cfg.map,
    team: cfg.team,
    freeze: FREEZE_COUNT + FREEZE_GO,
    bombX: 0,
    bombZ: 0,
    bombVisible: false,
    money: 4000,
    bloom: 0,
    hurtDir: 0,
    sites: world.sites.map((s) => ({ name: s.name, x: s.x, z: s.z })),
    bannerKind: "count",
    bannerTeam: null,
    kits: WEAPONS[cfg.loadout.primary].kits.slice(),
    reloadFrac: 0,
    carrying: false,
    roundsToWin: cfg.mode === "tdm" ? 0 : ROUNDS_TO_WIN,
    bombSite: "",
    smoke: 0,
    cooking: 0,
    killerHp: 0,
    roundOver: false,
    roundMvp: "",
    nades: 1,
    primary: cfg.loadout.primary,
    pistol: cfg.loadout.pistol,
    nade: cfg.loadout.nade,
  };

  function writeHud() {
    const w = WEAPONS[player.weapon];
    hud.hp = Math.max(0, player.hp);
    hud.armor = Math.max(0, player.armor);
    hud.ammo = player.mag;
    hud.reserve = player.reserve;
    hud.weapon = player.weapon;
    hud.weaponName = w.name;
    hud.yaw = player.yaw;
    hud.x = player.x;
    hud.z = player.z;
    hud.ads = adsAmt > 0.6;
    hud.reloading = player.reloadT > 0;
    hud.planting = plantProg / PLANT_TIME;
    hud.defusing = Math.max(defuseProg / DEFUSE_TIME, kitFrac);
    hud.alive = player.alive;
    hud.respawnIn = player.respawn;
    hud.timer = Math.max(0, bombPlanted ? bombTime : matchTime);
    hud.scoreCT = cfg.mode === "tdm" ? scoreCT : roundsCT;
    hud.scoreTR = cfg.mode === "tdm" ? scoreTR : roundsTR;
    hud.round = round;
    hud.roundsCT = roundsCT;
    hud.roundsTR = roundsTR;
    hud.hitmarker = hitmarker;
    hud.headshot = headshotMk;
    hud.hurt = hurt;
    hud.flash = flash;
    hud.killMsg = killMsgT > 0 ? killMsg : "";
    hud.killBy = killBy && killMsgT > 0;
    hud.killGun = killMsgT > 0 || !player.alive ? killGun : "";
    hud.killerHp = 0;
    if (!player.alive && player.lastHitBy) {
      const killer = actors.find((a) => a.id === player.lastHitBy);
      if (killer) {
        hud.killMsg = killer.name;
        hud.killBy = true;
        hud.killGun = WEAPONS[killer.weapon].name;
        hud.killerHp = Math.max(0, killer.alive ? killer.hp : 0);
      }
    }
    hud.announcer = announcerT > 0 ? announcer : "";
    hud.bannerKind = announcerT > 0 ? bannerKind : "";
    hud.bannerTeam = bannerTeam;
    hud.streak = streak;
    hud.bombPlanted = bombPlanted;
    hud.bombTime = bombTime;
    hud.siteHint = siteHint;
    hud.allies = actors
      .filter((a) => a !== player && a.bot && a.team === player.team && a.alive)
      .map((a) => ({ x: a.x, z: a.z, yaw: a.yaw }));
    hud.enemies = actors
      .filter((a) => a.team !== player.team && a.alive)
      .map((a) => ({
        x: a.x,
        z: a.z,
        vis: los(player.x, player.y + 1.5, player.z, a.x, a.y + 1.4, a.z),
      }));
    hud.lookingName = lookingName;
    hud.lookingTeam = lookingTeam;
    hud.lookingHp = lookingHp;
    hud.paused = paused;
    hud.locked = captured;
    hud.mouseLocked = input.locked;
    hud.mode = cfg.mode;
    hud.map = cfg.map;
    hud.team = cfg.team;
    hud.freeze = Math.max(0, freeze);
    const bombOnMap = bombPlanted || bombLoose;
    hud.bombX = bombOnMap ? bombX : 0;
    hud.bombZ = bombOnMap ? bombZ : 0;
    hud.bombVisible = bombOnMap;
    hud.money = money;
    hud.bloom = player.recoilP;
    hud.hurtDir = hurtDir;
    hud.sites = world.sites.map((s) => ({ name: s.name, x: s.x, z: s.z }));
    hud.kits = w.kits;
    hud.reloadFrac = player.reloadT > 0 ? 1 - player.reloadT / Math.max(0.05, w.reload) : 0;
    hud.carrying = cfg.mode === "demolition" && player.team === "TR" && player.alive && !bombPlanted;
    hud.roundsToWin = cfg.mode === "tdm" ? 0 : ROUNDS_TO_WIN;
    hud.bombSite = player.team === "TR" && !bombPlanted && plantSite ? plantSite.name : "";
    hud.cooking = cookT > 0 ? 1 - cookT / cookMax : 0;
    let smokeAmt = 0;
    for (const s of smokes) {
      const d = Math.hypot(player.x - s.x, player.z - s.z);
      if (d < s.r * 0.92) smokeAmt = Math.max(smokeAmt, 0.84 * (1 - d / (s.r * 0.92)));
    }
    hud.smoke = smokeAmt;
    hud.roundOver = roundResetting > 0 || !!matchOver;
    hud.roundMvp = roundResetting > 0 ? roundMvp : "";
    hud.nades = player.nades;
    hud.primary = player.primary;
    hud.pistol = player.pistol;
    hud.nade = nadeId;
  }

  function update(dt: number) {
    const look = input.actions;
    if (look.justPause && player.alive) {
      paused = !paused;
      if (paused) input.unlock();
    }
    if (paused || ended) {
      writeHud();
      return;
    }
    if (!player.alive) {
      const killer = actors.find((a) => a.id === player.lastHitBy && a.alive);
      if (killer) {
        const dx = killer.x - player.x;
        const dz = killer.z - player.z;
        const wantYaw = Math.atan2(-dx, -dz);
        let dyaw = wantYaw - player.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        player.yaw += dyaw * Math.min(1, 2.6 * dt);
        const wantPitch = -Math.atan2(killer.y + 1.45 - (player.y + 0.78), Math.hypot(dx, dz));
        player.pitch += (wantPitch - player.pitch) * Math.min(1, 2.6 * dt);
      }
    }
    player.fireCd = Math.max(0, player.fireCd - dt);
    if (freeze <= 0) player.spawnProt = Math.max(0, player.spawnProt - dt);
    if (player.reloadT > 0) {
      player.reloadT -= dt;
      if (player.reloadT <= 0) finishReload(player);
    }
    recoverRecoil(player, dt);
    hitmarker = Math.max(0, hitmarker - dt);
    hurt = Math.max(0, hurt - dt * 0.72);
    flash = Math.max(0, flash - dt * 0.28);
    killMsgT = Math.max(0, killMsgT - dt);
    announcerT = Math.max(0, announcerT - dt);
    trauma = Math.max(0, trauma - dt * 1.8);
    vmKick = Math.max(0, vmKick - dt * 4);
    vmDrop = Math.max(0, vmDrop - dt * 2.2);
    const cyc = WEAPONS[player.weapon].reloadStyle;
    const cycDur = cyc === "bolt" ? 0.55 : cyc === "tube" ? 0.38 : 0.16;
    vmCycle = Math.max(0, vmCycle - dt / cycDur);
    fovKick = Math.max(0, fovKick - dt * 8);

    handleInventory();
    updatePlayer(dt);
    if (freeze <= 0 && roundResetting <= 0 && !pendingWin && !matchOver) {
      updateBots(dt);
      updateNades(dt);
    } else {
      for (const a of actors) {
        if (!a.bot) continue;
        a.mesh.position.set(a.x, a.y, a.z);
        a.mesh.rotation.y = a.yaw + Math.PI;
      }
    }
    updateMatch(dt);
    fx.update(dt);

    for (let i = tracers.length - 1; i >= 0; i--) {
      tracers[i]!.life -= dt;
      const mat = tracers[i]!.line.material as THREE.LineBasicMaterial;
      mat.opacity = Math.max(0, tracers[i]!.life * 10);
      if (tracers[i]!.life <= 0) {
        scene.remove(tracers[i]!.line);
        tracers[i]!.line.geometry.dispose();
        mat.dispose();
        tracers.splice(i, 1);
      }
    }

    const mz = viewGun.getObjectByName("muzzle") as THREE.Mesh | undefined;
    if (mz) {
      const mat = mz.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, mat.opacity - dt * 16);
      mz.scale.setScalar(0.7 + mat.opacity * 2.2);
    }

    if (bombMesh) {
      const led = bombMesh.getObjectByName("led") as THREE.Mesh | undefined;
      const light = bombMesh.getObjectByName("bombLight") as THREE.PointLight | undefined;
      const pulse = bombPlanted
        ? bombTime < 10
          ? Math.sin(performance.now() * 0.022) * 0.5 + 0.5
          : Math.sin(performance.now() * 0.008) * 0.5 + 0.5
        : 0.55;
      if (led) {
        const mat = led.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.5 + pulse * 2.2;
      }
      if (light) light.intensity = bombPlanted ? 0.25 + pulse * 1.6 : 0.22;
      if (bombPlanted) {
        bombMesh.visible = true;
        bombMesh.position.set(bombX, 0.1, bombZ);
        bombMesh.rotation.y = 0.15;
      } else if (bombLoose) {
        bombMesh.visible = true;
        bombMesh.position.set(bombX, 0.1, bombZ);
        bombMesh.rotation.y = 0.15;
      } else {
        bombMesh.visible = false;
      }
    }

    player.mesh.visible = false;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const hit = rayActors(player.x, player.y + 1.55, player.z, dir.x, dir.y, dir.z, 40, player);
    if (hit && hit.t < 18) lookAt(hit.actor.name, hit.actor.team, hit.actor.hp);
    else lookAt("", null, 0);

    writeHud();
  }

  function render() {
    const eye = player.alive ? (input.actions.crouch ? 1.15 : 1.58) : 0.78;
    yawObj.position.set(player.x, player.y + eye, player.z);
    yawObj.rotation.y = player.yaw + player.recoilY;
    pitchObj.rotation.x = player.pitch - player.recoilP;
    const sh = trauma * trauma;
    if (sh > 0.001) {
      camera.position.set((Math.random() - 0.5) * 0.12 * sh, (Math.random() - 0.5) * 0.1 * sh, 0);
      camera.rotation.z = (Math.random() - 0.5) * 0.04 * sh;
    } else {
      camera.position.set(0, Math.sin(player.bob) * 0.035, 0);
      camera.rotation.z = 0;
    }
    const targetFov = THREE.MathUtils.lerp(cfg.settings.fov, WEAPONS[player.weapon].adsFov, adsAmt);
    camera.fov = targetFov;
    camera.updateProjectionMatrix();

    const gx = THREE.MathUtils.lerp(0.28, 0.0, adsAmt);
    const gy = THREE.MathUtils.lerp(-0.26, -0.14, adsAmt) - vmDrop - Math.sin(player.bob) * 0.02;
    const gz = THREE.MathUtils.lerp(-0.52, -0.42, adsAmt);
    viewGun.position.set(gx, gy, gz);
    viewGun.rotation.set(-vmKick * 1.4, adsAmt > 0.5 ? 0 : 0.08, vmKick * 0.6);
    viewGun.visible = player.alive && !(adsAmt > 0.72 && player.weapon === "sr98");
    const vw = WEAPONS[player.weapon];
    poseViewmodel(viewGun, {
      reload: player.reloadT > 0 ? 1 - player.reloadT / Math.max(0.05, vw.reload) : 0,
      kick: vmKick,
      cycle: vmCycle,
      ads: adsAmt,
      empty: player.mag <= 0 && vw.slot !== "melee" && vw.slot !== "nade",
    });
    overlayCam.fov = THREE.MathUtils.lerp(62, 48, adsAmt);
    overlayCam.updateProjectionMatrix();

    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(overlay, overlayCam);
  }

  function loop(now: number) {
    if (disposed) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    input.consumeLook();
    if (!paused && player.alive) {
      const h = typeof window !== "undefined" ? Math.max(400, window.innerHeight) : 800;
      const touchMul = touchPlay || !input.locked ? (2.4 * 800) / h : 1;
      const sens = 0.0018 * cfg.settings.sensitivity * (adsAmt > 0.5 ? 0.55 : 1) * touchMul;
      player.yaw -= input.actions.lookX * sens;
      player.pitch -= input.actions.lookY * sens * (cfg.settings.invertY ? -1 : 1);
      player.pitch = clamp(player.pitch, -1.52, 1.52);
    }
    acc += dt;
    if (hitStop > 0) {
      hitStop -= dt;
      render();
      return;
    }
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render();
  }
  renderer.setAnimationLoop(loop);

  window.__controlsTest = {
    getYaw: () => player.yaw,
    getSpeed: () => Math.hypot(player.vx, player.vz),
    setKeys: (codes: string[]) => input.setKeys(codes),
    getPos: () => ({ x: player.x, y: player.y, z: player.z }),
  };

  return {
    dispose: () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      input.dispose();
      audio.dispose();
      ro.disconnect();
      world.dispose();
      fx.dispose();
      renderer.dispose();
      delete window.__controlsTest;
    },
    setPaused: (p) => {
      paused = p;
      if (p) input.unlock();
    },
    getHud: () => hud,
    getScoreRows: () => getRows(),
    getSpray: () => ({
      shotI: player.shotI,
      recoilP: player.recoilP,
      recoilY: player.recoilY,
      weapon: player.weapon,
    }),
    requestLock: () => {
      captured = true;
      armRound();
      audio.unlock();
      audio.startDrones();
      paused = false;
      if (!touchPlay) input.requestLock();
    },
    input,
    buy,
    buyArmor,
  };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      getPos: () => { x: number; y: number; z: number };
    };
    __pbEngine?: {
      setMoveStick: (x: number, y: number) => void;
      setLook: (x: number, y: number) => void;
      setAction: (
        n: "fire" | "ads" | "jump" | "reload" | "crouch" | "use" | "sprint" | "pause",
        v: boolean,
      ) => void;
      setSlot: (n: number) => void;
      buy: (id: WeaponId) => boolean;
      buyArmor?: () => boolean;
      getHud?: () => HudSnapshot;
      getSpray?: () => { shotI: number; recoilP: number; recoilY: number; weapon: WeaponId };
    };
  }
}
