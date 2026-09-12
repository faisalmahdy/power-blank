import { ChevronLeft, Lock, Send, Settings2, ShoppingBag, Swords, Users } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CHANNELS, usePB } from "@/game/store";
import { MAP_META, STR } from "@/game/strings";
import { NADE_IDS, PISTOL_IDS, PRIMARY_IDS, WEAPONS, magOf } from "@/game/weapons";
import type { MapId, Mode, WeaponId } from "@/game/types";
import { HangoutPreview } from "./Hangout";
import { bootAudio } from "@/game/audio";

export function TitleScreen() {
  const s = usePB();
  const t = STR[s.settings.locale];
  return (
    <div className="relative h-dvh overflow-hidden bg-bg text-fg">
      <img
        src="/game/lobby.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        crossOrigin="anonymous"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-bg/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/50" />
      <header className="relative z-10 flex items-center justify-between gap-3 px-5 py-4">
        <div className="font-display text-lg tracking-[0.4em] text-accent">PB</div>
        <div className="flex min-w-0 items-center gap-3 font-mono text-[10px] text-muted sm:gap-4 sm:text-xs">
          <span className="hidden sm:inline">
            {t.online} 1,{240 + (s.stats.matches % 80)}
          </span>
          <span className="text-warn" suppressHydrationWarning>
            {t.gp} {s.gp}
          </span>
          <span className="truncate text-fg">{s.nick.toUpperCase()}</span>
        </div>
      </header>
      <main className="relative z-10 flex h-[calc(100%-72px)] flex-col justify-end px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] md:justify-center md:px-16">
        <p className="font-display text-xs tracking-[0.55em] text-muted">{t.subtitle}</p>
        <h1 className="mt-2 font-display text-5xl tracking-[0.12em] text-fg md:text-8xl">{t.title}</h1>
        <p className="mt-3 max-w-md text-sm text-muted">
          CT vs TR. Channel in, lock a loadout, clear Depot, Harbor, or Bazaar.
        </p>
        <label className="mt-8 block max-w-xs">
          <span className="font-display text-[10px] tracking-[0.3em] text-muted">{t.nick}</span>
          <input
            value={s.nick}
            maxLength={12}
            suppressHydrationWarning
            onChange={(e) => s.setNick(e.target.value.toUpperCase())}
            className="mt-1 h-11 w-full border border-border bg-elevated px-3 font-display tracking-[0.2em] text-fg outline-none focus:border-accent"
          />
        </label>
        <div className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="h-12 flex-1 bg-accent font-display text-lg tracking-[0.28em] text-bg"
            onClick={() => s.quickMatch()}
          >
            {t.quick}
          </button>
          <button
            type="button"
            className="h-12 flex-1 border border-border font-display tracking-[0.2em]"
            onClick={() => s.openChannels()}
          >
            {t.channels}
          </button>
        </div>
        <div className="mt-4 flex gap-3">
          <GhostBtn onClick={() => usePB.setState({ showShop: true })}>
            <ShoppingBag className="size-4" /> {t.shop}
          </GhostBtn>
          <GhostBtn onClick={() => usePB.setState({ showSettings: true })}>
            <Settings2 className="size-4" /> {t.settings}
          </GhostBtn>
        </div>
        <div className="mt-8 font-mono text-[11px] text-faint">
          {s.stats.matches} MATCHES · {s.stats.kills} KILLS · {s.stats.wins} WINS
        </div>
      </main>
      {s.showShop && <ShopModal />}
      {s.showSettings && <SettingsModal />}
    </div>
  );
}

function GhostBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 border border-border px-3 font-display text-xs tracking-[0.2em] text-muted hover:border-accent hover:text-fg"
    >
      {children}
    </button>
  );
}

