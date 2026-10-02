import { ChevronLeft, Lock, Send, Settings2, ShoppingBag, Users } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CHANNELS, usePB } from "@/game/store";
import { MAP_META, STR } from "@/game/strings";
import { NADE_IDS, PISTOL_IDS, PRIMARY_IDS, WEAPONS } from "@/game/weapons";
import type { MapId, Mode, RoomInfo, WeaponId } from "@/game/types";
import { HangoutPreview } from "./Hangout";
import { bootAudio, lobbyCount } from "@/game/audio";

function pingTone(ms: number) {
  if (ms < 40) return "text-hp";
  if (ms < 80) return "text-warn";
  return "text-tr";
}

export function TitleScreen() {
  const s = usePB();
  const t = STR[s.settings.locale];
  const last = CHANNELS.find((c) => c.id === s.lastChannelId);
  const lastRoom = s.lastRoom;
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
        <div className="mt-6 flex max-w-xl flex-col gap-2">
          {last ? (
            <button
              type="button"
              className="h-12 w-full bg-accent font-display text-lg tracking-[0.28em] text-bg"
              onClick={() => {
                s.enterChannel(last);
                if (lastRoom) s.joinRoom(lastRoom);
              }}
            >
              {t.cont} · {lastRoom ? lastRoom.name : s.settings.locale === "id" ? last.nameId : last.name}
            </button>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className={`h-12 flex-1 font-display text-lg tracking-[0.28em] ${
                s.lastChannelId ? "border border-border" : "bg-accent text-bg"
              }`}
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
  const bestPing = Math.min(...CHANNELS.map((c) => c.ping));
  const hottest = Math.max(...CHANNELS.map((c) => c.pop / c.cap));
  return (
    <Shell title={t.channels} onBack={() => s.go("title")}>
      <div className="grid gap-2">
        {CHANNELS.map((c) => {
          const fill = c.pop / c.cap;
          const pct = Math.round(fill * 100);
          const pingC = pingTone(c.ping);
          const isRec = c.ping === bestPing;
          const isHot = c.pop / c.cap === hottest;
          const isLast = s.lastChannelId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => s.enterChannel(c)}
              className="min-h-12 border border-border bg-surface px-4 py-3 text-left hover:border-accent"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display tracking-[0.22em]">
                      {s.settings.locale === "id" ? c.nameId : c.name}
                    </span>
                    {isRec ? (
                      <span className="border border-hp px-1.5 py-0.5 font-display text-[10px] tracking-widest text-hp">
                        {t.rec}
                      </span>
                    ) : null}
                    {isHot ? (
                      <span className="border border-tr px-1.5 py-0.5 font-display text-[10px] tracking-widest text-tr">
                        {t.hot}
                      </span>
                    ) : null}
                    {isLast ? (
                      <span className="border border-accent px-1.5 py-0.5 font-display text-[10px] tracking-widest text-accent">
                        {t.last}
                      </span>
                    ) : null}
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
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden bg-elevated">
                  <div
                    className={`h-full ${pct >= 90 ? "bg-tr" : pct >= 70 ? "bg-warn" : "bg-hp"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="shrink-0 font-mono text-[10px] text-muted">{pct}%</span>
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
  const [gate, setGate] = useState<RoomInfo | null>(null);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [modeFilter, setModeFilter] = useState<"all" | Mode>("all");
  const [mapFilter, setMapFilter] = useState<"all" | MapId>("all");
  const [hideFull, setHideFull] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"num" | "ping" | "fill">("num");
  const q = query.trim().toUpperCase();
  const hit = (r: RoomInfo) =>
    !q ||
    r.name.toUpperCase().includes(q) ||
    (MAP_META[r.map]?.name ?? "").toUpperCase().includes(q);
  const seat = (r: RoomInfo) => !hideFull || r.players < r.cap;
  const listed = s.rooms
    .map((r, i) => ({ r, i }))
    .filter(
      (x) =>
        (modeFilter === "all" || x.r.mode === modeFilter) &&
        (mapFilter === "all" || x.r.map === mapFilter) &&
        seat(x.r) &&
        hit(x.r),
    )
    .sort((a, b) => {
      if (sortBy === "ping") return a.r.ping - b.r.ping || a.i - b.i;
      if (sortBy === "fill") {
        const fa = a.r.players / Math.max(1, a.r.cap);
        const fb = b.r.players / Math.max(1, b.r.cap);
        return fb - fa || a.i - b.i;
      }
      return a.i - b.i;
    });
  const byMap = (r: RoomInfo) => mapFilter === "all" || r.map === mapFilter;
  const byMode = (r: RoomInfo) => modeFilter === "all" || r.mode === modeFilter;
  const nAll = s.rooms.filter((r) => byMap(r) && seat(r) && hit(r)).length;
  const nDem = s.rooms.filter((r) => byMap(r) && seat(r) && hit(r) && r.mode === "demolition").length;
  const nTdm = s.rooms.filter((r) => byMap(r) && seat(r) && hit(r) && r.mode === "tdm").length;
  const nElim = s.rooms.filter((r) => byMap(r) && seat(r) && hit(r) && r.mode === "elimination").length;
  const nMapAll = s.rooms.filter((r) => byMode(r) && seat(r) && hit(r)).length;
  const nDepot = s.rooms.filter((r) => byMode(r) && seat(r) && hit(r) && r.map === "depot").length;
  const nHarbor = s.rooms.filter((r) => byMode(r) && seat(r) && hit(r) && r.map === "harbor").length;
  const nBazaar = s.rooms.filter((r) => byMode(r) && seat(r) && hit(r) && r.map === "bazaar").length;
  const nLibrary = s.rooms.filter((r) => byMode(r) && seat(r) && hit(r) && r.map === "library").length;
  const nStreet = s.rooms.filter((r) => byMode(r) && seat(r) && hit(r) && r.map === "street").length;
  function tryPin() {
    if (!gate) return;
    if (pin.trim() === "1234") {
      s.joinRoom(gate);
      setGate(null);
      setPin("");
      setPinErr(false);
      return;
    }
    setPinErr(true);
  }
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
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.searchRoom}
        className="mb-3 h-10 w-full border border-border bg-elevated px-3 font-display tracking-[0.16em] outline-none placeholder:text-faint"
      />
      <div className="mb-3 grid grid-cols-4 gap-1">
        {(
          [
            ["all", t.all, nAll],
            ["demolition", "DEM", nDem],
            ["tdm", "TDM", nTdm],
            ["elimination", "ELIM", nElim],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => setModeFilter(id)}
            className={`h-10 border font-display text-[11px] tracking-[0.14em] ${
              modeFilter === id ? "border-accent bg-accent text-bg" : "border-border text-muted"
            }`}
          >
            {label} {n}
          </button>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1 md:grid-cols-6">
        {(
          [
            ["all", t.all, nMapAll],
            ["depot", "DEPOT", nDepot],
            ["harbor", "HARBOR", nHarbor],
            ["bazaar", "BAZAAR", nBazaar],
            ["library", "LIBRARY", nLibrary],
            ["street", "STREET", nStreet],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMapFilter(id)}
            className={`h-10 border font-display text-[10px] tracking-[0.12em] ${
              mapFilter === id ? "border-accent bg-accent text-bg" : "border-border text-muted"
            }`}
          >
            {label} {n}
          </button>
        ))}
      </div>
      <div className="mb-3 flex gap-1">
        <button
          type="button"
          onClick={() => setHideFull((v) => !v)}
          className={`h-10 min-w-0 flex-1 border font-display text-[10px] tracking-[0.14em] ${
            hideFull ? "border-accent bg-accent text-bg" : "border-border text-muted"
          }`}
        >
          {t.hideFull}
        </button>
        {(
          [
            ["num", "#"],
            ["ping", t.sortPing],
            ["fill", t.sortFill],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSortBy(id)}
            className={`h-10 min-w-14 shrink-0 border px-2 font-display text-[10px] tracking-[0.14em] ${
              sortBy === id ? "border-accent bg-accent text-bg" : "border-border text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="border border-border">
        <div className="hidden grid-cols-12 bg-elevated px-3 py-2 font-display text-[10px] tracking-widest text-muted sm:grid">
          <span className="col-span-4">{t.room}</span>
          <span className="col-span-3">{t.map}</span>
          <span className="col-span-3">{t.mode}</span>
          <span className="col-span-2">{t.players}</span>
        </div>
        {listed.map(({ r, i }) => {
          const mine = s.lastRoom?.id === r.id;
          const row = mine && s.lastRoom ? { ...r, locked: s.lastRoom.locked } : r;
          return (
          <button
            key={r.id}
            type="button"
            disabled={row.players >= row.cap}
            onClick={() => {
              if (row.locked) {
                setGate(row);
                setPin("");
                setPinErr(false);
                return;
              }
              s.joinRoom(row);
            }}
            className={`grid w-full grid-cols-2 border-t border-border px-3 py-3 text-left hover:bg-elevated disabled:opacity-40 sm:grid-cols-12 sm:items-center sm:py-2 ${
              mine ? "border-l-2 border-l-accent bg-elevated" : ""
            }`}
          >
            <span className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-4">
              <span className="relative h-12 w-16 shrink-0">
                <img
                  src={MAP_META[row.map]?.splash ?? "/game/container.jpg"}
                  alt=""
                  className={`h-12 w-16 object-cover border border-border ${row.locked ? "opacity-50" : ""}`}
                  crossOrigin="anonymous"
                />
                {row.locked ? (
                  <Lock className="absolute inset-0 m-auto size-5 text-warn" />
                ) : null}
              </span>
              <span className="min-w-0 truncate font-display tracking-wider">
                <span className="mr-2 font-mono text-[10px] text-faint">#{String(i + 1).padStart(2, "0")}</span>
                {r.name}
                {mine ? (
                  <span className="ml-2 border border-accent px-1.5 py-0.5 font-display text-[10px] tracking-widest text-accent">
                    {t.last}
                  </span>
                ) : null}
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
              <span className="flex items-baseline justify-between gap-2 font-mono text-xs">
                <span>
                  {r.players}/{r.cap}
                </span>
                <span className={pingTone(r.ping)}>{r.ping}ms</span>
              </span>
              <span className="mt-0.5 flex h-1 overflow-hidden bg-elevated">
                <span
                  className={`h-full ${
                    r.players >= r.cap ? "bg-tr" : r.players / r.cap >= 0.75 ? "bg-warn" : "bg-hp"
                  }`}
                  style={{ width: `${(r.players / r.cap) * 100}%` }}
                />
              </span>
            </span>
          </button>
          );
        })}
        {listed.length === 0 ? (
          <div className="border-t border-border px-3 py-6 text-center font-display tracking-[0.28em] text-muted">
            {t.emptyRooms}
          </div>
        ) : null}
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
          <div className="relative mt-3 h-28 overflow-hidden border border-border bg-bg">
            <img
              src={MAP_META[map]?.splash ?? "/game/container.jpg"}
              alt=""
              className="h-full w-full object-cover opacity-70"
              crossOrigin="anonymous"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg/80 to-transparent" />
            <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
              <div className="font-display tracking-[0.22em] text-fg">
                {s.settings.locale === "id" ? MAP_META[map]?.nameId : MAP_META[map]?.name}
              </div>
              <div className="font-display text-[10px] tracking-[0.22em] text-accent">
                {mode === "tdm" ? t.tdm : mode === "demolition" ? t.demolition : t.elimination}
              </div>
            </div>
          </div>
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
      {gate && (
        <Modal
          onClose={() => {
            setGate(null);
            setPin("");
            setPinErr(false);
          }}
          title={t.roomLocked}
        >
          <div className="font-display tracking-wider text-fg">{gate.name}</div>
          <p className="mt-1 font-mono text-xs text-muted">
            {MAP_META[gate.map]?.name} · {gate.players}/{gate.cap}
          </p>
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              tryPin();
            }}
          >
            <Field label={t.password}>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                maxLength={8}
                onChange={(e) => {
                  setPin(e.target.value);
                  setPinErr(false);
                }}
                className="h-10 w-full border border-border bg-elevated px-2 font-mono tracking-[0.4em] outline-none"
              />
            </Field>
            {pinErr ? <div className="mt-2 font-display text-xs tracking-widest text-tr">{t.wrongPass}</div> : null}
            <button type="submit" className="mt-4 h-11 w-full bg-accent font-display tracking-[0.25em] text-bg">
              {t.join}
            </button>
          </form>
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
  const abortLaunch = useRef(false);
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
    lobbyCount(launch);
    const id = window.setTimeout(() => {
      if (abortLaunch.current) return;
      if (launch <= 1) {
        lobbyCount(0);
        usePB.getState().startMatch();
        return;
      }
      setLaunch((n) => n - 1);
    }, 900);
    return () => window.clearTimeout(id);
  }, [launch]);
  useEffect(() => {
    if (!usePB.getState().autoLaunch) return;
    abortLaunch.current = false;
    bootAudio();
    usePB.getState().fillEmpty();
    usePB.setState({ autoLaunch: false, launching: true, showShop: false });
    setLaunch(3);
  }, []);
  if (!room) return null;
  const ct = s.slots.filter((x) => x.team === "CT");
  const tr = s.slots.filter((x) => x.team === "TR");
  const ctLive = ct.filter((x) => !x.empty).length;
  const trLive = tr.filter((x) => !x.empty).length;
  const filled = s.slots.filter((x) => !x.empty).length;
  const readyN = s.slots.filter((x) => !x.empty && x.ready).length;
  const allReady = filled > 0 && readyN === filled;
  const meta = MAP_META[room.map];
  const youReady = s.ready;
  const modeLine =
    room.mode === "tdm" ? t.tdm : room.mode === "demolition" ? `${t.demolition} · ${t.firstTo}` : t.elimination;
  function begin() {
    if (launch > 0 || !allReady) return;
    abortLaunch.current = false;
    bootAudio();
    s.fillEmpty();
    usePB.setState({ launching: true, showShop: false });
    setLaunch(3);
  }
  function cancelLaunch() {
    abortLaunch.current = true;
    setLaunch(0);
    usePB.setState({ launching: false });
    usePB.getState().pushChat("SYSTEM", t.launchAborted);
  }
  function onBack() {
    if (launch > 0) {
      cancelLaunch();
      return;
    }
    s.leaveRoom();
  }
  function send() {
    s.sendChat(draft);
    setDraft("");
  }
  return (
    <div className="relative flex h-dvh flex-col bg-bg text-fg">
      <header className="relative z-40 flex items-center justify-between border-b border-border bg-bg px-4 py-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-muted">
          <ChevronLeft className="size-4" /> {launch > 0 ? t.cancelLaunch : t.back}
        </button>
        <div className="text-center">
          <div className="font-display tracking-[0.25em]">{room.name}</div>
          <div className="font-mono text-[10px] text-muted">
            {t.roomNo} · {filled}/{room.cap} · {t.host}
            {room.locked ? ` · ${t.locked}` : ""}
            {s.lastScore ? ` · ${s.lastScore.ct}:${s.lastScore.tr}` : ""}
          </div>
        </div>
        <div className="font-mono text-xs text-warn">
          {t.gp} {s.gp}
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_300px]">
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="grid min-h-0 flex-1 grid-cols-2 overflow-auto">
            <SlotCol
              title="CT"
              color="bg-ct"
              img="/game/ct.jpg"
              slots={ct}
              you={s.nick.toUpperCase()}
              emptyLabel={t.emptySlot}
              readyLabel={t.ready}
              waitLabel={t.unready}
              kickLabel={t.kick}
              onKick={launch > 0 ? undefined : (name) => s.kickPlayer(name)}
            />
            <SlotCol
              title="TR"
              color="bg-tr"
              img="/game/tr.jpg"
              slots={tr}
              you={s.nick.toUpperCase()}
              emptyLabel={t.emptySlot}
              readyLabel={t.ready}
              waitLabel={t.unready}
              kickLabel={t.kick}
              onKick={launch > 0 ? undefined : (name) => s.kickPlayer(name)}
            />
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
                disabled={launch > 0}
                className="h-10 min-w-0 flex-1 border border-border bg-elevated px-2 font-mono text-sm outline-none focus:border-accent disabled:opacity-40"
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
          <div className="relative h-36 w-full shrink-0 overflow-hidden bg-bg md:h-44">
            <img
              src={meta?.splash ?? "/game/container.jpg"}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-50"
              crossOrigin="anonymous"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg/80 via-transparent to-bg/20" />
            <HangoutPreview team={s.team} weapon={s.loadout.primary} />
            <div className="pointer-events-none absolute left-2 top-2 font-display text-[10px] tracking-[0.28em] text-accent">
              {s.team} · {WEAPONS[s.loadout.primary].name}
            </div>
            <div className="pointer-events-none absolute right-2 top-2 font-display text-[10px] tracking-[0.28em] text-fg">
              {s.settings.locale === "id" ? meta?.nameId : meta?.name}
            </div>
            <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
              <div className="font-display text-[10px] tracking-[0.22em] text-accent">{modeLine}</div>
              {s.lastScore ? (
                <div className="font-display text-[10px] tracking-[0.18em]">
                  <span className="text-muted">{t.lastMatch} </span>
                  <span className="text-ct">{s.lastScore.ct}</span>
                  <span className="text-muted">:</span>
                  <span className="text-tr">{s.lastScore.tr}</span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="p-4">
            <div className="font-display tracking-[0.2em]">{meta?.name}</div>
            <p className="mt-1 text-xs text-muted">{s.settings.locale === "id" ? meta?.blurbId : meta?.blurb}</p>
            <div className="mt-3 font-display text-xs tracking-widest text-accent">{modeLine}</div>
            <div className="mt-4 space-y-2">
              <LoadoutPick
                label={t.primary}
                ids={PRIMARY_IDS}
                value={s.loadout.primary}
                locked={launch > 0}
                onChange={(id) => s.setLoadout({ primary: id })}
              />
              <LoadoutPick
                label={t.pistol}
                ids={PISTOL_IDS}
                value={s.loadout.pistol}
                locked={launch > 0}
                onChange={(id) => s.setLoadout({ pistol: id })}
              />
              <LoadoutPick
                label={t.nade}
                ids={NADE_IDS}
                value={s.loadout.nade}
                locked={launch > 0}
                onChange={(id) => s.setLoadout({ nade: id })}
              />
              <button
                type="button"
                disabled={launch > 0}
                onClick={() => usePB.setState({ showShop: true })}
                className="h-9 w-full border border-border font-display text-[11px] tracking-[0.22em] disabled:opacity-40"
              >
                {t.shop}
              </button>
            </div>
            <button
              type="button"
              disabled={launch > 0}
              onClick={() => s.toggleLock()}
              className={`mt-4 h-10 w-full border font-display text-xs tracking-[0.2em] disabled:opacity-40 ${
                room.locked ? "border-warn text-warn" : "border-border"
              }`}
            >
              {room.locked ? t.unlockRoom : t.lockRoom}
            </button>
            <button
              type="button"
              disabled={launch > 0}
              onClick={() => s.swapTeam()}
              className="mt-2 h-10 w-full border border-border font-display text-xs tracking-[0.2em] disabled:opacity-40"
            >
              {t.swap} · {s.team}
            </button>
            <button
              type="button"
              disabled={launch > 0}
              onClick={() => s.toggleReady()}
              className={`mt-2 h-10 w-full font-display text-xs tracking-[0.2em] disabled:opacity-40 ${
                youReady ? "bg-hp text-bg" : "border border-border"
              }`}
            >
              {t.ready}
            </button>
            <button
              type="button"
              onClick={begin}
              disabled={launch > 0 || !allReady}
              className="mt-2 hidden h-12 w-full bg-accent font-display tracking-[0.28em] text-bg disabled:opacity-50 md:block"
            >
              {allReady ? t.start : `${readyN}/${filled} ${t.ready}`}
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
          disabled={launch > 0 || !allReady}
          className="h-12 w-full bg-accent font-display tracking-[0.28em] text-bg disabled:opacity-50"
        >
          {allReady ? t.start : `${readyN}/${filled} ${t.ready}`}
        </button>
      </div>
      {launch > 0 ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden bg-bg">
          <img
            src={meta?.splash ?? "/game/container.jpg"}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-35"
            crossOrigin="anonymous"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-bg/80 via-bg/55 to-bg/90" />
          <div className="relative z-10 flex flex-col items-center px-4 text-center">
            <div className="font-display text-[11px] tracking-[0.42em] text-muted">{t.lockAndLoad}</div>
            <div className="mt-2 font-display text-5xl tracking-[0.18em] text-accent md:text-6xl">
              {s.settings.locale === "id" ? meta?.nameId : meta?.name}
            </div>
            <div className="mt-6 relative flex h-32 w-32 items-center justify-center">
              <div className={`absolute inset-0 rotate-45 border-2 ${s.team === "CT" ? "border-ct" : "border-tr"}`} />
              <div className={`font-display text-7xl ${s.team === "CT" ? "text-ct" : "text-tr"}`}>{launch}</div>
            </div>
            <div className="mt-4 h-1 w-48 overflow-hidden bg-line">
              <div
                className={`h-full ${s.team === "CT" ? "bg-ct" : "bg-tr"}`}
                style={{ width: `${Math.round((launch / 3) * 100)}%` }}
              />
            </div>
            <div className="mt-5 font-display text-xl tracking-[0.32em] text-accent">
              {s.lastScore ? t.rematch : t.matchStarting}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <img
                  src="/game/ct.jpg"
                  alt="CT"
                  className={`h-16 w-16 object-cover border ${s.team === "CT" ? "border-ct ring-2 ring-ct" : "border-ct/40 opacity-80"}`}
                  crossOrigin="anonymous"
                />
                <div className="font-display text-[10px] tracking-[0.24em] text-ct">CT {ctLive}</div>
              </div>
              <div className="min-w-24 text-center">
                {s.lastScore ? (
                  <div className="font-display text-2xl tracking-[0.12em]">
                    <span className="text-ct">{s.lastScore.ct}</span>
                    <span className="text-muted"> : </span>
                    <span className="text-tr">{s.lastScore.tr}</span>
                  </div>
                ) : (
                  <div className="font-display text-lg tracking-[0.32em] text-muted">{t.vs}</div>
                )}
                {s.lastMvp ? (
                  <div className="mt-1 font-display text-[10px] tracking-[0.28em] text-warn">
                    {t.mvp} · {s.lastMvp}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col items-center gap-1">
                <img
                  src="/game/tr.jpg"
                  alt="TR"
                  className={`h-16 w-16 object-cover border ${s.team === "TR" ? "border-tr ring-2 ring-tr" : "border-tr/40 opacity-80"}`}
                  crossOrigin="anonymous"
                />
                <div className="font-display text-[10px] tracking-[0.24em] text-tr">TR {trLive}</div>
              </div>
            </div>
            <div className="mt-2 font-display text-[11px] tracking-[0.28em] text-accent">
              {s.nick.toUpperCase()} · {t.you} · {s.team}
            </div>
            <div className="mt-3 grid w-72 grid-cols-2 gap-x-4 text-left">
              <ul className="space-y-0.5">
                {ct
                  .filter((x) => !x.empty)
                  .map((x) => (
                    <li
                      key={`c-${x.name}`}
                      className={`flex items-baseline justify-between gap-1 font-mono text-[10px] tracking-wider ${x.you ? "text-accent" : "text-ct"}`}
                    >
                      <span className="min-w-0 truncate">
                        {x.name}
                        {x.you ? ` · ${t.you}` : ""}
                        {x.you ? ` · ${t.host}` : ""}
                      </span>
                      <span className={`shrink-0 ${pingTone(x.ping)}`}>{x.ping}</span>
                    </li>
                  ))}
              </ul>
              <ul className="space-y-0.5">
                {tr
                  .filter((x) => !x.empty)
                  .map((x) => (
                    <li
                      key={`t-${x.name}`}
                      className={`flex items-baseline justify-between gap-1 font-mono text-[10px] tracking-wider ${x.you ? "text-accent" : "text-tr"}`}
                    >
                      <span className="min-w-0 truncate">
                        {x.name}
                        {x.you ? ` · ${t.you}` : ""}
                        {x.you ? ` · ${t.host}` : ""}
                      </span>
                      <span className={`shrink-0 ${pingTone(x.ping)}`}>{x.ping}</span>
                    </li>
                  ))}
              </ul>
            </div>
            <div className="mt-3 font-display text-sm tracking-[0.18em] text-fg">
              {s.team} · {WEAPONS[s.loadout.primary].name} · {WEAPONS[s.loadout.pistol].name} · {WEAPONS[s.loadout.nade].name}
            </div>
            <div className="mt-1 font-display text-[10px] tracking-[0.28em] text-muted">{modeLine}</div>
            <button
              type="button"
              onClick={cancelLaunch}
              className="mt-8 h-12 min-w-48 border border-border bg-bg/80 px-6 font-display tracking-[0.28em] text-fg"
            >
              {t.cancelLaunch}
            </button>
          </div>
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
  readyLabel,
  waitLabel,
  kickLabel,
  onKick,
}: {
  title: string;
  color: string;
  img: string;
  slots: Array<{ name: string; ready: boolean; you: boolean; ping: number; empty: boolean }>;
  you: string;
  emptyLabel: string;
  readyLabel: string;
  waitLabel: string;
  kickLabel: string;
  onKick?: (name: string) => void;
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
          <div
            key={sl.name}
            className={`pb-slot-in flex items-center gap-3 border-b border-border px-3 py-2 ${sl.ready ? "" : "opacity-70"}`}
          >
            <img src={img} alt="" className="h-10 w-10 object-cover" crossOrigin="anonymous" />
            <div className="min-w-0 flex-1">
              <div className={`truncate font-display tracking-wider ${sl.name === you ? "text-accent" : ""}`}>
                {sl.name}
                {sl.you ? " · YOU" : ""}
                {sl.you ? " · HOST" : ""}
              </div>
              <div className={`font-mono text-[10px] ${pingTone(sl.ping)}`}>{sl.ping}ms</div>
            </div>
            <span
              className={`shrink-0 border px-1.5 py-1 font-display text-[10px] tracking-widest ${
                sl.ready ? "border-hp text-hp" : "border-warn text-warn"
              }`}
            >
              {sl.ready ? readyLabel : waitLabel}
            </span>
            {onKick && !sl.you ? (
              <button
                type="button"
                onClick={() => onKick(sl.name)}
                className="h-10 shrink-0 border border-tr px-2 font-display text-[10px] tracking-widest text-tr"
              >
                {kickLabel}
              </button>
            ) : null}
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
  locked,
  onChange,
}: {
  label: string;
  ids: WeaponId[];
  value: WeaponId;
  locked?: boolean;
  onChange: (id: WeaponId) => void;
}) {
  const unlocked = usePB((s) => s.unlocked);
  return (
    <label className="block">
      <span className="font-display text-[10px] tracking-[0.25em] text-muted">{label}</span>
      <select
        value={value}
        disabled={locked}
        onChange={(e) => onChange(e.target.value as WeaponId)}
        className="mt-1 h-9 w-full border border-border bg-elevated px-2 font-mono text-sm outline-none disabled:opacity-40"
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

function GunThumb({ id }: { id: WeaponId }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    void import("@/game/preview").then(({ gunThumb }) => {
      if (live) setSrc(gunThumb(id));
    });
    return () => {
      live = false;
    };
  }, [id]);
  if (!src) return <div className="h-16" />;
  return <img src={src} alt="" className="h-16 w-full object-contain" />;
}

function ShieldThumb() {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    void import("@/game/preview").then(({ shieldThumb }) => {
      if (live) setSrc(shieldThumb());
    });
    return () => {
      live = false;
    };
  }, []);
  if (!src) return <div className="h-16" />;
  return <img src={src} alt="" className="h-16 w-full object-contain" />;
}

function SoldierStage({ gun }: { gun: WeaponId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let stop = () => {};
    let dead = false;
    void import("@/game/preview").then(({ mountSoldier }) => {
      if (dead || !ref.current) return;
      stop = mountSoldier(ref.current, gun);
    });
    return () => {
      dead = true;
      stop();
    };
  }, [gun]);
  return <canvas ref={ref} className="h-full min-h-64 w-full" />;
}

export function ShopModal() {
  const s = usePB();
  const t = STR[s.settings.locale];
  const idn = s.settings.locale === "id";
  const pages = [
    { id: "weapon" as const, label: idn ? "SENJATA" : "WEAPON" },
    { id: "character" as const, label: idn ? "KARAKTER" : "CHARACTER" },
    { id: "item" as const, label: "ITEM" },
    { id: "style" as const, label: idn ? "GAYA" : "STYLING" },
    { id: "express" as const, label: idn ? "EMOSI" : "EXPRESS EMOTION" },
  ];
  const cats = [
    { id: "all" as const, label: idn ? "SEMUA" : "All" },
    { id: "main" as const, label: idn ? "UTAMA" : "Main" },
    { id: "secondary" as const, label: idn ? "CADANGAN" : "Secondary" },
    { id: "melee" as const, label: "Melee" },
    { id: "explosive" as const, label: idn ? "LEDAK" : "Explosive" },
    { id: "special" as const, label: "Special" },
  ];
  const [page, setPage] = useState<(typeof pages)[number]["id"]>("weapon");
  const [cat, setCat] = useState<(typeof cats)[number]["id"]>("all");
  const [q, setQ] = useState("");
  const [title, setTitle] = useState(() =>
    typeof localStorage === "undefined" ? "RECRUIT" : localStorage.getItem("pb-title") || "RECRUIT",
  );
  const allIds: WeaponId[] = [...PRIMARY_IDS, ...PISTOL_IDS, "knife", ...NADE_IDS];
  const pool =
    cat === "main"
      ? PRIMARY_IDS
      : cat === "secondary"
        ? PISTOL_IDS
        : cat === "melee"
          ? (["knife"] as WeaponId[])
          : cat === "explosive"
            ? NADE_IDS
            : cat === "special"
              ? ([] as WeaponId[])
              : allIds;
  const query = q.trim().toLowerCase();
  const ids = pool.filter((id) => !query || WEAPONS[id].name.toLowerCase().includes(query));
  const ranks = [
    { name: "RECRUIT", need: 0 },
    { name: "OPERATOR", need: 10 },
    { name: "VETERAN", need: 40 },
    { name: "ACE", need: 100 },
  ];
  const next = ranks.find((r) => r.need > (ranks.find((x) => x.name === title)?.need ?? 0)) ?? ranks[ranks.length - 1]!;

  function own(id: WeaponId) {
    const w = WEAPONS[id];
    return s.unlocked.includes(id) || w.price === 0;
  }

  function equipped(id: WeaponId) {
    const w = WEAPONS[id];
    if (w.slot === "primary") return s.loadout.primary === id;
    if (w.slot === "pistol") return s.loadout.pistol === id;
    if (w.slot === "nade") return s.loadout.nade === id;
    return s.loadout.primary === id;
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

  function acquire() {
    if (s.stats.kills < next.need) return;
    setTitle(next.name);
    try {
      localStorage.setItem("pb-title", next.name);
    } catch {
      /* ignore */
    }
  }

  const sheet = (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#070b12] text-fg">
      <header className="flex items-center gap-2 border-b border-[#1d4e8f] bg-[#071426] px-3 py-2">
        <button type="button" onClick={() => usePB.setState({ showShop: false })} className="text-muted">
          <ChevronLeft className="size-5" />
        </button>
        {pages.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPage(p.id)}
            className={`h-8 px-3 font-display text-[11px] tracking-[0.16em] ${
              page === p.id ? "bg-[#1d6fe0] text-white" : "text-[#9eb4d0]"
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-auto font-mono text-sm text-warn">
          {t.gp} {s.gp}
        </div>
      </header>
      {page === "weapon" ? (
        <>
          <div className="flex flex-wrap gap-1 border-b border-[#16345c] bg-[#0b1626] px-3 py-2">
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={`h-8 px-3 font-display text-[11px] tracking-[0.14em] ${
                  cat === c.id ? "bg-[#1d6fe0] text-white" : "text-[#9eb4d0]"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border-b border-[#16345c] px-3 py-2">
            <label className="font-display text-[11px] tracking-widest text-[#9eb4d0]">
              {idn ? "CARI" : "Search"}:
            </label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 w-56 border border-[#24548f] bg-[#07101c] px-2 font-mono text-sm outline-none"
            />
            <span className="ml-auto font-mono text-sm text-[#d5e6ff]">
              {ids.length} / {allIds.length}
            </span>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {ids.map((id) => {
                const w = WEAPONS[id];
                const have = own(id);
                const on = equipped(id);
                return (
                  <div key={id} className="relative border border-[#1d4e8f] bg-[#07182c] p-2">
                    <div
                      className="absolute inset-0 opacity-40"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle at 50% 40%, #1a4e86 0, transparent 55%), repeating-linear-gradient(30deg, #12345a 0 1px, transparent 1px 10px)",
                      }}
                    />
                    <div className="relative text-center font-display text-[11px] tracking-[0.16em]">{w.name}</div>
                    <div className="relative py-3">
                      <GunThumb id={id} />
                      <span
                        className={`absolute right-1 top-1 rotate-12 px-1 font-display text-[9px] tracking-widest text-white ${
                          have ? "bg-[#c9a227]" : "bg-[#e216a8]"
                        }`}
                      >
                        {have ? (idn ? "MILIK" : "OWNED") : "NOT USE"}
                      </span>
                    </div>
                    <div className="relative flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-[#8eb0d4]">
                        {on ? (idn ? "TERPASANG" : "Equipped") : have ? "1D" : `(Not Used) ${w.price || 0}`}
                      </span>
                      {have ? (
                        <button
                          type="button"
                          disabled={on || w.slot === "melee"}
                          className="h-7 border border-[#1d6fe0] px-2 font-display text-[10px] tracking-widest text-[#7eb6ff] disabled:opacity-40"
                          onClick={() => equip(id)}
                        >
                          {on ? (idn ? "PASANG" : "Equipped") : idn ? "PASANG" : "Equip"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={s.gp < w.price}
                          className="h-7 bg-[#1d6fe0] px-2 font-display text-[10px] tracking-widest text-white disabled:opacity-40"
                          onClick={() => buy(id)}
                        >
                          {idn ? "PAKAI" : "Use"} {w.price}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {cat === "special" ? (
                <div className="relative border border-[#1d4e8f] bg-[#07182c] p-2">
                  <div className="text-center font-display text-[11px] tracking-[0.16em]">SHIELD</div>
                  <div className="relative flex h-16 items-center justify-center">
                    <ShieldThumb />
                    <span className="absolute right-1 top-1 rotate-12 bg-[#e216a8] px-1 font-display text-[9px] tracking-widest text-white">
                      NOT USE
                    </span>
                  </div>
                  <div className="text-center font-mono text-[10px] text-[#8eb0d4]">(Not Used) 3D</div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
      {page === "character" ? (
        <div className="grid flex-1 gap-3 overflow-auto p-3 md:grid-cols-[240px_1fr]">
          <div className="relative min-h-64 overflow-hidden border border-[#1d4e8f] bg-[#071426]">
            <SoldierStage gun={s.loadout.primary} />
            <div className="absolute inset-x-0 bottom-0 bg-black/70 p-3">
              <div className="font-display text-[10px] tracking-[0.28em] text-[#7eb6ff]">CT FORCE</div>
              <div className="font-display text-lg tracking-widest">{s.nick.toUpperCase()}</div>
              <div className="font-mono text-xs text-[#e2b53a]">{title}</div>
            </div>
          </div>
          <div className="border border-[#1d4e8f] bg-black/50 p-3">
            <div className="mb-3 flex gap-2">
              <span className="bg-[#1d6fe0] px-3 py-1 font-display text-[11px] tracking-widest">
                {idn ? "GELAR" : "Title"}
              </span>
              <span className="px-3 py-1 font-display text-[11px] tracking-widest text-[#9eb4d0]">My Info</span>
            </div>
            <div className="font-display text-sm tracking-[0.14em]">Advanced Combat Training</div>
            <div className="mx-auto mt-4 flex w-44 flex-col items-center">
              {ranks.map((r, i) => (
                <div key={r.name} className="flex flex-col items-center">
                  {i > 0 ? <div className="h-4 w-px bg-[#24548f]" /> : null}
                  <div
                    className={`grid h-9 w-9 place-items-center rounded-full border font-display text-[10px] ${
                      title === r.name
                        ? "border-[#e2b53a] bg-[#e2b53a]/20 text-[#e2b53a]"
                        : "border-[#24548f] text-[#9eb4d0]"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className="font-display text-[10px] tracking-widest">{r.name}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center md:grid-cols-4">
              {[
                ["Ribbon", s.stats.wins],
                ["Badge", s.stats.matches],
                ["Medal", s.stats.kills],
                ["Master", Math.floor(s.stats.kills / 5)],
              ].map(([name, n]) => (
                <div key={String(name)} className="border border-[#24548f] px-1 py-2">
                  <div className="mx-auto mb-1 h-6 w-6 rounded-full border border-[#e2b53a]" />
                  <div className="font-display text-[9px] tracking-widest text-[#e2b53a]">{name}</div>
                  <div className="font-mono text-[10px] text-[#3dff8a]">Owned {n}</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={s.stats.kills < next.need || title === "ACE"}
              onClick={acquire}
              className="mt-4 h-9 bg-[#1d6fe0] px-4 font-display tracking-[0.2em] text-white disabled:opacity-40"
            >
              {idn ? "AMBIL" : "Acquire"} {title === "ACE" ? "" : next.name}
            </button>
          </div>
        </div>
      ) : null}
      {page === "item" ? (
        <div className="flex-1 p-4">
          <div className="max-w-sm border border-[#1d4e8f] bg-[#07182c] p-3">
            <div className="font-display tracking-[0.18em]">KEVLAR</div>
            <p className="mt-2 text-sm text-[#9eb4d4]">
              {idn
                ? "Beli di menu beku ronde. 650 GP, armor 100."
                : "Bought in the freeze menu. 650 GP, armor 100."}
            </p>
          </div>
        </div>
      ) : null}
      {page === "style" ? (
        <div className="flex flex-1 gap-3 p-4">
          {["#1d3d2a", "#3a2a14", "#1a2740"].map((c) => (
            <div key={c} className="h-24 w-16 border border-[#1d4e8f]" style={{ background: c }} />
          ))}
        </div>
      ) : null}
      {page === "express" ? (
        <ul className="flex-1 space-y-2 p-4 font-display text-sm tracking-widest text-[#d5e6ff]">
          <li>ENEMY SPOTTED</li>
          <li>NEED BACKUP</li>
          <li>FOLLOW ME</li>
          <li>HOLD POSITION</li>
          <li>GO A</li>
          <li>GO B</li>
        </ul>
      ) : null}
      <div
        className="border-t border-[#16345c] px-4 py-2 font-mono text-[11px] tracking-widest text-[#8eb0d4]"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {title} · {WEAPONS[s.loadout.primary].name} · {WEAPONS[s.loadout.pistol].name} · {WEAPONS[s.loadout.nade].name}
      </div>
    </div>
  );
  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.body);
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
  const titleCol =
    r.winner === "CT" ? "text-ct" : r.winner === "TR" ? "text-tr" : win ? "text-accent" : "text-warn";
  const bar = r.winner === "CT" ? "bg-ct" : r.winner === "TR" ? "bg-tr" : "bg-warn";
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
      <div className={`h-1.5 shrink-0 ${bar}`} />
      <div className="border-b border-border px-4 py-4 md:px-8">
        <div className="font-display text-[10px] tracking-[0.42em] text-muted">{t.results}</div>
        <div className={`pb-slam mt-1 font-display tracking-[0.18em] ${titleCol} text-4xl md:text-7xl`}>
          {title}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-display">
          <span className="tabular-nums text-3xl text-ct md:text-5xl">{r.scoreCT}</span>
          <span className="text-muted">:</span>
          <span className="tabular-nums text-3xl text-tr md:text-5xl">{r.scoreTR}</span>
          <span className="font-display text-[10px] tracking-[0.32em] text-muted">{t.firstTo}</span>
        </div>
        <div className="mt-2 font-display text-[11px] tracking-[0.32em] text-accent md:text-sm">
          {t.mvp} · {r.mvp}
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
      <div
        className="grid grid-cols-1 gap-2 p-4 md:grid-cols-2"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          className="h-12 bg-accent font-display tracking-[0.28em] text-bg"
          onClick={() => s.rematch()}
        >
          {t.playAgain}
        </button>
        <button
          type="button"
          className="h-12 border border-border font-display tracking-[0.28em] text-fg"
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
      <div className="grid grid-cols-6 px-3 py-1 font-display text-[10px] tracking-widest text-muted">
        <span>#</span>
        <span className="col-span-2"> </span>
        <span>K</span>
        <span>D</span>
        <span>A</span>
      </div>
      {rows.map((row, i) => {
        const isYou = row.name === you;
        const isMvp = row.name === mvp;
        return (
          <div
            key={row.name}
            className={`grid grid-cols-6 px-3 py-1.5 font-mono text-sm ${
              isYou ? "border-l-2 border-accent bg-accent/15 text-accent" : ""
            }`}
          >
            <span className="text-muted">{i + 1}</span>
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
