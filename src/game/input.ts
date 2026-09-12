export type Actions = {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  fire: boolean;
  ads: boolean;
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
  reload: boolean;
  use: boolean;
  knife: boolean;
  slot: number;
  scoreboard: boolean;
  pause: boolean;
  justFire: boolean;
  justJump: boolean;
  justReload: boolean;
  justUse: boolean;
  justPause: boolean;
  justSlot: number;
  wheel: number;
};

const GAME_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyR",
  "KeyE",
  "KeyQ",
  "KeyC",
  "KeyG",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "Key1",
  "Key2",
  "Key3",
  "Key4",
  "Tab",
  "Escape",
  "KeyF",
  "KeyV",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyP",
]);

export type TouchAction = "fire" | "ads" | "jump" | "reload" | "crouch" | "use" | "sprint" | "pause";

export type InputHandle = {
  actions: Actions;
  locked: boolean;
  consumeLook: () => { x: number; y: number };
  setKeys: (codes: string[]) => void;
  setFire: (v: boolean) => void;
  setLook: (dx: number, dy: number) => void;
  setMoveStick: (x: number, y: number) => void;
  setAction: (name: TouchAction, v: boolean) => void;
  setSlot: (n: number) => void;
  requestLock: () => void;
  unlock: () => void;
  dispose: () => void;
};

export function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(pointer: coarse)").matches) return true;
    if (window.matchMedia("(hover: none)").matches) return true;
  } catch {
    /* ignore */
  }
  if ((navigator.maxTouchPoints ?? 0) > 0) return true;
  if ("ontouchstart" in window) return true;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (Math.min(w, h) <= 520) return true;
  if (h > w && w <= 1280) return true;
  return false;
}