export function ChannelScreen() {
  const s = usePB();
  const t = STR[s.settings.locale];
  return (
    <Shell title={t.channels} onBack={() => s.go("title")}>
      <div className="grid gap-2">
        {CHANNELS.map((c) => {
          const fill = Math.round((c.pop / c.cap) * 100);
          const pingC = c.ping < 25 ? "text-hp" : c.ping < 40 ? "text-warn" : "text-tr";
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => s.enterChannel(c)}
              className="border border-border bg-surface px-4 py-3 text-left hover:border-accent"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display tracking-[0.22em]">
                    {s.settings.locale === "id" ? c.nameId : c.name}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-muted">
                    {c.pop}/{c.cap} {t.players}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-xs tabular-nums ${pingC}`}>{c.ping}ms</span>
                  <Users className="size-4 text-accent" />
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden bg-elevated">
                <div className="h-full bg-accent" style={{ width: `${fill}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

export function RoomScreen() {
  const s = usePB();
  const t = STR[s.settings.locale];
  const [open, setOpen] = useState(false);
  const [map, setMap] = useState<MapId>("depot");
  const [mode, setMode] = useState<Mode>("demolition");
  const [name, setName] = useState("");
  return (
    <Shell
      title={s.channel ? (s.settings.locale === "id" ? s.channel.nameId : s.channel.name) : t.room}
      onBack={() => s.go("channels")}
    >
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          className="h-10 flex-1 bg-accent font-display tracking-[0.2em] text-bg"
          onClick={() => setOpen(true)}
        >
          {t.create}
        </button>
        <button
          type="button"
          className="h-10 flex-1 border border-border font-display tracking-[0.2em]"
          onClick={() => s.quickMatch()}
        >
          {t.quick}
        </button>
      </div>
      <div className="border border-border">
        <div className="hidden grid-cols-12 bg-elevated px-3 py-2 font-display text-[10px] tracking-widest text-muted sm:grid">
          <span className="col-span-4">{t.room}</span>
          <span className="col-span-3">{t.map}</span>
          <span className="col-span-3">{t.mode}</span>
          <span className="col-span-2">{t.players}</span>
        </div>
        {s.rooms.map((r, i) => (
          <button
            key={r.id}
            type="button"
            disabled={r.locked || r.players >= r.cap}
            onClick={() => s.joinRoom(r)}
            className="grid w-full grid-cols-2 border-t border-border px-3 py-3 text-left hover:bg-elevated disabled:opacity-40 sm:grid-cols-12 sm:items-center sm:py-2"
          >
            <span className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-4">
              {r.locked ? <Lock className="size-3 shrink-0 text-faint" /> : null}
              <span className="truncate font-display tracking-wider">
                <span className="mr-2 font-mono text-[10px] text-faint">#{String(i + 1).padStart(2, "0")}</span>
                {r.name}
              </span>
            </span>
            <span className="mt-1 font-mono text-xs text-muted sm:col-span-3 sm:mt-0 sm:text-sm">
              {MAP_META[r.map]?.name}
            </span>
            <span className="mt-1 text-right sm:col-span-3 sm:mt-0 sm:text-left">
              <span
                className={`inline-block border px-1.5 py-0.5 font-display text-[10px] tracking-widest ${
                  r.mode === "demolition"
                    ? "border-accent text-accent"
                    : r.mode === "tdm"
                      ? "border-ct text-ct"
                      : "border-line text-muted"
                }`}
              >
                {r.mode === "demolition" ? "DEM" : r.mode === "tdm" ? "TDM" : "ELIM"}
              </span>
            </span>
            <span className="col-span-2 mt-2 sm:col-span-2 sm:mt-0">
              <span className="font-mono text-xs">
                {r.players}/{r.cap}
              </span>
              <span className="mt-0.5 flex h-1 overflow-hidden bg-elevated">
                <span className="h-full bg-accent" style={{ width: `${(r.players / r.cap) * 100}%` }} />
              </span>
            </span>
          </button>
        ))}
      </div>
      {open && (
        <Modal onClose={() => setOpen(false)} title={t.create}>
          <Field label={t.room}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              className="h-10 w-full border border-border bg-elevated px-2 font-display tracking-widest outline-none"
            />
          </Field>
          <Field label={t.map}>
            <select
              value={map}
              onChange={(e) => setMap(e.target.value as MapId)}
              className="h-10 w-full border border-border bg-elevated px-2 outline-none"
            >
              {Object.keys(MAP_META).map((id) => (
                <option key={id} value={id}>
                  {MAP_META[id]!.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.mode}>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="h-10 w-full border border-border bg-elevated px-2 outline-none"
            >
              <option value="tdm">{t.tdm}</option>
              <option value="demolition">{t.demolition}</option>
              <option value="elimination">{t.elimination}</option>
            </select>
          </Field>
          <button
            type="button"
            className="mt-4 h-11 w-full bg-accent font-display tracking-[0.25em] text-bg"
            onClick={() => {
              s.createRoom(map, mode, name);
              setOpen(false);
            }}
          >
            {t.create}
          </button>
        </Modal>
      )}
    </Shell>
  );
}

export function WaitingRoom() {
  const s = usePB();
  const t = STR[s.settings.locale];
  const room = s.room;
  const [draft, setDraft] = useState("");
  const [launch, setLaunch] = useState(0);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (usePB.getState().phase === "waiting") usePB.getState().tickLobby();
    }, 700);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "end" });
  }, [s.chat.length]);
  useEffect(() => {
    if (launch <= 0) return;
    const id = window.setTimeout(() => {
      if (launch <= 1) {
        usePB.getState().startMatch();
        return;
      }
      setLaunch((n) => n - 1);
    }, 900);
    return () => window.clearTimeout(id);
  }, [launch]);
  if (!room) return null;
  const ct = s.slots.filter((x) => x.team === "CT");
  const tr = s.slots.filter((x) => x.team === "TR");
  const filled = s.slots.filter((x) => !x.empty).length;
  const meta = MAP_META[room.map];
  const youReady = s.ready;
  function begin() {
    if (launch > 0) return;
    bootAudio();
    s.fillEmpty();
    setLaunch(3);
  }
  function send() {
    s.sendChat(draft);
    setDraft("");
  }
  return (
    <div className="relative flex h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <button type="button" onClick={() => s.leaveRoom()} className="inline-flex items-center gap-1 text-muted">
          <ChevronLeft className="size-4" /> {t.back}
        </button>
        <div className="text-center">
          <div className="font-display tracking-[0.25em]">{room.name}</div>
          <div className="font-mono text-[10px] text-muted">
            {t.roomNo} · {filled}/{room.cap} · {t.host}
          </div>
        </div>
        <div className="font-mono text-xs text-warn">
          {t.gp} {s.gp}
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_300px]">
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="grid min-h-0 flex-1 grid-cols-2 overflow-auto">
            <SlotCol title="CT" color="bg-ct" img="/game/ct.jpg" slots={ct} you={s.nick.toUpperCase()} emptyLabel={t.emptySlot} />
            <SlotCol title="TR" color="bg-tr" img="/game/tr.jpg" slots={tr} you={s.nick.toUpperCase()} emptyLabel={t.emptySlot} />
          </div>
          <div className="border-t border-border bg-panel p-2">
            <div className="mb-1 max-h-20 overflow-auto font-mono text-[11px] text-muted">
              {s.chat.map((c) => (
                <div key={c.id}>
                  <span className={c.from === "SYSTEM" ? "text-warn" : "text-accent"}>{c.from}</span> {c.text}
                </div>
              ))}
              <div ref={chatEnd} />
            </div>
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.chatPh}
                maxLength={80}
                className="h-10 min-w-0 flex-1 border border-border bg-elevated px-2 font-mono text-sm outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-1 border border-border px-3 font-display text-xs tracking-widest"
              >
                <Send className="size-3.5" /> {t.send}
              </button>
            </form>
          </div>
        </div>
        <aside className="flex min-h-0 flex-col overflow-auto border-t border-border bg-surface md:border-l md:border-t-0">
          <div className="relative h-36 w-full shrink-0 bg-bg md:h-44">
            <HangoutPreview team={s.team} weapon={s.loadout.primary} />
            <div className="pointer-events-none absolute left-2 top-2 font-display text-[10px] tracking-[0.28em] text-accent">
              {s.team} · {WEAPONS[s.loadout.primary].name}
            </div>
          </div>
          <div className="p-4">
            <div className="font-display tracking-[0.2em]">{meta?.name}</div>
            <p className="mt-1 text-xs text-muted">{s.settings.locale === "id" ? meta?.blurbId : meta?.blurb}</p>
            <div className="mt-3 font-display text-xs tracking-widest text-accent">
              {room.mode === "tdm"
                ? t.tdm
                : room.mode === "demolition"
                  ? `${t.demolition} · ${t.firstTo}`
                  : t.elimination}
            </div>
            <div className="mt-4 space-y-2">
              <LoadoutPick
                label={t.primary}
                ids={PRIMARY_IDS}
                value={s.loadout.primary}
                onChange={(id) => s.setLoadout({ primary: id })}
              />
              <LoadoutPick
                label={t.pistol}
                ids={PISTOL_IDS}
                value={s.loadout.pistol}
                onChange={(id) => s.setLoadout({ pistol: id })}
              />
              <LoadoutPick
                label={t.nade}
                ids={NADE_IDS}
                value={s.loadout.nade}
                onChange={(id) => s.setLoadout({ nade: id })}
              />
              <button
                type="button"
                onClick={() => usePB.setState({ showShop: true })}
                className="h-9 w-full border border-border font-display text-[11px] tracking-[0.22em]"
              >
                {t.shop}
              </button>
            </div>
            <button
              type="button"
              onClick={() => s.swapTeam()}
              className="mt-4 h-10 w-full border border-border font-display text-xs tracking-[0.2em]"
            >
              {t.swap} · {s.team}
            </button>
            <button
              type="button"
              onClick={() => s.toggleReady()}
              className={`mt-2 h-10 w-full font-display text-xs tracking-[0.2em] ${
                youReady ? "bg-hp text-bg" : "border border-border"
              }`}
            >
              {t.ready}
            </button>
            <button
              type="button"
              onClick={begin}
              disabled={launch > 0}
              className="mt-2 hidden h-12 w-full bg-accent font-display tracking-[0.28em] text-bg disabled:opacity-50 md:block"
            >
              {t.start}
            </button>
          </div>
        </aside>
      </div>
      <div
        className="border-t border-border bg-surface p-3 md:hidden"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={begin}
          disabled={launch > 0}
          className="h-12 w-full bg-accent font-display tracking-[0.28em] text-bg disabled:opacity-50"
        >
          {t.start}
        </button>
      </div>
      {launch > 0 ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-bg/70">
          <div className="relative flex h-32 w-32 items-center justify-center">
            <div className="absolute inset-0 rotate-45 border-2 border-accent" />
            <div className="font-display text-7xl text-accent">{launch}</div>
          </div>
          <div className="mt-6 font-display text-xl tracking-[0.32em] text-accent">{t.matchStarting}</div>
        </div>
      ) : null}
      {s.showShop && <ShopModal />}
    </div>
  );
}

