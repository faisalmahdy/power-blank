export type Team = "CT" | "TR";
export type Mode = "tdm" | "demolition" | "elimination";
export type MapId = "depot" | "harbor" | "bazaar";
export type Phase =
  | "title"
  | "channels"
  | "rooms"
  | "waiting"
  | "playing"
  | "results";
export type Locale = "en" | "id";
export type Quality = "low" | "high";

export type WeaponId =
  | "car15"
  | "ak74"
  | "mp5n"
  | "sr98"
  | "m870"
  | "d50"
  | "g18c"
  | "knife"
  | "he"
  | "flash"
  | "smoke";

export type Slot = "primary" | "pistol" | "melee" | "nade";
export type KitId = "ext" | "rd" | "lsr";
export type ReloadStyle = "mag" | "tube" | "bolt" | "slide" | "none";
export type Tribe = "ar" | "ak" | "smg" | "sr" | "sg" | "pistol" | "autoPistol" | "melee" | "nade";

export type Vec3 = { x: number; y: number; z: number };

export type WeaponDef = {
  id: WeaponId;
  name: string;
  slot: Slot;
  tribe: Tribe;
  dmg: number;
  headMul: number;
  rpm: number;
  mag: number;
  magExt: number;
  reserve: number;
  spread: number;
  moveSpread: number;
  adsSpread: number;
  adsFov: number;
  recoil: Array<[number, number]>;
  recover: number;
  speed: number;
  range: number;
  pellets: number;
  reload: number;
  price: number;
  automatic: boolean;
  penetration: number;
  kits: KitId[];
  reloadStyle: ReloadStyle;
};

export type Loadout = {
  primary: WeaponId;
  pistol: WeaponId;
  nade: WeaponId;
};

export type Settings = {
  sensitivity: number;
  invertY: boolean;
  fov: number;
  master: number;
  sfx: number;
  music: number;
  shake: number;
  locale: Locale;
  quality: Quality;
  crosshair: number;
};

export type Channel = {
  id: string;
  name: string;
  nameId: string;
  cap: number;
  pop: number;
  ping: number;
};

export type RoomInfo = {
  id: string;
  name: string;
  map: MapId;
  mode: Mode;
  players: number;
  cap: number;
  ping: number;
  locked: boolean;
};

export type ScoreRow = {
  id: string;
  name: string;
  team: Team;
  kills: number;
  deaths: number;
  assists: number;
  ping: number;
  bot: boolean;
  alive: boolean;
  rkills: number;
};

export type KillFeedItem = {
  id: number;
  killer: string;
  victim: string;
  weapon: WeaponId;
  head: boolean;
  killerTeam: Team;
  victimTeam: Team;
  youKill: boolean;
  youDeath: boolean;
  at?: number;
};

export type MatchConfig = {
  map: MapId;
  mode: Mode;
  team: Team;
  loadout: Loadout;
  nickname: string;
  botCount: number;
  quality: Quality;
  settings: Settings;
  unlocked: WeaponId[];
  /** Waiting-room 3-2-1 already ran — skip TAP, arm freeze on mount. */
  skipTap?: boolean;
};

export type HudSnapshot = {
  hp: number;
  armor: number;
  ammo: number;
  reserve: number;
  weapon: WeaponId;
  weaponName: string;
  yaw: number;
  x: number;
  z: number;
  ads: boolean;
  reloading: boolean;
  planting: number;
  defusing: number;
  alive: boolean;
  respawnIn: number;
  timer: number;
  scoreCT: number;
  scoreTR: number;
  round: number;
  roundsCT: number;
  roundsTR: number;
  hitmarker: number;
  headshot: boolean;
  hurt: number;
  flash: number;
  killMsg: string;
  killBy: boolean;
  killGun: string;
  announcer: string;
  streak: number;
  bombPlanted: boolean;
  bombTime: number;
  siteHint: string;
  allies: Array<{ x: number; z: number; yaw: number }>;
  enemies: Array<{ x: number; z: number; vis: boolean }>;
  lookingName: string;
  lookingTeam: Team | null;
  lookingHp: number;
  paused: boolean;
  locked: boolean;
  mouseLocked: boolean;
  mode: Mode;
  map: MapId;
  team: Team;
  freeze: number;
  bombX: number;
  bombZ: number;
  bombVisible: boolean;
  money: number;
  bloom: number;
  hurtDir: number;
  sites: Array<{ name: string; x: number; z: number }>;
  bannerKind: "" | "count" | "mission" | "round" | "match" | "bomb" | "defuse" | "blood" | "multi" | "down";
  bannerTeam: Team | null;
  kits: KitId[];
  reloadFrac: number;
  carrying: boolean;
  roundsToWin: number;
  bombSite: string;
  smoke: number;
  cooking: number;
  killerHp: number;
  roundOver: boolean;
  roundMvp: string;
  nades: number;
  primary: WeaponId;
  pistol: WeaponId;
  nade: WeaponId;
};

export type GameEvent =
  | {
      type: "kill";
      killer: string;
      victim: string;
      weapon: WeaponId;
      head: boolean;
      isPlayerKill: boolean;
      isPlayerDeath: boolean;
      killerTeam: Team;
      victimTeam: Team;
    }
  | { type: "roundEnd"; winner: Team }
  | {
      type: "matchEnd";
      winner: Team | "draw";
      rows: ScoreRow[];
      playerKills: number;
      playerDeaths: number;
      playerAssists: number;
      mvp: string;
      gp: number;
      gpWin: number;
      gpKill: number;
      gpAssist: number;
      gpBonus: number;
      scoreCT: number;
      scoreTR: number;
    };