export function createInput(canvas: HTMLCanvasElement): InputHandle {
  const keys = new Set<string>();
  let inject: string[] | null = null;
  let mx = 0;
  let my = 0;
  let fireHeld = false;
  let adsHeld = false;
  let wheel = 0;
  let stickX = 0;
  let stickY = 0;
  let queuedSlot = 0;
  const touchBtn: Record<string, boolean> = {};
  let locked = false;
  const prev = {
    fire: false,
    jump: false,
    reload: false,
    use: false,
    pause: false,
    slot: 0,
  };

  const actions: Actions = {
    moveX: 0,
    moveY: 0,
    lookX: 0,
    lookY: 0,
    fire: false,
    ads: false,
    jump: false,
    crouch: false,
    sprint: false,
    reload: false,
    use: false,
    knife: false,
    slot: 0,
    scoreboard: false,
    pause: false,
    justFire: false,
    justJump: false,
    justReload: false,
    justUse: false,
    justPause: false,
    justSlot: 0,
    wheel: 0,
  };

  function down(e: KeyboardEvent) {
    if (inject) return;
    if (GAME_CODES.has(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.code === "Tab") e.preventDefault();
  }
  function up(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  function blur() {
    keys.clear();
    fireHeld = false;
    adsHeld = false;
    stickX = 0;
    stickY = 0;
    for (const k of Object.keys(touchBtn)) touchBtn[k] = false;
  }
  function mmove(e: MouseEvent) {
    if (document.pointerLockElement !== canvas) return;
    mx += e.movementX;
    my += e.movementY;
  }
  function md(e: MouseEvent) {
    if (e.button === 0) fireHeld = true;
    if (e.button === 2) adsHeld = true;
  }
  function mu(e: MouseEvent) {
    if (e.button === 0) fireHeld = false;
    if (e.button === 2) adsHeld = false;
  }
  function ctx(e: Event) {
    e.preventDefault();
  }
  function wh(e: WheelEvent) {
    wheel += Math.sign(e.deltaY);
  }
  function plc() {
    locked = document.pointerLockElement === canvas;
  }

  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) blur();
  });
  canvas.addEventListener("mousemove", mmove);
  canvas.addEventListener("mousedown", md);
  window.addEventListener("mouseup", mu);
  canvas.addEventListener("contextmenu", ctx);
  canvas.addEventListener("wheel", wh, { passive: true });
  document.addEventListener("pointerlockchange", plc);

  function sample() {
    const k = inject ? new Set(inject) : keys;
    let mxv = 0;
    let myv = 0;
    if (k.has("KeyW") || k.has("ArrowUp")) myv += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) myv -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) mxv += 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) mxv -= 1;
    mxv += stickX;
    myv += stickY;
    const mag = Math.hypot(mxv, myv);
    if (mag > 1) {
      mxv /= mag;
      myv /= mag;
    }
    const slot =
      queuedSlot ||
      (k.has("Key1") ? 1 : k.has("Key2") ? 2 : k.has("Key3") ? 3 : k.has("Key4") ? 4 : 0);
    const fire = fireHeld || !!touchBtn.fire || k.has("KeyV");
    const jump = k.has("Space") || !!touchBtn.jump;
    const reload = k.has("KeyR") || !!touchBtn.reload;
    const use = k.has("KeyE") || !!touchBtn.use;
    const pause = k.has("Escape") || k.has("KeyP") || !!touchBtn.pause;
    actions.moveX = mxv;
    actions.moveY = myv;
    actions.lookX = mx;
    actions.lookY = my;
    actions.fire = fire;
    actions.ads = adsHeld || !!touchBtn.ads || k.has("KeyC");
    actions.jump = jump;
    actions.crouch = k.has("ControlLeft") || k.has("ControlRight") || !!touchBtn.crouch;
    actions.sprint = k.has("ShiftLeft") || k.has("ShiftRight") || !!touchBtn.sprint;
    actions.reload = reload;
    actions.use = use;
    actions.knife = k.has("KeyQ") || k.has("KeyF");
    actions.slot = slot;
    actions.scoreboard = k.has("Tab");
    actions.pause = pause;
    actions.justFire = fire && !prev.fire;
    actions.justJump = jump && !prev.jump;
    actions.justReload = reload && !prev.reload;
    actions.justUse = use && !prev.use;
    actions.justPause = pause && !prev.pause;
    actions.justSlot = slot !== 0 && slot !== prev.slot ? slot : 0;
    actions.wheel = wheel;
    prev.fire = fire;
    prev.jump = jump;
    prev.reload = reload;
    prev.use = use;
    prev.pause = pause;
    prev.slot = slot;
    mx = 0;
    my = 0;
    wheel = 0;
    queuedSlot = 0;
    if (touchBtn.pause) touchBtn.pause = false;
    locked = document.pointerLockElement === canvas;
  }

  function consumeLook() {
    sample();
    const x = actions.lookX;
    const y = actions.lookY;
    return { x, y };
  }

  function requestLock() {
    const p = canvas.requestPointerLock({ unadjustedMovement: true } as PointerLockOptions);
    if (p && typeof (p as Promise<void>).catch === "function") {
      (p as Promise<void>).catch(() => {
        canvas.requestPointerLock();
      });
    }
  }

  return {
    actions,
    get locked() {
      return document.pointerLockElement === canvas;
    },
    consumeLook,
    setKeys: (codes) => {
      inject = codes.length ? codes : null;
      if (!inject) keys.clear();
    },
    setFire: (v) => {
      fireHeld = v;
    },
    setLook: (dx, dy) => {
      mx += dx;
      my += dy;
    },
    setMoveStick: (x, y) => {
      stickX = x;
      stickY = y;
    },
    setAction: (name, v) => {
      touchBtn[name] = v;
    },
    setSlot: (n) => {
      queuedSlot = n;
    },
    requestLock,
    unlock: () => {
      document.exitPointerLock?.();
    },
    dispose: () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      canvas.removeEventListener("mousemove", mmove);
      canvas.removeEventListener("mousedown", md);
      window.removeEventListener("mouseup", mu);
      canvas.removeEventListener("contextmenu", ctx);
      canvas.removeEventListener("wheel", wh);
      document.removeEventListener("pointerlockchange", plc);
    },
  };
}