function SlotCol({
  title,
  color,
  img,
  slots,
  you,
  emptyLabel,
}: {
  title: string;
  color: string;
  img: string;
  slots: Array<{ name: string; ready: boolean; you: boolean; ping: number; empty: boolean }>;
  you: string;
  emptyLabel: string;
}) {
  return (
    <div className="border-r border-border">
      <div className={`px-3 py-2 font-display tracking-[0.3em] text-bg ${color}`}>{title}</div>
      {slots.map((sl, i) =>
        sl.empty ? (
          <div key={`${title}-e${i}`} className="flex items-center gap-3 border-b border-border px-3 py-2 opacity-40">
            <div className="h-10 w-10 border border-dashed border-line" />
            <div className="min-w-0 flex-1">
              <div className="font-display tracking-wider text-faint">{emptyLabel}</div>
              <div className="font-mono text-[10px] text-faint">—</div>
            </div>
          </div>
        ) : (
          <div key={sl.name} className="pb-slot-in flex items-center gap-3 border-b border-border px-3 py-2">
            <img src={img} alt="" className="h-10 w-10 object-cover" crossOrigin="anonymous" />
            <div className="min-w-0 flex-1">
              <div className={`truncate font-display tracking-wider ${sl.name === you ? "text-accent" : ""}`}>
                {sl.name}
                {sl.you ? " · YOU" : ""}
              </div>
              <div className="font-mono text-[10px] text-muted">{sl.ping}ms</div>
            </div>
            <Swords className={`size-4 ${sl.ready ? "text-hp" : "text-faint"}`} />
          </div>
        ),
      )}
    </div>
  );
}

