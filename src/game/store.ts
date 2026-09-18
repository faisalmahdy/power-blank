import { create } from "zustand";
import type {
  Channel,
  KillFeedItem,
  Loadout,
  Locale,
  MapId,
  Mode,
  Phase,
  RoomInfo,
  ScoreRow,
  Settings,
  Team,
  WeaponId,
} from "./types";
import { BOT_NAMES, LOBBY_BANTER, STR } from "./strings";

const SAVE_KEY = "powerblank_v1";

const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1.15,
  invertY: false,
  fov: 82,
  master: 0.85,
  sfx: 1,
  music: 0.35,
  shake: 0.7,
  locale: "en",
  quality: "high",
  crosshair: 1,
};

const DEFAULT_LOADOUT: Loadout = { primary: "car15", pistol: "d50", nade: "he" };

function ownedIds(unlocked: WeaponId[], loadout: Loadout): WeaponId[] {
  const set = new Set<WeaponId>([
    "car15",
    "ak74",
    "d50",
    "g18c",
    "knife",
    "he",
    ...unlocked,
    loadout.primary,
    loadout.pistol,
    loadout.nade,
  ]);
  return [...set];
}

function parseLoadout(raw: unknown): Loadout {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_LOADOUT };
  const p = raw as Partial<Loadout>;
  const ids = new Set<string>(["car15", "ak74", "mp5n", "sr98", "m870", "d50", "g18c", "he", "flash", "smoke"]);
  return {
    primary: ids.has(p.primary ?? "") ? (p.primary as Loadout["primary"]) : DEFAULT_LOADOUT.primary,
    pistol: ids.has(p.pistol ?? "") ? (p.pistol as Loadout["pistol"]) : DEFAULT_LOADOUT.pistol,
    nade: ids.has(p.nade ?? "") ? (p.nade as Loadout["nade"]) : DEFAULT_LOADOUT.nade,
  };
}

function loadSave(): {
  nick: string;
  gp: number;
  unlocked: WeaponId[];
  settings: Settings;
  stats: { matches: number; kills: number; wins: number };
  loadout: Loadout;
} {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) throw new Error("none");
    const p = JSON.parse(raw) as Partial<ReturnType<typeof loadSave>>;
    return {
      nick: typeof p.nick === "string" && p.nick.trim() ? p.nick.slice(0, 12) : "SOLDIER",
      gp: typeof p.gp === "number" ? p.gp : 8400,
      unlocked: ownedIds(
        Array.isArray(p.unlocked) ? (p.unlocked as WeaponId[]) : ["car15", "ak74", "d50", "g18c", "knife", "he"],
        parseLoadout(p.loadout),
      ),
      settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
      stats: p.stats ?? { matches: 0, kills: 0, wins: 0 },
      loadout: parseLoadout(p.loadout),
    };
  } catch {
    return {
      nick: "SOLDIER",
      gp: 8400,
      unlocked: ["car15", "ak74", "d50", "g18c", "knife", "he"],
      settings: DEFAULT_SETTINGS,
      stats: { matches: 0, kills: 0, wins: 0 },
      loadout: { ...DEFAULT_LOADOUT },
    };
  }
}

