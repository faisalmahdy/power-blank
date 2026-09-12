import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Pause, Rows3 } from "lucide-react";
import type { GameEvent, HudSnapshot, KitId, MatchConfig, ScoreRow, WeaponId } from "@/game/types";
import { isCoarsePointer, type TouchAction } from "@/game/input";
import { usePB } from "@/game/store";
import { STR, MAP_META } from "@/game/strings";
import { PRIMARY_IDS, PISTOL_IDS, NADE_IDS, WEAPONS } from "@/game/weapons";

type EngineHandle = {
  dispose: () => void;
  getHud: () => HudSnapshot;
  getScoreRows: () => ScoreRow[];
  getSpray: () => { shotI: number; recoilP: number; recoilY: number; weapon: WeaponId };
  requestLock: () => void;
  setPaused: (p: boolean) => void;
  buy: (id: import("@/game/types").WeaponId) => boolean;
  buyArmor: () => boolean;
  input: {
    setMoveStick: (x: number, y: number) => void;
    setLook: (x: number, y: number) => void;
    setAction: (n: TouchAction, v: boolean) => void;
    setSlot: (n: number) => void;
  };
};

type Props = {
  cfg: MatchConfig;
  onEvent: (e: GameEvent) => void;
  onQuit: () => void;
};

const emptyHud = (): HudSnapshot => ({
  hp: 100,
  armor: 100,
  ammo: 30,
  reserve: 90,
  weapon: "car15",
  weaponName: "CAR-15",
  yaw: 0,
  x: 0,
  z: 0,
  ads: false,
  reloading: false,
  planting: 0,
  defusing: 0,
  alive: true,
  respawnIn: 0,
  timer: 0,
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
  mode: "tdm",
  map: "depot",
  team: "CT",
  freeze: 0,
  bombX: 0,
  bombZ: 0,
  bombVisible: false,
  money: 800,
  bloom: 0,
  hurtDir: 0,
  sites: [],
  bannerKind: "",
  bannerTeam: null,
  kits: [],
  reloadFrac: 0,
  carrying: false,
  roundsToWin: 5,
  bombSite: "",
  smoke: 0,
  cooking: 0,
  killerHp: 0,
  roundOver: false,
  roundMvp: "",
  nades: 1,
  primary: "car15",
  pistol: "d50",
  nade: "he",
});