function LoadoutPick({
  label,
  ids,
  value,
  onChange,
}: {
  label: string;
  ids: WeaponId[];
  value: WeaponId;
  onChange: (id: WeaponId) => void;
}) {
  const unlocked = usePB((s) => s.unlocked);
  return (
    <label className="block">
      <span className="font-display text-[10px] tracking-[0.25em] text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as WeaponId)}
        className="mt-1 h-9 w-full border border-border bg-elevated px-2 font-mono text-sm outline-none"
      >
        {ids.map((id) => {
          const w = WEAPONS[id];
          const have = unlocked.includes(id) || w.price === 0;
          return (
            <option key={id} value={id} disabled={!have}>
              {w.name}
              {have ? "" : ` · ${w.price} GP`}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function ShopModal() {
  const s = usePB();
  const t = STR[s.settings.locale];
  const tabs = [
    { id: "primary" as const, label: t.primary, ids: PRIMARY_IDS },
    { id: "pistol" as const, label: t.sidearm, ids: PISTOL_IDS },
    { id: "nade" as const, label: t.lethal, ids: NADE_IDS },
  ];
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("primary");
  const ids = tabs.find((x) => x.id === tab)?.ids ?? PRIMARY_IDS;
  const equipped =
    tab === "primary" ? s.loadout.primary : tab === "pistol" ? s.loadout.pistol : s.loadout.nade;

  function own(id: WeaponId) {
    const w = WEAPONS[id];
    return s.unlocked.includes(id) || w.price === 0;
  }

  function equip(id: WeaponId) {
    const w = WEAPONS[id];
    if (w.slot === "primary") s.setLoadout({ primary: id });
    if (w.slot === "pistol") s.setLoadout({ pistol: id });
    if (w.slot === "nade") s.setLoadout({ nade: id });
  }

  function buy(id: WeaponId) {
    const w = WEAPONS[id];
    if (!s.buyWeapon(id, w.price)) return;
    equip(id);
  }

  const sheet = (
    <div className="fixed inset-0 z-[80] flex flex-col bg-bg text-fg">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => usePB.setState({ showShop: false })}
          className="text-muted"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="font-display tracking-[0.28em]">{t.shop}</h1>
        <div className="ml-auto font-mono text-sm text-warn">
          {t.gp} {s.gp}
        </div>
      </header>
      <div className="flex gap-1 border-b border-border px-3 py-2">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={`h-8 px-3 font-display text-[11px] tracking-[0.2em] ${
              tab === x.id ? "bg-accent text-bg" : "border border-border text-muted"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3">
        <div className="grid gap-2 md:grid-cols-2">
          {ids.map((id) => {
            const w = WEAPONS[id];
            const have = own(id);
            const on = equipped === id;
            const dmg = Math.min(100, (w.dmg / 110) * 100);
            const rpm = Math.min(100, (w.rpm / 900) * 100);
            const mag = Math.min(100, (magOf(w) / 40) * 100);
            return (
              <div
                key={id}
                className={`border bg-elevated p-3 ${on ? "border-accent" : "border-border"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display tracking-[0.18em]">{w.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
                      {w.tribe} · {w.automatic ? "AUTO" : "SEMI"}
                    </div>
                  </div>
                  {on ? (
                    <span className="font-display text-[10px] tracking-widest text-accent">{t.equipped}</span>
                  ) : have ? (
                    <span className="font-display text-[10px] tracking-widest text-hp">{t.owned}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-display text-[10px] tracking-widest text-muted">
                      <Lock className="size-3" /> {t.locked}
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1.5">
                  <StatBar label="DMG" value={dmg} />
                  <StatBar label="RPM" value={rpm} />
                  <StatBar label="MAG" value={mag} />
                </div>
                {w.kits.length ? (
                  <div className="mt-2 flex gap-1">
                    {w.kits.map((k) => (
                      <span
                        key={k}
                        className="border border-accent px-1 font-display text-[9px] tracking-[0.16em] text-accent"
                      >
                        {k.toUpperCase()}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 flex justify-end">
                  {have ? (
                    <button
                      type="button"
                      disabled={on}
                      className="h-9 px-3 font-display text-xs tracking-widest text-accent disabled:text-muted"
                      onClick={() => equip(id)}
                    >
                      {on ? t.equipped : t.buy}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={s.gp < w.price}
                      className="h-9 bg-accent px-3 font-display text-xs tracking-widest text-bg disabled:opacity-40"
                      onClick={() => buy(id)}
                    >
                      {w.price} {t.gp}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div
        className="border-t border-border px-4 py-3 font-mono text-[11px] tracking-widest text-muted"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {WEAPONS[s.loadout.primary].name} · {WEAPONS[s.loadout.pistol].name} · {WEAPONS[s.loadout.nade].name}
      </div>
    </div>
  );
  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.body);
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 font-display text-[9px] tracking-widest text-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden bg-surface">
        <div className="h-full bg-accent" style={{ width: `${Math.max(6, value)}%` }} />
      </div>
    </div>
  );
}

export function SettingsModal() {
  const s = usePB();
  const t = STR[s.settings.locale];
  const st = s.settings;
  return (
    <Modal onClose={() => usePB.setState({ showSettings: false })} title={t.settings}>
      <Slider
        label={t.sensitivity}
        value={st.sensitivity}
        min={0.3}
        max={2.4}
        step={0.05}
        onChange={(v) => s.setSettings({ sensitivity: v })}
      />
      <Slider
        label={t.fov}
        value={st.fov}
        min={70}
        max={100}
        step={1}
        onChange={(v) => s.setSettings({ fov: v })}
      />
      <Slider
        label={t.master}
        value={st.master}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => s.setSettings({ master: v })}
      />
      <Slider
        label={t.sfx}
        value={st.sfx}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => s.setSettings({ sfx: v })}
      />
      <Slider
        label={t.shake}
        value={st.shake}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => s.setSettings({ shake: v })}
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="font-display text-xs tracking-widest text-muted">{t.invertY}</span>
        <button
          type="button"
          className={`h-8 px-3 font-display text-xs ${st.invertY ? "bg-accent text-bg" : "border border-border"}`}
          onClick={() => s.setSettings({ invertY: !st.invertY })}
        >
          {st.invertY ? "ON" : "OFF"}
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-display text-xs tracking-widest text-muted">{t.language}</span>
        <button
          type="button"
          className="h-8 border border-border px-3 font-display text-xs"
          onClick={() => s.setSettings({ locale: st.locale === "en" ? "id" : "en" })}
        >
          {st.locale.toUpperCase()}
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-display text-xs tracking-widest text-muted">{t.quality}</span>
        <button
          type="button"
          className="h-8 border border-border px-3 font-display text-xs"
          onClick={() => s.setSettings({ quality: st.quality === "high" ? "low" : "high" })}
        >
          {st.quality === "high" ? t.high : t.low}
        </button>
      </div>
    </Modal>
  );
}

export function ResultsScreen() {
  const s = usePB();
  const t = STR[s.settings.locale];
  const r = s.result;
  if (!r) return null;
  const win = r.winner === s.team;
  const title = r.winner === "draw" ? t.draw : win ? t.victory : t.defeat;
  const titleCol = win ? "text-hp" : r.winner === "draw" ? "text-warn" : "text-tr";
  const ct = r.rows.filter((x) => x.team === "CT").sort((a, b) => b.kills - a.kills);
  const tr = r.rows.filter((x) => x.team === "TR").sort((a, b) => b.kills - a.kills);
  const you = s.nick.toUpperCase();
  const ledger = [
    { k: t.gpWin, v: r.gpWin },
    { k: t.gpKillLine, v: r.gpKill },
    { k: t.gpAssistLine, v: r.gpAssist },
    { k: t.gpMvpBonus, v: r.gpBonus },
  ];
  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <div className="border-b border-border px-5 py-5 md:px-8">
        <div className="font-display text-[10px] tracking-[0.42em] text-muted">{t.results}</div>
        <div className={`mt-1 font-display tracking-[0.18em] ${titleCol} text-4xl md:text-6xl`}>{title}</div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-display">
          <span className="tabular-nums text-2xl text-ct md:text-3xl">{r.scoreCT}</span>
          <span className="text-muted">:</span>
          <span className="tabular-nums text-2xl text-tr md:text-3xl">{r.scoreTR}</span>
          <span className="font-mono text-xs tracking-widest text-muted md:text-sm">
            {t.mvp} · {r.mvp}
          </span>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-3 overflow-auto px-4 py-4 md:grid-cols-[1fr_1fr_16rem] md:px-6">
        <MiniBoard title="CT" color="text-ct" rows={ct} you={you} mvp={r.mvp} />
        <MiniBoard title="TR" color="text-tr" rows={tr} you={you} mvp={r.mvp} />
        <div className="border border-border bg-surface/95 p-4">
          <div className="font-display text-xs tracking-[0.32em] text-muted">{t.kda}</div>
          <div className="mt-1 font-display text-2xl tracking-widest text-accent">
            {r.playerKills} / {r.playerDeaths} / {r.playerAssists}
          </div>
          <div className="mt-4 space-y-1.5 font-mono text-sm">
            {ledger.map((l) => (
              <div key={l.k} className="flex justify-between text-muted">
                <span className="font-display text-[10px] tracking-widest">{l.k}</span>
                <span className={l.v > 0 ? "text-hp" : ""}>{l.v > 0 ? `+${l.v}` : l.v}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-border pt-2">
              <span className="font-display text-[10px] tracking-widest text-warn">{t.gpTotal}</span>
              <span className="text-warn">+{r.gp}</span>
            </div>
            <div className="flex justify-between text-xs text-muted">
              <span className="font-display tracking-widest">{t.gp}</span>
              <span>{s.gp}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <button
          type="button"
          className="h-12 w-full bg-accent font-display tracking-[0.28em] text-bg"
          onClick={() => s.go(s.channel ? "rooms" : "title")}
        >
          {t.continue}
        </button>
      </div>
    </div>
  );
}

function MiniBoard({
  title,
  color,
  rows,
  you,
  mvp,
}: {
  title: string;
  color: string;
  rows: Array<{ name: string; kills: number; deaths: number; assists: number }>;
  you: string;
  mvp: string;
}) {
  return (
    <div className="border border-border bg-surface/95">
      <div className={`border-b border-border px-3 py-2 font-display tracking-[0.25em] ${color}`}>{title}</div>
      <div className="grid grid-cols-5 px-3 py-1 font-display text-[10px] tracking-widest text-muted">
        <span className="col-span-2"> </span>
        <span>K</span>
        <span>D</span>
        <span>A</span>
      </div>
      {rows.map((row) => {
        const isYou = row.name === you;
        const isMvp = row.name === mvp;
        return (
          <div
            key={row.name}
            className={`grid grid-cols-5 px-3 py-1 font-mono text-sm ${isYou ? "bg-accent/15 text-accent" : ""}`}
          >
            <span className="col-span-2 flex items-center gap-1 truncate">
              {isMvp ? <span className="font-display text-[9px] tracking-widest text-accent">MVP</span> : null}
              {row.name}
            </span>
            <span>{row.kills}</span>
            <span>{row.deaths}</span>
            <span>{row.assists}</span>
          </div>
        );
      })}
    </div>
  );
}

function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button type="button" onClick={onBack} className="text-muted">
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="font-display tracking-[0.28em]">{title}</h1>
      </header>
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-bg/70 p-3 md:items-center" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
      <div className="w-[min(520px,100%)] border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display tracking-[0.25em]">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted">
            {STR[usePB.getState().settings.locale].back}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-3 block">
      <span className="font-display text-[10px] tracking-[0.25em] text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mt-3 block">
      <div className="flex justify-between font-display text-[10px] tracking-widest text-muted">
        <span>{label}</span>
        <span className="font-mono text-fg">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
        style={{ accentColor: "var(--color-accent)" }}
      />
    </label>
  );
}