function fakeRooms(channelId: string): RoomInfo[] {
  const maps: MapId[] = ["depot", "harbor", "bazaar"];
  const modes: Mode[] = ["demolition", "demolition", "tdm", "demolition", "elimination"];
  const names = [
    "RANKED #1",
    "NOOB HOUSE",
    "ACE HUNTERS",
    "DEPOT ONLY",
    "NIGHT OPS",
    "CLAN TRYOUT",
    "HEADSHOT LOBBY",
    "FAST TDM",
    "BOMB SQUAD",
    "ROOKIE MIX",
    "ELITE 5V5",
    "SCRIM ROOM",
  ];
  return names.map((name, i) => {
    const cap = i % 3 === 2 ? 10 : 8;
    const players = (Math.abs(hash(`${channelId}${i}`)) % cap) + (i === 0 ? 1 : 0);
    return {
      id: `${channelId}-${i}`,
      name,
      map: maps[i % maps.length]!,
      mode: modes[i % modes.length]!,
      players: Math.min(cap, players),
      cap,
      ping: 18 + ((i * 17) % 95),
      locked: i === 5,
    };
  });
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export const CHANNELS: Channel[] = [
  { id: "rookie", name: "ROOKIE-1", nameId: "PEMULA-1", cap: 200, pop: 142, ping: 22 },
  { id: "veteran", name: "VETERAN-1", nameId: "VETERAN-1", cap: 160, pop: 97, ping: 28 },
  { id: "elite", name: "ELITE-1", nameId: "ELIT-1", cap: 80, pop: 41, ping: 19 },
  { id: "tdm", name: "DEATHMATCH", nameId: "DEATHMATCH", cap: 200, pop: 188, ping: 31 },
  { id: "demo", name: "DEMOLITION", nameId: "DEMOLISI", cap: 120, pop: 64, ping: 25 },
];

export type ChatLine = { id: number; from: string; text: string };

type ResultState = {
  winner: Team | "draw";
  rows: ScoreRow[];
  gp: number;
  mvp: string;
  playerKills: number;
  playerDeaths: number;
  playerAssists: number;
  gpWin: number;
  gpKill: number;
  gpAssist: number;
  gpBonus: number;
  scoreCT: number;
  scoreTR: number;
};

type State = {
  phase: Phase;
  nick: string;
  gp: number;
  unlocked: WeaponId[];
  settings: Settings;
  stats: { matches: number; kills: number; wins: number };
  loadout: Loadout;
  channel: Channel | null;
  rooms: RoomInfo[];
  room: RoomInfo | null;
  team: Team;
  ready: boolean;
  slots: Array<{ name: string; team: Team; ready: boolean; you: boolean; ping: number; empty: boolean }>;
  chat: ChatLine[];
  killfeed: KillFeedItem[];
  scoreboard: boolean;
  result: ResultState | null;
  lastScore: { ct: number; tr: number } | null;
  lastMvp: string | null;
  autoLaunch: boolean;
  launching: boolean;
  matchKey: number;
  showShop: boolean;
  showSettings: boolean;
  setNick: (n: string) => void;
  setSettings: (p: Partial<Settings>) => void;
  setLoadout: (p: Partial<Loadout>) => void;
  buyWeapon: (id: WeaponId, price: number) => boolean;
  hydrateSave: () => void;
  go: (p: Phase) => void;
  openChannels: () => void;
  enterChannel: (c: Channel) => void;
  joinRoom: (r: RoomInfo) => void;
  createRoom: (map: MapId, mode: Mode, name: string) => void;
  quickMatch: () => void;
  swapTeam: () => void;
  toggleReady: () => void;
  startMatch: () => void;
  leaveRoom: () => void;
  pushChat: (from: string, text: string) => void;
  sendChat: (text: string) => void;
  tickLobby: () => void;
  fillEmpty: () => void;
  pushKill: (item: Omit<KillFeedItem, "id">) => void;
  setScoreboard: (v: boolean) => void;
  finishMatch: (r: ResultState) => void;
  rematch: () => void;
  persist: () => void;
};

let chatId = 1;
let killId = 1;

function persistNow(s: State) {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        nick: s.nick,
        gp: s.gp,
        unlocked: s.unlocked,
        settings: s.settings,
        stats: s.stats,
        loadout: s.loadout,
      }),
    );
  } catch {
    /* ignore quota */
  }
}

function emptySlots(team: Team, nick: string, cap: number): State["slots"] {
  const per = Math.ceil(cap / 2);
  const slots: State["slots"] = [];
  for (const t of ["CT", "TR"] as Team[]) {
    for (let k = 0; k < per; k++) {
      if (t === team && k === 0) {
        slots.push({
          name: nick.toUpperCase(),
          team: t,
          ready: true,
          you: true,
          ping: 12,
          empty: false,
        });
      } else {
        slots.push({ name: "", team: t, ready: false, you: false, ping: 0, empty: true });
      }
    }
  }
  return slots;
}

function pickBanter(locale: Locale): string {
  const list = LOBBY_BANTER[locale] ?? LOBBY_BANTER.en;
  return list[Math.floor(Math.random() * list.length)]!;
}