export function GameScreen({ cfg, onEvent, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engRef = useRef<EngineHandle | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(emptyHud());
  const [started, setStarted] = useState(!!cfg.skipTap);
  const [touchUI, setTouchUI] = useState(false);
  const scoreboard = usePB((s) => s.scoreboard);
  const setScoreboard = usePB((s) => s.setScoreboard);
  const killfeed = usePB((s) => s.killfeed);
  const settings = usePB((s) => s.settings);
  const t = STR[settings.locale];

  useEffect(() => {
    if (isCoarsePointer()) setTouchUI(true);
    const onTouch = () => setTouchUI(true);
    window.addEventListener("touchstart", onTouch, { passive: true });
    return () => window.removeEventListener("touchstart", onTouch);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dead = false;
    let eng: EngineHandle | null = null;
    let id = 0;
    void import("@/game/engine").then(({ createEngine }) => {
      if (dead || !canvas) return;
      eng = createEngine(canvas, cfg, onEvent);
      engRef.current = eng;
      window.__pbEngine = {
        setMoveStick: eng.input.setMoveStick,
        setLook: eng.input.setLook,
        setAction: eng.input.setAction,
        setSlot: eng.input.setSlot,
        buy: eng.buy,
        buyArmor: eng.buyArmor,
        getHud: () => eng?.getHud() ?? emptyHud(),
        getSpray: () => eng?.getSpray() ?? { shotI: 0, recoilP: 0, recoilY: 0, weapon: "car15" },
      };
      if (cfg.skipTap) {
        if (isCoarsePointer()) setTouchUI(true);
        setStarted(true);
        eng.requestLock();
      }
      id = window.setInterval(() => {
        const h = eng?.getHud();
        if (h) setHud({ ...h, allies: h.allies.slice(), enemies: h.enemies.slice() });
      }, 50);
    });
    return () => {
      dead = true;
      window.clearInterval(id);
      eng?.dispose();
      engRef.current = null;
      delete window.__pbEngine;
    };
    // cfg identity is matchKey from parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Tab") {
        e.preventDefault();
        setScoreboard(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Tab") setScoreboard(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [setScoreboard]);

  function begin(pointerType?: string) {
    if (pointerType === "touch" || pointerType === "pen" || isCoarsePointer()) setTouchUI(true);
    setStarted(true);
    engRef.current?.requestLock();
  }

  const rows = engRef.current?.getScoreRows() ?? [];
  const mm = MAP_META[cfg.map];
  const playing = started || hud.locked;
  const showPad = playing && (touchUI || !hud.mouseLocked);

  return (
    <div
      className={`relative h-dvh w-full overflow-hidden bg-bg text-fg select-none touch-none overscroll-none ${playing ? "pb-play" : ""}`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onClick={() => {
          if (!showPad) engRef.current?.requestLock();
        }}
      />
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            boxShadow: `inset 0 0 ${80 + hud.hurt * 160}px ${hud.hurt * 70}px rgba(180,20,10,${hud.hurt * 0.65})`,
          }}
        />
        {hud.flash > 0.02 && (
          <div className="absolute inset-0 bg-fg" style={{ opacity: Math.min(1, hud.flash) }} />
        )}
        {hud.smoke > 0.04 && (
          <div className="absolute inset-0 bg-muted" style={{ opacity: Math.min(0.78, hud.smoke) }} />
        )}
        {hud.cooking > 0 && (
          <div className="absolute bottom-[34%] left-1/2 w-40 -translate-x-1/2 md:bottom-36">
            <div className="mb-1 text-center font-display text-[10px] tracking-[0.22em] text-warn">COOK</div>
            <div className="h-1.5 overflow-hidden bg-elevated">
              <div className="h-full bg-tr" style={{ width: `${hud.cooking * 100}%` }} />
            </div>
          </div>
        )}
        <Crosshair
          ads={hud.ads}
          hit={hud.hitmarker}
          head={hud.headshot}
          size={settings.crosshair}
          compact={showPad}
          bloom={hud.bloom}
          hide={hud.ads && (hud.weapon === "sr98" || hud.kits.includes("rd"))}
        />
        {hud.ads && hud.kits.includes("rd") && hud.weapon !== "sr98" ? <RedDot /> : null}
        <Radar hud={hud} compact={showPad} />
        <HurtFlash dir={hud.hurtDir} amt={hud.hurt} />
        {hud.ads && hud.weapon === "sr98" ? <ScopeOverlay /> : null}
        <TopBar hud={hud} mapName={mm?.name ?? cfg.map} compact={showPad} />
        {cfg.mode === "demolition" && hud.carrying && hud.alive && !hud.siteHint ? (
          <div
            className={`absolute left-1/2 z-[12] -translate-x-1/2 text-center font-display tracking-[0.28em] text-warn ${
              showPad ? "top-[7.4rem] text-[10px]" : "top-[6.6rem] text-xs"
            }`}
          >
            <div>{t.youBomb}</div>
            {hud.bombSite ? (
              <div className="mt-0.5 text-accent">
                {t.goSite} {hud.bombSite}
              </div>
            ) : null}
          </div>
        ) : null}
        {showPad ? <TouchVitals hud={hud} /> : <BottomHud hud={hud} />}
        <Killfeed items={killfeed} compact={showPad} />
        <Theater key={`${hud.bannerKind}-${hud.announcer}`} hud={hud} compact={showPad} />
        {hud.announcer && !hud.bannerKind ? (
          <div className="absolute left-1/2 top-[16%] -translate-x-1/2 px-3 text-center font-display text-3xl tracking-[0.28em] text-accent drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] md:text-6xl">
            {hud.announcer}
          </div>
        ) : null}
        {hud.killMsg && hud.alive && hud.bannerKind !== "blood" && hud.bannerKind !== "mission" && hud.bannerKind !== "count" ? (
          <div
            className={`absolute left-1/2 -translate-x-1/2 text-center ${showPad ? "top-[30%]" : "top-[32%]"}`}
          >
            <div className="font-display text-[10px] tracking-[0.32em] text-muted md:text-xs">
              {hud.killBy ? t.killedBy : t.killed}
            </div>
            <div
              className={`font-display tracking-widest ${hud.killBy ? "text-tr" : "text-fg"} ${
                showPad ? "text-xl" : "text-3xl"
              }`}
            >
              {hud.killMsg}
            </div>
            {hud.headshot && !hud.killBy ? (
              <div className="mt-1 font-display text-[10px] tracking-[0.4em] text-tr md:text-sm">{t.headshot}</div>
            ) : null}
          </div>
        ) : null}
        {hud.lookingName ? (
          <div className="absolute left-1/2 top-[44%] -translate-x-1/2 text-center">
            <div
              className={`font-display text-sm tracking-widest ${hud.lookingTeam === "CT" ? "text-ct" : "text-tr"}`}
            >
              {hud.lookingName}
            </div>
            {hud.lookingTeam !== cfg.team ? (
              <div className="mx-auto mt-1 h-1 w-24 overflow-hidden bg-elevated">
                <div className="h-full bg-hp" style={{ width: `${hud.lookingHp}%` }} />
              </div>
            ) : null}
          </div>
        ) : null}
        {hud.siteHint ? (
          <div className="absolute bottom-[38%] left-1/2 -translate-x-1/2 px-3 text-center font-display text-sm tracking-[0.25em] text-warn md:bottom-28">
            {hud.siteHint}
            {hud.planting > 0 || hud.defusing > 0 ? (
              <div className="mx-auto mt-2 h-1.5 w-48 overflow-hidden bg-elevated">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${(hud.planting || hud.defusing) * 100}%` }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        {!hud.alive && (
          <DeathCam hud={hud} t={t} tdm={cfg.mode === "tdm"} compact={showPad} />
        )}
      </div>

      {!cfg.skipTap && !playing && hud.alive && !hud.paused && (
        <button
          type="button"
          className="absolute inset-0 z-20 flex flex-col items-center justify-end bg-transparent px-6 pb-[18vh] md:pb-28"
          onPointerUp={(e) => begin(e.pointerType)}
          onClick={() => begin()}
        >
          <span className="border border-accent bg-bg/75 px-5 py-2 font-display text-lg tracking-[0.32em] text-accent md:text-2xl">
            {touchUI ? t.tapPlay : t.clickPlay}
          </span>
          <span className="mt-2 max-w-md text-center text-[11px] text-muted md:text-sm">
            {touchUI ? t.tapHint : t.clickHint}
          </span>
        </button>
      )}

      {playing && !touchUI && !hud.mouseLocked && !hud.paused && hud.alive && (
        <button
          type="button"
          className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 border border-accent bg-bg/75 px-5 py-2 font-display text-sm tracking-[0.28em] text-accent md:text-base"
          onClick={() => engRef.current?.requestLock()}
        >
          {t.clickAim}
        </button>
      )}

      {hud.paused && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/70 p-4">
          <div className="w-[min(420px,92vw)] border border-border bg-surface p-6">
            <h2 className="font-display text-3xl tracking-[0.25em]">{t.paused}</h2>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                className="h-12 bg-accent font-display tracking-[0.2em] text-bg"
                onClick={() => begin()}
              >
                {t.resume}
              </button>
              <button
                type="button"
                className="h-12 border border-border font-display tracking-[0.2em] text-fg"
                onClick={onQuit}
              >
                {t.quit}
              </button>
            </div>
          </div>
        </div>
      )}

      {(scoreboard || hud.roundOver) && (
        <Scoreboard
          rows={rows}
          you={cfg.nickname.toUpperCase()}
          t={t}
          hud={hud}
          mvp={hud.roundMvp}
          compact={showPad}
        />
      )}

      {playing && hud.freeze > 1.2 && hud.alive && !hud.paused && hud.bannerKind !== "mission" && (
        <FreezeBuy
          hud={hud}
          compact={showPad}
          unlocked={cfg.unlocked ?? []}
          loadout={cfg.loadout}
          t={t}
          onBuy={(id) => engRef.current?.buy(id) ?? false}
          onArmor={() => engRef.current?.buyArmor() ?? false}
        />
      )}

      {showPad && !hud.paused && hud.alive && (
        <MobilePad
          hud={hud}
          t={t}
          onPause={() => engRef.current?.setPaused(true)}
          onScore={(v) => setScoreboard(v)}
        />
      )}
    </div>
  );
}

function Theater({ hud, compact }: { hud: HudSnapshot; compact?: boolean }) {
  if (!hud.bannerKind || !hud.announcer) return null;
  if (hud.bannerKind === "count") {
    return (
      <div
        className={`pointer-events-none absolute left-1/2 ${compact ? "top-[22%]" : "top-[16%]"} -translate-x-1/2 text-center`}
      >
        <div className="pb-count relative mx-auto flex h-[7.5rem] w-[7.5rem] items-center justify-center md:h-40 md:w-40">
          <div className="absolute inset-0 rotate-45 border-2 border-accent" />
          <div className="absolute inset-2 rotate-45 border border-accent/50" />
          <div className="font-display text-7xl leading-none tracking-[0.08em] text-accent drop-shadow-[0_4px_18px_rgba(0,0,0,0.85)] md:text-8xl">
            {hud.announcer}
          </div>
        </div>
      </div>
    );
  }
  if (hud.bannerKind === "mission") {
    return (
      <div
        className={`pb-slam absolute left-1/2 ${compact ? "top-[20%]" : "top-[18%]"} w-[min(720px,94vw)] border-2 border-accent bg-bg/75 px-4 py-4 text-center`}
      >
        <div className="font-display text-4xl tracking-[0.32em] text-accent md:text-6xl">{hud.announcer}</div>
      </div>
    );
  }
  if (hud.bannerKind === "blood") {
    return (
      <div
        className={`pb-slam absolute left-1/2 ${compact ? "top-[20%]" : "top-[18%]"} w-[min(640px,92vw)] border-2 border-warn bg-bg/80 px-4 py-3 text-center`}
      >
        <div className="font-display text-4xl tracking-[0.28em] text-warn md:text-6xl">{hud.announcer}</div>
      </div>
    );
  }
  if (hud.bannerKind === "down") {
    return (
      <div
        className={`pb-slam absolute left-1/2 ${compact ? "top-[22%]" : "top-[20%]"} text-center`}
      >
        <div className="font-display text-2xl tracking-[0.36em] text-accent drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] md:text-4xl">
          {hud.announcer}
        </div>
      </div>
    );
  }
  if (hud.bannerKind === "multi") {
    return (
      <div
        className={`pb-slam absolute left-1/2 ${compact ? "top-[22%]" : "top-[20%]"} w-[min(560px,90vw)] border border-accent bg-bg/70 px-4 py-2 text-center`}
      >
        <div className="font-display text-[10px] tracking-[0.42em] text-accent">STREAK</div>
        <div className="font-display text-3xl tracking-[0.32em] text-accent md:text-5xl">{hud.announcer}</div>
      </div>
    );
  }
  if (hud.bannerKind === "round") return null;
  const bar = hud.bannerKind === "defuse" ? "bg-ct text-bg" : "bg-warn text-bg";
  return (
    <div
      className={`pb-banner absolute left-0 right-0 ${compact ? "top-[5.6rem]" : "top-[4.6rem]"} z-[15] py-2 text-center ${bar}`}
    >
      <div className="font-display text-2xl tracking-[0.28em] md:text-4xl">{hud.announcer}</div>
    </div>
  );
}

function HurtFlash({ dir, amt }: { dir: number; amt: number }) {
  if (amt < 0.04) return null;
  let d = dir;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const left = Math.max(0, Math.sin(d)) * amt;
  const right = Math.max(0, -Math.sin(d)) * amt;
  const back = Math.max(0, -Math.cos(d)) * amt;
  const deg = (d * 180) / Math.PI;
  return (
    <div className="pointer-events-none absolute inset-0 z-[13]">
      <div
        className="absolute inset-y-0 left-0 w-1/3"
        style={{
          opacity: left,
          background: "linear-gradient(to right, rgba(255,42,24,0.55), transparent)",
        }}
      />
      <div
        className="absolute inset-y-0 right-0 w-1/3"
        style={{
          opacity: right,
          background: "linear-gradient(to left, rgba(255,42,24,0.55), transparent)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1/4"
        style={{
          opacity: back * 0.85,
          background: "linear-gradient(to top, rgba(255,42,24,0.5), transparent)",
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-28 w-14 -translate-x-1/2 md:h-36 md:w-16"
        style={{
          transform: `translate(-50%, -118%) rotate(${deg}deg)`,
          transformOrigin: "50% 100%",
          background: `linear-gradient(to top, transparent, rgba(255,42,24,${Math.min(0.95, amt)}))`,
          clipPath: "polygon(18% 100%, 82% 100%, 50% 0%)",
        }}
      />
    </div>
  );
}

function ScopeOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 13.5%, #07080a 17.2%, #07080a 100%)",
        }}
      />
      <div className="absolute left-1/2 top-1/2 h-px w-40 -translate-x-1/2 bg-accent/80" />
      <div className="absolute left-1/2 top-1/2 h-40 w-px -translate-y-1/2 bg-accent/80" />
      <div className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
      {[18, 32, 48].map((r) => (
        <div
          key={r}
          className="absolute left-1/2 top-1/2 rounded-full border border-accent/40"
          style={{ width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r }}
        />
      ))}
    </div>
  );
}

function RedDot() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-[14px] border-bg" />
      <div className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-40" />
      <div className="absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tr" />
    </div>
  );
}

function FreezeBuy({
  hud,
  compact,
  unlocked,
  loadout,
  t,
  onBuy,
  onArmor,
}: {
  hud: HudSnapshot;
  compact: boolean;
  unlocked: WeaponId[];
  loadout: MatchConfig["loadout"];
  t: (typeof STR)["en"];
  onBuy: (id: WeaponId) => boolean;
  onArmor: () => boolean;
}) {
  const [deny, setDeny] = useState(false);
  const owned = (id: WeaponId) =>
    unlocked.includes(id) ||
    WEAPONS[id].price === 0 ||
    id === loadout.primary ||
    id === loadout.pistol ||
    id === loadout.nade;
  const click = (id: WeaponId) => {
    if (!owned(id) || !onBuy(id)) {
      setDeny(true);
      window.setTimeout(() => setDeny(false), 280);
      return;
    }
  };
  const vest = () => {
    if (!onArmor()) {
      setDeny(true);
      window.setTimeout(() => setDeny(false), 280);
    }
  };
  const cols: Array<{ label: string; ids: WeaponId[] }> = [
    { label: t.primary, ids: PRIMARY_IDS },
    { label: t.pistol, ids: PISTOL_IDS },
    { label: t.nade, ids: NADE_IDS },
  ];
  return (
    <div
      className={`pointer-events-auto absolute left-1/2 z-20 -translate-x-1/2 border border-border bg-bg/85 p-2 ${
        compact ? "top-[46%] w-[min(22.5rem,94vw)]" : "bottom-20 w-[min(40rem,92vw)]"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <span className="font-display text-[10px] tracking-[0.28em] text-muted">{t.freezeBuy}</span>
        <span className={`font-mono text-sm tabular-nums ${deny ? "text-tr" : "text-accent"}`}>
          {t.gp} {hud.money}
        </span>
        <button
          type="button"
          className={`min-h-9 border px-2 font-display text-[10px] tracking-widest ${
            hud.armor >= 100 ? "border-line text-faint" : "border-armor text-armor"
          }`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            vest();
          }}
        >
          {t.armorBuy} {hud.armor >= 100 ? t.owned : "400"}
        </button>
      </div>
      <div className={`grid grid-cols-3 ${compact ? "gap-1" : "gap-2"}`}>
        {cols.map((col) => (
          <div key={col.label} className="min-w-0">
            <div className="mb-1 font-display text-[9px] tracking-[0.22em] text-faint">{col.label}</div>
            <div className="flex flex-col gap-0.5">
              {col.ids.map((id) => {
                const w = WEAPONS[id];
                const active = hud.weapon === id;
                const have = owned(id);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!have}
                    className={`flex min-h-10 w-full items-center justify-between gap-1 border px-1.5 font-display tracking-widest ${
                      active
                        ? "border-accent bg-accent text-bg"
                        : !have
                          ? "border-border text-faint"
                          : "border-border bg-elevated text-fg"
                    }`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      click(id);
                    }}
                  >
                    <span className={`truncate ${compact ? "text-[9px]" : "text-[10px]"}`}>{w.name}</span>
                    <span className={`shrink-0 tabular-nums ${compact ? "text-[8px]" : "text-[9px]"} ${active ? "text-bg" : have ? "text-accent" : "text-faint"}`}>
                      {have ? t.shopFree : t.locked}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Crosshair({
  ads,
  hit,
  head,
  size,
  compact,
  bloom = 0,
  hide,
}: {
  ads: boolean;
  hit: number;
  head: boolean;
  size: number;
  compact?: boolean;
  bloom?: number;
  hide?: boolean;
}) {
  if (hide) return null;
  const g = (ads ? (compact ? 4 : 3) : (compact ? 12 : 8) * size) + bloom * 48;
  const len = ads ? (compact ? 9 : 6) : compact ? 14 : 10;
  const t = compact ? 3 : 2;
  const c = hit > 0 ? (head ? "#ff4a4a" : "#f4f1ea") : "#f4f1ea";
  const stroke = "0 0 0 1px #0c0d10, 0 0 5px rgba(12,13,16,0.85)";
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <i
        className="absolute block"
        style={{ left: 1 - t, top: -g - len, width: t, height: len, background: c, boxShadow: stroke }}
      />
      <i
        className="absolute block"
        style={{ left: 1 - t, top: g, width: t, height: len, background: c, boxShadow: stroke }}
      />
      <i
        className="absolute block"
        style={{ left: -g - len, top: 1 - t, width: len, height: t, background: c, boxShadow: stroke }}
      />
      <i
        className="absolute block"
        style={{ left: g, top: 1 - t, width: len, height: t, background: c, boxShadow: stroke }}
      />
      <i
        className="absolute block rounded-full"
        style={{
          left: -2,
          top: -2,
          width: 4,
          height: 4,
          background: hit > 0 ? c : "#ff6a00",
          boxShadow: stroke,
        }}
      />
    </div>
  );
}

function Radar({ hud, compact }: { hud: HudSnapshot; compact?: boolean }) {
  const size = compact ? 72 : 118;
  const scale = compact ? 1.55 : 2.1;
  const dots = [
    ...hud.allies.map((a) => ({ ...a, c: "#4aa3ff" })),
    ...hud.enemies.filter((e) => e.vis).map((e) => ({ ...e, yaw: 0, c: "#ff4a4a" })),
  ];
  return (
    <div
      className={`absolute overflow-hidden border border-line bg-bg/70 p-1 ${compact ? "left-2 top-2" : "left-3 top-3"}`}
    >
      <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}>
        <circle r={size / 2 - 2} fill="#0c0d10cc" stroke="#2a2d36" />
        <circle r={size / 4} fill="none" stroke="#2a2d36" />
        <line x1={0} y1={-size / 2} x2={0} y2={size / 2} stroke="#2a2d36" />
        <line x1={-size / 2} y1={0} x2={size / 2} y2={0} stroke="#2a2d36" />
        {dots.map((d, i) => {
          const dx = d.x - hud.x;
          const dz = d.z - hud.z;
          const c = Math.cos(-hud.yaw);
          const s = Math.sin(-hud.yaw);
          const rx = (dx * c - dz * s) * scale;
          const rz = (dx * s + dz * c) * scale;
          return <circle key={i} cx={rx} cy={rz} r={3} fill={d.c} />;
        })}
        {hud.mode === "demolition" && hud.bombVisible ? (
          <circle
            cx={((hud.bombX - hud.x) * Math.cos(-hud.yaw) - (hud.bombZ - hud.z) * Math.sin(-hud.yaw)) * scale}
            cy={((hud.bombX - hud.x) * Math.sin(-hud.yaw) + (hud.bombZ - hud.z) * Math.cos(-hud.yaw)) * scale}
            r={hud.bombPlanted ? 6 : 3.5}
            fill={hud.bombPlanted ? "#ff6a00" : "#ffb020"}
            opacity={hud.bombPlanted ? 1 : 0.75}
          />
        ) : null}
        {hud.sites.map((s) => {
          const dx = s.x - hud.x;
          const dz = s.z - hud.z;
          const c = Math.cos(-hud.yaw);
          const sn = Math.sin(-hud.yaw);
          const rx = (dx * c - dz * sn) * scale;
          const rz = (dx * sn + dz * c) * scale;
          if (Math.hypot(rx, rz) > size / 2 - 8) return null;
          return (
            <text
              key={s.name}
              x={rx}
              y={rz}
              fill="#ff6a00"
              fontSize={compact ? 8 : 11}
              fontFamily="Oswald, sans-serif"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {s.name}
            </text>
          );
        })}
        <polygon points="0,-6 4,5 -4,5" fill="#ff6a00" />
      </svg>
    </div>
  );
}

function TopBar({ hud, mapName, compact }: { hud: HudSnapshot; mapName: string; compact?: boolean }) {
  const m = Math.floor(hud.timer / 60);
  const s = Math.floor(hud.timer % 60)
    .toString()
    .padStart(2, "0");
  const pips = Array.from({ length: hud.roundsToWin || 5 });
  const demo = hud.mode === "demolition";
  return (
    <div className={`absolute left-1/2 flex -translate-x-1/2 flex-col items-center ${compact ? "top-1.5" : "top-3"}`}>
      <div
        className={`flex items-center border border-border bg-bg/70 ${compact ? "gap-2 px-2 py-0.5" : "gap-4 px-4 py-1"}`}
      >
        <span className={`font-display text-ct tabular-nums ${compact ? "text-lg" : "text-2xl"}`}>{hud.scoreCT}</span>
        {hud.bombPlanted ? (
          <span className="font-display text-[8px] tracking-widest text-warn">BOMB</span>
        ) : null}
        <span
          className={`font-mono tracking-widest tabular-nums ${hud.bombPlanted ? "text-warn" : "text-fg"} ${compact ? "text-sm" : "text-xl"}`}
        >
          {m}:{s}
        </span>
        {hud.carrying ? (
          <span className="border border-warn px-1 font-display text-[9px] tracking-widest text-warn">C4</span>
        ) : null}
        <span className={`font-display text-tr tabular-nums ${compact ? "text-lg" : "text-2xl"}`}>{hud.scoreTR}</span>
      </div>
      {hud.mode !== "tdm" ? (
        <div className="mt-1 flex items-center gap-3">
          <div className="flex gap-0.5">
            {pips.map((_, i) => (
              <i
                key={`ct${i}`}
                className={`block h-2 w-2 border ${i < hud.roundsCT ? "border-ct bg-ct" : "border-line bg-transparent"}`}
              />
            ))}
          </div>
          <span className="font-display text-[9px] tracking-[0.2em] text-muted">R{hud.round}</span>
          <div className="flex gap-0.5">
            {pips.map((_, i) => (
              <i
                key={`tr${i}`}
                className={`block h-2 w-2 border ${i < hud.roundsTR ? "border-tr bg-tr" : "border-line bg-transparent"}`}
              />
            ))}
          </div>
        </div>
      ) : null}
      {!compact || demo ? (
        <div className="mt-1 font-display text-[10px] tracking-[0.28em] text-muted">
          {!compact ? (
            <>
              {mapName} · {hud.mode.toUpperCase()}
              {demo ? " · " : ""}
            </>
          ) : null}
          {demo ? `FT${hud.roundsToWin || 5}` : ""}
          {demo && hud.bombSite ? ` · SITE ${hud.bombSite}` : ""}
        </div>
      ) : null}
    </div>
  );
}

function SlotStrip({ hud }: { hud: HudSnapshot }) {
  const items: Array<{ n: number; id: WeaponId; dry?: boolean }> = [
    { n: 1, id: hud.primary },
    { n: 2, id: hud.pistol },
    { n: 3, id: "knife" },
    { n: 4, id: hud.nade, dry: hud.nades <= 0 },
  ];
  return (
    <div className="mb-1 flex flex-col items-end gap-0.5">
      {items.map((it) => {
        const on = hud.weapon === it.id;
        return (
          <div
            key={it.n}
            className={`flex items-center gap-1.5 font-display tracking-widest ${
              on ? "text-accent" : it.dry ? "text-faint" : "text-muted"
            }`}
          >
            <span className="text-[9px] tabular-nums">{it.n}</span>
            <span className={`text-[10px] ${on ? "text-fg" : ""}`}>{WEAPONS[it.id].name}</span>
          </div>
        );
      })}
    </div>
  );
}

function KitPips({ kits, compact }: { kits: KitId[]; compact?: boolean }) {
  if (!kits.length) return null;
  const label = { ext: "EXT", rd: "RD", lsr: "LSR" };
  return (
    <div className={`flex justify-end gap-1 ${compact ? "mt-0.5" : "mt-1"}`}>
      {kits.map((k) => (
        <span key={k} className={`border border-accent bg-bg/70 font-display tracking-[0.18em] text-accent ${compact ? "px-1 text-[8px]" : "px-1.5 py-0.5 text-[10px]"}`}>
          {label[k]}
        </span>
      ))}
    </div>
  );
}

function TouchVitals({ hud }: { hud: HudSnapshot }) {
  const w = WEAPONS[hud.weapon];
  return (
    <>
      <div className="absolute left-2 top-[5.4rem] w-[4.6rem]">
        <div className="mb-0.5 flex justify-between font-mono text-[9px] text-muted">
          <span>HP</span>
          <span>{Math.round(hud.hp)}</span>
        </div>
        <div className="h-1.5 overflow-hidden bg-elevated">
          <div className="h-full bg-hp" style={{ width: `${hud.hp}%` }} />
        </div>
        <div className="mt-0.5 h-1 overflow-hidden bg-elevated">
          <div className="h-full bg-armor" style={{ width: `${hud.armor}%` }} />
        </div>
        <div className="mt-0.5 font-mono text-[9px] tabular-nums text-accent">
          {hud.money} GP
        </div>
      </div>
      <div className="absolute right-[3.4rem] top-[3.35rem] text-right">
        <div className="font-display text-[9px] tracking-[0.22em] text-muted">{hud.weaponName}</div>
        <KitPips kits={hud.kits} compact />
        {w.slot === "melee" || w.slot === "nade" ? (
          <div className="font-mono text-lg text-fg">{w.slot === "nade" ? hud.nades : "—"}</div>
        ) : (
          <>
            {hud.reloading ? (
              <div className="ml-auto mt-0.5 h-1 w-16 overflow-hidden bg-elevated">
                <div className="h-full bg-accent" style={{ width: `${hud.reloadFrac * 100}%` }} />
              </div>
            ) : null}
            <div className="font-mono text-xl tabular-nums leading-none">
              {hud.reloading ? (
                <>
                  <span className="text-warn">REL</span>
                  <span className="text-xs text-muted">
                    {" "}
                    {hud.ammo}/{hud.reserve}
                  </span>
                </>
              ) : (
                <>
                  {hud.ammo}
                  <span className="text-xs text-muted">/{hud.reserve}</span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function BottomHud({ hud }: { hud: HudSnapshot }) {
  const w = WEAPONS[hud.weapon];
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3 md:p-5">
      <div className="w-56">
        <div className="mb-1 flex justify-between font-mono text-xs text-muted">
          <span>HP {Math.round(hud.hp)}</span>
          <span>ARM {Math.round(hud.armor)}</span>
        </div>
        <div className="h-2 overflow-hidden bg-elevated">
          <div className="h-full bg-hp" style={{ width: `${hud.hp}%` }} />
        </div>
        <div className="mt-1 h-1.5 overflow-hidden bg-elevated">
          <div className="h-full bg-armor" style={{ width: `${hud.armor}%` }} />
        </div>
        <div className="mt-1 font-mono text-xs tabular-nums text-accent">{hud.money} GP</div>
      </div>
      <div className="text-right">
        <SlotStrip hud={hud} />
        <div className="font-display text-xs tracking-[0.3em] text-muted">{hud.weaponName}</div>
        <KitPips kits={hud.kits} />
        {w.slot === "melee" || w.slot === "nade" ? (
          <div className="font-mono text-3xl text-fg">{w.slot === "nade" ? hud.nades : "—"}</div>
        ) : hud.reloading ? (
          <>
            <div className="ml-auto h-1.5 w-[120px] overflow-hidden bg-elevated">
              <div className="h-full bg-accent" style={{ width: `${hud.reloadFrac * 100}%` }} />
            </div>
            <div className="font-mono text-4xl tabular-nums">
              <span className="text-warn">REL</span>
              <span className="text-xl text-muted">
                {" "}
                {hud.ammo} / {hud.reserve}
              </span>
            </div>
          </>
        ) : (
          <div className="font-mono text-4xl tabular-nums">
            {hud.ammo}
            <span className="text-xl text-muted"> / {hud.reserve}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const FEED_GUN: Record<string, string> = {
  car15: "CAR-15",
  ak74: "AK-74",
  mp5n: "MP5",
  sr98: "SR-98",
  m870: "M870",
  d50: "D-50",
  g18c: "G18",
  knife: "KNIFE",
  he: "HE",
  flash: "FLASH",
  smoke: "SMOKE",
};

function DeathCam({
  hud,
  t,
  tdm,
  compact,
}: {
  hud: HudSnapshot;
  t: (typeof STR)["en"];
  tdm: boolean;
  compact?: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[14]">
      <div
        className="absolute inset-0"
        style={{ boxShadow: "inset 0 0 140px 40px rgba(8,6,8,0.72)" }}
      />
      <div
        className={`absolute left-1/2 -translate-x-1/2 text-center ${compact ? "top-[16%]" : "top-[14%]"}`}
      >
        <div className="font-display text-[10px] tracking-[0.42em] text-tr md:text-xs">{t.killedBy}</div>
        <div
          className={`mt-1 font-display tracking-[0.18em] text-fg ${compact ? "text-3xl" : "text-5xl"}`}
        >
          {hud.killMsg || "—"}
        </div>
        {hud.killGun ? (
          <div className="mt-1 font-mono text-[10px] tracking-[0.32em] text-muted md:text-xs">{hud.killGun}</div>
        ) : null}
        {hud.killerHp > 0 ? (
          <div className="mx-auto mt-3 h-1.5 w-44 overflow-hidden bg-elevated">
            <div className="h-full bg-hp" style={{ width: `${Math.min(100, hud.killerHp)}%` }} />
          </div>
        ) : null}
      </div>
      <div
        className={`absolute left-1/2 -translate-x-1/2 text-center font-display tracking-[0.28em] text-muted ${
          compact ? "bottom-10 text-[11px]" : "bottom-12 text-sm"
        }`}
      >
        {tdm ? `${t.respawn} ${Math.max(0, hud.respawnIn).toFixed(1)}` : t.lastStand}
      </div>
    </div>
  );
}

function Killfeed({
  items,
  compact,
}: {
  items: Array<{
    id: number;
    killer: string;
    victim: string;
    head: boolean;
    weapon?: string;
    killerTeam?: string;
    victimTeam?: string;
    youKill?: boolean;
    youDeath?: boolean;
    at?: number;
  }>;
  compact?: boolean;
}) {
  const now = Date.now();
  const live = items.filter((k) => now - (k.at ?? now) < 9000);
  const shown = (compact ? live.slice(-4) : live.slice(-6));
  return (
    <div
      className={`absolute z-[16] flex flex-col gap-0.5 ${compact ? "right-2 top-[4.5rem] items-end" : "right-3 top-3 items-end"}`}
    >
      {shown.map((k) => {
        const gun = FEED_GUN[k.weapon ?? ""] ?? String(k.weapon ?? "×").toUpperCase();
        const you = k.youKill || k.youDeath;
        const kCol = k.killerTeam === "TR" ? "text-tr" : "text-ct";
        const vCol = k.victimTeam === "TR" ? "text-tr" : "text-ct";
        const age = now - (k.at ?? now);
        const fade = age > 6500 ? Math.max(0.15, 1 - (age - 6500) / 2500) : 1;
        const knife = k.weapon === "knife";
        const nade = k.weapon === "he" || k.weapon === "flash" || k.weapon === "smoke";
        return (
          <div
            key={k.id}
            style={{ opacity: fade }}
            className={`pb-feed-in flex items-center gap-1.5 border px-2 py-0.5 font-display text-[10px] tracking-wider md:text-xs ${
              k.youDeath
                ? "border-tr bg-tr/25"
                : k.youKill
                  ? "border-accent bg-accent/20"
                  : "border-border bg-bg/75"
            }`}
          >
            <span className={`max-w-[6.8rem] truncate ${you && k.youKill ? "text-accent" : kCol}`}>{k.killer}</span>
            <span
              className={`border px-1 py-px font-mono text-[9px] tracking-widest ${
                knife || nade ? "border-warn text-warn" : "border-border bg-elevated text-muted"
              }`}
            >
              {gun}
            </span>
            {k.head ? (
              <span className="inline-block rotate-45 border border-warn px-0.5 font-display text-[8px] tracking-widest text-warn">
                HS
              </span>
            ) : null}
            <span className={`max-w-[6.8rem] truncate ${you && k.youDeath ? "text-fg" : vCol}`}>{k.victim}</span>
          </div>
        );
      })}
    </div>
  );
}

function Scoreboard({
  rows,
  you,
  t,
  hud,
  mvp,
  compact,
}: {
  rows: Array<{
    name: string;
    team: string;
    kills: number;
    deaths: number;
    assists: number;
    ping: number;
    alive?: boolean;
    rkills?: number;
  }>;
  you: string;
  t: (typeof STR)["en"];
  hud: HudSnapshot;
  mvp: string;
  compact?: boolean;
}) {
  const ct = rows.filter((r) => r.team === "CT").sort((a, b) => b.kills - a.kills);
  const tr = rows.filter((r) => r.team === "TR").sort((a, b) => b.kills - a.kills);
  const winCol = hud.bannerTeam === "CT" ? "text-ct" : hud.bannerTeam === "TR" ? "text-tr" : "text-fg";
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-bg/60 p-3">
      <div className={`w-[min(920px,96vw)] ${compact ? "mt-6" : ""}`}>
        <div className="mb-3 text-center">
          {hud.roundOver ? (
            <div className={`font-display tracking-[0.28em] ${winCol} ${compact ? "text-2xl" : "text-4xl"}`}>
              {hud.announcer || t.roundWin}
            </div>
          ) : (
            <div className="font-display text-sm tracking-[0.32em] text-muted">SCOREBOARD</div>
          )}
          {mvp ? (
            <div className="mt-1 font-display text-[11px] tracking-[0.32em] text-accent md:text-sm">
              {t.mvp} · {mvp}
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-center gap-5 font-display">
            <span className={`tabular-nums text-ct ${compact ? "text-xl" : "text-3xl"}`}>{hud.scoreCT}</span>
            <span className="text-muted">:</span>
            <span className={`tabular-nums text-tr ${compact ? "text-xl" : "text-3xl"}`}>{hud.scoreTR}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TeamTable title="CT" color="text-ct" rows={ct} you={you} t={t} mvp={mvp} />
          <TeamTable title="TR" color="text-tr" rows={tr} you={you} t={t} mvp={mvp} />
        </div>
      </div>
    </div>
  );
}

function TeamTable({
  title,
  color,
  rows,
  you,
  t,
  mvp,
}: {
  title: string;
  color: string;
  rows: Array<{ name: string; kills: number; deaths: number; assists: number; ping: number; alive?: boolean }>;
  you: string;
  t: (typeof STR)["en"];
  mvp: string;
}) {
  return (
    <div className="border border-border bg-surface/95">
      <div className={`border-b border-border px-3 py-2 font-display tracking-[0.25em] ${color}`}>{title}</div>
      <div className="grid grid-cols-6 px-3 py-1 font-display text-[10px] tracking-widest text-muted">
        <span className="col-span-2">{t.players}</span>
        <span>K</span>
        <span>D</span>
        <span>A</span>
        <span>{t.ping}</span>
      </div>
      {rows.map((r) => {
        const dead = r.alive === false;
        const isYou = r.name === you;
        const isMvp = mvp && r.name === mvp;
        return (
          <div
            key={r.name}
            className={`grid grid-cols-6 px-3 py-1 font-mono text-sm ${
              isYou ? "bg-accent/15 text-accent" : dead ? "text-muted" : ""
            }`}
          >
            <span className="col-span-2 flex items-center gap-1.5 truncate">
              {isMvp ? <span className="font-display text-[9px] tracking-widest text-accent">MVP</span> : null}
              <span className={dead ? "line-through opacity-70" : ""}>{r.name}</span>
            </span>
            <span>{r.kills}</span>
            <span>{r.deaths}</span>
            <span>{r.assists}</span>
            <span className="text-muted">{r.ping}</span>
          </div>
        );
      })}
    </div>
  );
}

function MobilePad({
  hud,
  t,
  onPause,
  onScore,
}: {
  hud: HudSnapshot;
  t: (typeof STR)["en"];
  onPause: () => void;
  onScore: (v: boolean) => void;
}) {
  const adsOn = useRef(false);
  const lookAt = useRef<{ id: number; x: number; y: number } | null>(null);

  function trackLook(e: ReactPointerEvent, start: boolean) {
    if (isGhostMouse(e.pointerType)) return;
    if (start) {
      markPointer(e.pointerType);
      lookAt.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      return;
    }
    const l = lookAt.current;
    if (!l || l.id !== e.pointerId) return;
    sendLook(e.clientX - l.x, e.clientY - l.y);
    l.x = e.clientX;
    l.y = e.clientY;
  }

  function bindHold(name: TouchAction) {
    return {
      onPointerDown: (e: ReactPointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        window.__pbEngine?.setAction(name, true);
        trackLook(e, true);
      },
      onPointerMove: (e: ReactPointerEvent) => trackLook(e, false),
      onPointerUp: () => {
        window.__pbEngine?.setAction(name, false);
        lookAt.current = null;
      },
      onPointerCancel: () => {
        window.__pbEngine?.setAction(name, false);
        lookAt.current = null;
      },
    };
  }

  function bindToggle(name: "ads" | "crouch", flag: { current: boolean }) {
    return {
      onPointerDown: (e: ReactPointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        flag.current = !flag.current;
        window.__pbEngine?.setAction(name, flag.current);
        trackLook(e, true);
      },
      onPointerMove: (e: ReactPointerEvent) => trackLook(e, false),
      onPointerUp: () => {
        lookAt.current = null;
      },
      onPointerCancel: () => {
        lookAt.current = null;
      },
    };
  }

  const needUse = Boolean(hud.siteHint);

  return (
    <div className="absolute inset-0 z-10">
      <LookZone />
      <MoveStick />

      <div
        className="pointer-events-auto absolute right-2 top-2 flex gap-1"
        style={{ top: "max(0.5rem, env(safe-area-inset-top))", right: "max(0.5rem, env(safe-area-inset-right))" }}
      >
        <IconBtn
          onPointerDown={(e) => {
            e.preventDefault();
            onScore(true);
          }}
          onPointerUp={() => onScore(false)}
          onPointerCancel={() => onScore(false)}
        >
          <Rows3 className="size-4" />
        </IconBtn>
        <IconBtn onPointerDown={onPause}>
          <Pause className="size-4" />
        </IconBtn>
      </div>

      <div
        className="pointer-events-auto absolute flex flex-col items-end gap-2"
        style={{
          right: "max(0.6rem, env(safe-area-inset-right))",
          bottom: "max(0.85rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mb-1 flex gap-1.5">
          {[
            { n: 1, id: hud.primary },
            { n: 2, id: hud.pistol },
            { n: 3, id: "knife" as WeaponId },
            { n: 4, id: hud.nade },
          ].map((it) => {
            const on = hud.weapon === it.id;
            const dry = it.n === 4 && hud.nades <= 0;
            return (
              <button
                key={it.n}
                type="button"
                className={`h-9 w-9 border font-display text-xs tracking-widest ${
                  on ? "border-accent bg-accent text-bg" : dry ? "border-line bg-bg/40 text-faint" : "border-line bg-bg/55 text-fg"
                }`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.__pbEngine?.setSlot(it.n);
                }}
              >
                {it.n}
              </button>
            );
          })}
        </div>
        <div className="flex items-end gap-2">
          <div className="mb-3 flex flex-col gap-2">
            <PadBtn {...bindHold("reload")}>{t.touchRel}</PadBtn>
            <PadBtn {...bindToggle("ads", adsOn)} active={hud.ads}>
              {t.touchAds}
            </PadBtn>
            {needUse ? <PadBtn {...bindHold("use")}>USE</PadBtn> : <PadBtn {...bindHold("sprint")}>SPR</PadBtn>}
          </div>
          <div className="flex flex-col items-center gap-2">
            <PadBtn {...bindHold("jump")}>{t.touchJump}</PadBtn>
            <PadBtn {...bindHold("fire")} accent wide>
              {t.touchFire}
            </PadBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function sendLook(dx: number, dy: number) {
  const mag = Math.hypot(dx, dy);
  if (mag < 0.6) return;
  const accel = mag > 22 ? 1 + Math.min(1.1, (mag - 22) / 52) : mag < 6 ? 0.82 : 1;
  window.__pbEngine?.setLook(dx * accel, dy * accel);
}

let lastTouchAt = 0;

function isGhostMouse(type: string) {
  return type === "mouse" && performance.now() - lastTouchAt < 480;
}

function markPointer(type: string) {
  if (type === "touch" || type === "pen") lastTouchAt = performance.now();
}

function LookZone() {
  const last = useRef<{ id: number; x: number; y: number } | null>(null);
  return (
    <div
      className="pointer-events-auto absolute inset-0 touch-none"
      data-stick="look"
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (isGhostMouse(e.pointerType)) return;
        markPointer(e.pointerType);
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!last.current || last.current.id !== e.pointerId) return;
        const native = e.nativeEvent;
        const coalesced =
          typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [native];
        let x = last.current.x;
        let y = last.current.y;
        let dx = 0;
        let dy = 0;
        for (const ev of coalesced) {
          dx += ev.clientX - x;
          dy += ev.clientY - y;
          x = ev.clientX;
          y = ev.clientY;
        }
        last.current.x = x;
        last.current.y = y;
        sendLook(dx, dy);
      }}
      onPointerUp={(e) => {
        markPointer(e.pointerType);
        if (last.current?.id === e.pointerId) last.current = null;
      }}
      onPointerCancel={() => {
        last.current = null;
      }}
    />
  );
}

function MoveStick() {
  const zone = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const R = 60;

  function restClient() {
    const z = zone.current;
    if (!z) return { x: 78, y: 400 };
    const rect = z.getBoundingClientRect();
    return { x: rect.left + 78, y: rect.bottom - 86 };
  }

  function paint(cx: number, cy: number, kx: number, ky: number, active: boolean) {
    const z = zone.current;
    if (!z || !base.current || !knob.current) return;
    const rect = z.getBoundingClientRect();
    const lx = cx - rect.left;
    const ly = cy - rect.top;
    base.current.style.opacity = active ? "1" : "0.42";
    knob.current.style.opacity = active ? "1" : "0.5";
    base.current.style.transform = `translate(${lx}px, ${ly}px) translate(-50%, -50%)`;
    knob.current.style.transform = `translate(${lx + kx}px, ${ly + ky}px) translate(-50%, -50%)`;
  }

  function apply(px: number, py: number) {
    const o = origin.current;
    if (!o) return;
    let dx = px - o.x;
    let dy = py - o.y;
    let mag = Math.hypot(dx, dy);
    if (mag > R) {
      const pull = mag - R;
      o.x += (dx / mag) * pull;
      o.y += (dy / mag) * pull;
      dx = px - o.x;
      dy = py - o.y;
      mag = Math.hypot(dx, dy);
    }
    const nx = mag > 1e-4 ? dx / R : 0;
    const ny = mag > 1e-4 ? dy / R : 0;
    const m = Math.hypot(nx, ny);
    const dead = 0.16;
    if (m < dead) {
      window.__pbEngine?.setMoveStick(0, 0);
      paint(o.x, o.y, 0, 0, true);
      return;
    }
    const scale = (m - dead) / (1 - dead) / m;
    window.__pbEngine?.setMoveStick(nx * scale, -ny * scale);
    paint(o.x, o.y, nx * R, ny * R, true);
  }

  function release() {
    origin.current = null;
    window.__pbEngine?.setMoveStick(0, 0);
    const r = restClient();
    paint(r.x, r.y, 0, 0, false);
  }

  useEffect(() => {
    const r = restClient();
    paint(r.x, r.y, 0, 0, false);
  }, []);

  return (
    <div
      ref={zone}
      className="pointer-events-auto absolute bottom-0 left-0 top-24 w-[46%] touch-none"
      data-stick="move"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        origin.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        apply(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!origin.current || origin.current.id !== e.pointerId) return;
        apply(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div
        ref={base}
        className="pointer-events-none absolute left-0 top-0 h-32 w-32 rounded-full border border-line bg-bg/40"
        style={{
          transform: "translate(78px, calc(100% - 86px)) translate(-50%, -50%)",
          opacity: 0.42,
        }}
      />
      <div
        ref={knob}
        className="pointer-events-none absolute left-0 top-0 h-14 w-14 rounded-full border border-accent bg-accent/40"
        style={{
          transform: "translate(78px, calc(100% - 86px)) translate(-50%, -50%)",
          opacity: 0.5,
        }}
      />
    </div>
  );
}

function PadBtn({
  children,
  accent,
  wide,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { accent?: boolean; wide?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      className={`border font-display tracking-widest touch-none ${
        wide ? "h-[4.6rem] min-w-[4.6rem] px-3 text-base" : "h-12 min-w-12 px-2 text-xs"
      } ${
        accent
          ? "border-accent bg-accent text-bg"
          : active
            ? "border-accent bg-accent/30 text-accent"
            : "border-line bg-bg/65 text-fg"
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}

function IconBtn({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="flex h-11 w-11 items-center justify-center border border-line bg-bg/70 text-fg touch-none"
      {...rest}
    >
      {children}
    </button>
  );
}
