import { useCallback, useEffect } from "react";
import { usePB } from "@/game/store";
import type { GameEvent, MatchConfig } from "@/game/types";
import { GameScreen } from "./GameScreen";
import { ChannelScreen, ResultsScreen, RoomScreen, TitleScreen, WaitingRoom } from "./Menus";

export function PowerBlankApp() {
  const phase = usePB((s) => s.phase);
  const matchKey = usePB((s) => s.matchKey);
  const room = usePB((s) => s.room);
  const team = usePB((s) => s.team);
  const loadout = usePB((s) => s.loadout);
  const nick = usePB((s) => s.nick);
  const settings = usePB((s) => s.settings);
  const unlocked = usePB((s) => s.unlocked);
  const pushKill = usePB((s) => s.pushKill);
  const finishMatch = usePB((s) => s.finishMatch);
  const leaveRoom = usePB((s) => s.leaveRoom);
  const hydrateSave = usePB((s) => s.hydrateSave);

  useEffect(() => {
    hydrateSave();
  }, [hydrateSave]);

  const onEvent = useCallback(
    (e: GameEvent) => {
      if (e.type === "kill") {
        pushKill({
          killer: e.killer,
          victim: e.victim,
          weapon: e.weapon,
          head: e.head,
          killerTeam: e.killerTeam,
          victimTeam: e.victimTeam,
          youKill: e.isPlayerKill,
          youDeath: e.isPlayerDeath,
        });
      }
      if (e.type === "matchEnd") {
        finishMatch({
          winner: e.winner,
          rows: e.rows,
          gp: e.gp,
          mvp: e.mvp,
          playerKills: e.playerKills,
          playerDeaths: e.playerDeaths,
          playerAssists: e.playerAssists,
          gpWin: e.gpWin,
          gpKill: e.gpKill,
          gpAssist: e.gpAssist,
          gpBonus: e.gpBonus,
          scoreCT: e.scoreCT,
          scoreTR: e.scoreTR,
        });
      }
    },
    [pushKill, finishMatch],
  );

  if (phase === "title") return <TitleScreen />;
  if (phase === "channels") return <ChannelScreen />;
  if (phase === "rooms") return <RoomScreen />;
  if (phase === "waiting") return <WaitingRoom />;
  if (phase === "results") return <ResultsScreen />;

  const cfg: MatchConfig = {
    map: room?.map ?? "depot",
    mode: room?.mode ?? "tdm",
    team,
    loadout,
    nickname: nick || "SOLDIER",
    botCount: Math.max(6, (room?.cap ?? 8) - 1),
    quality: settings.quality,
    settings,
    unlocked,
    skipTap: true,
  };

  return (
    <GameScreen
      key={matchKey}
      cfg={cfg}
      onEvent={onEvent}
      onQuit={() => leaveRoom()}
    />
  );
}