export const usePB = create<State>((set, get) => {
  const saved = typeof window !== "undefined" ? loadSave() : {
    nick: "SOLDIER",
    gp: 8400,
    unlocked: ["car15", "ak74", "d50", "g18c", "knife", "he"] as WeaponId[],
    settings: DEFAULT_SETTINGS,
    stats: { matches: 0, kills: 0, wins: 0 },
    loadout: { ...DEFAULT_LOADOUT },
  };

  return {
    phase: "title",
    nick: saved.nick,
    gp: saved.gp,
    unlocked: saved.unlocked,
    settings: saved.settings,
    stats: saved.stats,
    loadout: saved.loadout,
    channel: null,
    rooms: [],
    room: null,
    team: "CT",
    ready: true,
    slots: [],
    chat: [],
    killfeed: [],
    scoreboard: false,
    result: null,
    lastScore: null,
    lastMvp: null,
    autoLaunch: false,
    launching: false,
    matchKey: 0,
    showShop: false,
    showSettings: false,
    setNick: (n) => {
      set({ nick: n.slice(0, 12) });
      persistNow(get());
    },
    setSettings: (p) => {
      set({ settings: { ...get().settings, ...p } });
      persistNow(get());
    },
    setLoadout: (p) => {
      if (get().launching) return;
      set({ loadout: { ...get().loadout, ...p } });
      persistNow(get());
    },
    buyWeapon: (id, price) => {
      const s = get();
      if (s.launching) return false;
      if (s.unlocked.includes(id)) return true;
      if (s.gp < price) return false;
      set({ gp: s.gp - price, unlocked: ownedIds([...s.unlocked, id], s.loadout) });
      persistNow(get());
      return true;
    },
    hydrateSave: () => {
      if (typeof window === "undefined") return;
      const saved = loadSave();
      set({
        nick: saved.nick,
        gp: saved.gp,
        unlocked: ownedIds(saved.unlocked, saved.loadout),
        settings: saved.settings,
        stats: saved.stats,
        loadout: saved.loadout,
      });
    },
    go: (p) => set({ phase: p, showShop: false, showSettings: false }),
    openChannels: () => set({ phase: "channels", showShop: false, showSettings: false }),
    enterChannel: (c) => set({ channel: c, rooms: fakeRooms(c.id), phase: "rooms" }),
    joinRoom: (r) => {
      const s = get();
      const team: Team = r.mode === "demolition" ? "TR" : "CT";
      const slots = emptySlots(team, s.nick, r.cap);
      set({
        room: { ...r, players: slots.filter((x) => !x.empty).length },
        phase: "waiting",
        team,
        ready: true,
        slots,
        autoLaunch: false,
        launching: false,
        chat: [
          { id: chatId++, from: "SYSTEM", text: `${s.nick.toUpperCase()} entered ${r.name}` },
        ],
      });
    },
    createRoom: (map, mode, name) => {
      const s = get();
      const r: RoomInfo = {
        id: `local-${Date.now()}`,
        name: name || `${s.nick.toUpperCase()}'S ROOM`,
        map,
        mode,
        players: 1,
        cap: 8,
        ping: 14,
        locked: false,
      };
      get().joinRoom(r);
    },
    quickMatch: () => {
      const maps: MapId[] = ["depot", "harbor", "bazaar"];
      const map = maps[Math.floor(Math.random() * maps.length)]!;
      const s = get();
      if (!s.channel) set({ channel: CHANNELS[0]! });
      get().createRoom(map, "demolition", "QUICK MATCH");
    },
    swapTeam: () => {
      if (get().launching) return;
      const team: Team = get().team === "CT" ? "TR" : "CT";
      set({
        team,
        slots: get().slots.map((sl) => (sl.you ? { ...sl, team } : sl)),
      });
    },
    toggleReady: () => {
      if (get().launching) return;
      const ready = !get().ready;
      set({
        ready,
        slots: get().slots.map((sl) => (sl.you ? { ...sl, ready } : sl)),
      });
    },
    sendChat: (text) => {
      const msg = text.trim().slice(0, 80);
      if (!msg) return;
      const s = get();
      if (s.launching) return;
      set({ chat: [...s.chat.slice(-40), { id: chatId++, from: s.nick.toUpperCase(), text: msg }] });
    },
    tickLobby: () => {
      const s = get();
      if (s.phase !== "waiting" || s.launching) return;
      const taken = new Set(s.slots.filter((x) => !x.empty).map((x) => x.name));
      const empties = s.slots
        .map((sl, i) => ({ sl, i }))
        .filter((x) => x.sl.empty);
      const unready = s.slots
        .map((sl, i) => ({ sl, i }))
        .filter((x) => !x.sl.empty && !x.sl.you && !x.sl.ready);

      if (empties.length && (unready.length === 0 || Math.random() < 0.72)) {
        const ctN = s.slots.filter((x) => x.team === "CT" && !x.empty).length;
        const trN = s.slots.filter((x) => x.team === "TR" && !x.empty).length;
        const want: Team = ctN <= trN ? "CT" : "TR";
        const pick = empties.find((x) => x.sl.team === want) ?? empties[0]!;
        const names = BOT_NAMES.filter((n) => n !== s.nick.toUpperCase() && !taken.has(n));
        const name = names[Math.floor(Math.random() * names.length)] ?? `BOT${pick.i}`;
        const slots = s.slots.slice();
        slots[pick.i] = {
          name,
          team: pick.sl.team,
          ready: false,
          you: false,
          ping: 16 + ((pick.i * 23) % 90),
          empty: false,
        };
        set({
          slots,
          chat: [
            ...s.chat.slice(-40),
            { id: chatId++, from: "SYSTEM", text: `${name} ${s.settings.locale === "id" ? "masuk room" : "entered the room"}` },
          ],
          room: s.room ? { ...s.room, players: Math.min(s.room.cap, s.room.players + 1) } : s.room,
        });
        return;
      }

      if (unready.length) {
        const pick = unready[0]!;
        const slots = s.slots.slice();
        slots[pick.i] = { ...pick.sl, ready: true };
        set({
          slots,
          chat: [
            ...s.chat.slice(-40),
            { id: chatId++, from: pick.sl.name, text: pickBanter(s.settings.locale) },
          ],
        });
        return;
      }

      const bots = s.slots.filter((x) => !x.empty && !x.you);
      if (bots.length && Math.random() < 0.4) {
        const b = bots[Math.floor(Math.random() * bots.length)]!;
        set({
          chat: [...s.chat.slice(-40), { id: chatId++, from: b.name, text: pickBanter(s.settings.locale) }],
        });
      }
    },
    fillEmpty: () => {
      const s = get();
      const taken = new Set(s.slots.filter((x) => !x.empty).map((x) => x.name));
      const names = BOT_NAMES.filter((n) => n !== s.nick.toUpperCase() && !taken.has(n));
      let ni = 0;
      const slots = s.slots.map((sl) => {
        if (!sl.empty) return { ...sl, ready: true };
        const name = names[ni % names.length] ?? `BOT${ni}`;
        ni++;
        taken.add(name);
        return {
          name,
          team: sl.team,
          ready: true,
          you: false,
          ping: 18 + ((ni * 29) % 95),
          empty: false,
        };
      });
      const filled = ni;
      set({
        slots,
        ready: true,
        room: s.room ? { ...s.room, players: s.room.cap } : s.room,
        chat:
          filled > 0
            ? [...s.chat.slice(-40), { id: chatId++, from: "SYSTEM", text: "Room filled. Lock and load." }]
            : s.chat,
      });
    },
    startMatch: () => {
      if (get().phase !== "waiting") return;
      set({
        phase: "playing",
        killfeed: [],
        result: null,
        scoreboard: false,
        autoLaunch: false,
        launching: false,
        matchKey: get().matchKey + 1,
      });
    },
    leaveRoom: () =>
      set({
        phase: get().channel ? "rooms" : "title",
        room: null,
        slots: [],
        chat: [],
        lastScore: null,
        lastMvp: null,
        result: null,
        autoLaunch: false,
        launching: false,
      }),
    pushChat: (from, text) =>
      set({ chat: [...get().chat.slice(-40), { id: chatId++, from, text }] }),
    pushKill: (item) =>
      set({
        killfeed: [...get().killfeed.slice(-7), { ...item, id: killId++, at: item.at ?? Date.now() }],
      }),
    setScoreboard: (v) => set({ scoreboard: v }),
    finishMatch: (r) => {
      const s = get();
      const win = r.winner === s.team;
      const gpGain = r.gp;
      const next = {
        gp: s.gp + gpGain,
        stats: {
          matches: s.stats.matches + 1,
          kills: s.stats.kills + r.playerKills,
          wins: s.stats.wins + (win ? 1 : 0),
        },
        result: r,
        lastScore: { ct: r.scoreCT, tr: r.scoreTR },
        lastMvp: r.mvp,
        phase: "results" as Phase,
        scoreboard: false,
      };
      set(next);
      persistNow({ ...get(), ...next });
    },
    rematch: () => {
      const s = get();
      if (!s.room) {
        set({ phase: "title", result: null });
        return;
      }
      const t = STR[s.settings.locale] ?? STR.en;
      const last = s.result
        ? `${s.result.scoreCT}:${s.result.scoreTR}`
        : s.lastScore
          ? `${s.lastScore.ct}:${s.lastScore.tr}`
          : "";
      set({
        phase: "waiting",
        result: null,
        killfeed: [],
        scoreboard: false,
        ready: true,
        showShop: false,
        showSettings: false,
        slots: s.slots.map((sl) => (sl.empty ? sl : { ...sl, ready: true })),
        autoLaunch: true,
        launching: true,
        chat: [
          {
            id: chatId++,
            from: "SYSTEM",
            text: last ? `${t.rematch} · ${t.lastMatch} ${last}` : t.rematch,
          },
        ],
      });
    },
    persist: () => persistNow(get()),
  };
});

export function t(locale: Locale) {
  return locale;
}
