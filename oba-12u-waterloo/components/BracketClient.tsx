"use client";

import { useEffect, useMemo, useState } from "react";
import type { ResolvedGame } from "../lib/types";
import styles from "./BracketEnhancements.module.css";

type Payload = {
  tournament: string;
  location: string;
  database_connected: boolean;
  refreshed_at: string;
  games: ResolvedGame[];
};

type RecordLine = { wins: number; losses: number };
type LineSide = { scores: number[]; totals: number[] };
type MappedLineScore = { a: LineSide; b: LineSide };

const OBA_LOGO_URL = "https://ondeck.baseballontario.com/images/footer_bo_logo.png";
const FAVOURITE_TEAM = "Burlington";

function statusLabel(g: ResolvedGame) {
  const s = (g.game_status || "").toLowerCase();
  if (s === "completed" || s === "final" || s === "closed") return "FINAL";
  if (s.includes("live") || s.includes("progress")) return "LIVE";
  return "UPCOMING";
}

function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map(v => Number(v)).filter(v => Number.isFinite(v));
}

function rawLineScore(g: ResolvedGame) {
  return (g.line_score || null) as
    | {
        team?: { scores?: unknown[]; totals?: unknown[] };
        opponent_team?: { scores?: unknown[]; totals?: unknown[] };
      }
    | null;
}

function normalizeTeamName(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(8u|9u|10u|11u|12u|13u|14u|15u|16u|18u|aaa|aa|rep|baseball|club|team)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamNamesMatch(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeTeamName(a);
  const right = normalizeTeamName(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;

  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  const shared = [...leftTokens].filter(token => rightTokens.has(token));
  const shorter = Math.min(leftTokens.size, rightTokens.size);
  return shorter > 0 && shared.length >= Math.min(2, shorter);
}

function mapLineScore(g: ResolvedGame): MappedLineScore | null {
  const line = rawLineScore(g);
  if (!line) return null;

  const team: LineSide = {
    scores: asNumberArray(line.team?.scores),
    totals: asNumberArray(line.team?.totals)
  };
  const opponent: LineSide = {
    scores: asNumberArray(line.opponent_team?.scores),
    totals: asNumberArray(line.opponent_team?.totals)
  };

  if (!team.scores.length && !opponent.scores.length && !team.totals.length && !opponent.totals.length) {
    return null;
  }

  if (teamNamesMatch(g.gc_opponent_name, g.resolved_team_a)) {
    return { a: opponent, b: team };
  }

  if (teamNamesMatch(g.gc_opponent_name, g.resolved_team_b)) {
    return { a: team, b: opponent };
  }

  return null;
}

function liveInning(g: ResolvedGame) {
  if (statusLabel(g) !== "LIVE") return null;
  const line = rawLineScore(g);
  if (!line) return null;

  const teamInnings = Array.isArray(line.team?.scores) ? line.team!.scores!.length : 0;
  const opponentInnings = Array.isArray(line.opponent_team?.scores)
    ? line.opponent_team!.scores!.length
    : 0;
  const inning = Math.max(teamInnings, opponentInnings);
  return inning > 0 ? inning : null;
}

function liveHalf(g: ResolvedGame) {
  if (statusLabel(g) !== "LIVE") return null;
  const line = rawLineScore(g);
  const homeAway = g.gc_home_away;
  if (!line || !homeAway) return null;

  const teamLen = Array.isArray(line.team?.scores) ? line.team!.scores!.length : 0;
  const oppLen = Array.isArray(line.opponent_team?.scores) ? line.opponent_team!.scores!.length : 0;

  if (teamLen > oppLen) return homeAway === "home" ? "Bottom" : "Top";
  if (oppLen > teamLen) return homeAway === "home" ? "Top" : "Bottom";
  return null;
}

function liveDescriptor(g: ResolvedGame) {
  const inning = liveInning(g);
  if (!inning) return null;
  const half = liveHalf(g);
  return half ? `${half} ${ordinal(inning)}` : `${ordinal(inning)} inning`;
}

function formatTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto"
  }).format(new Date(value));
}

function formatCompactTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto"
  }).format(new Date(value));
}

function winnerSide(g: ResolvedGame) {
  const status = statusLabel(g);
  if (status !== "FINAL" || g.score_a == null || g.score_b == null || g.score_a === g.score_b) return null;
  return g.score_a > g.score_b ? "a" : "b";
}

function winnerName(g: ResolvedGame | undefined) {
  if (!g) return "Winner Game 10";
  const side = winnerSide(g);
  if (side === "a") return g.resolved_team_a;
  if (side === "b") return g.resolved_team_b;
  return "Winner Game 10";
}

function isPlaceholder(name: string) {
  return /^(winner|loser|tbd)/i.test(name.trim());
}

function buildRecords(games: ResolvedGame[]) {
  const records = new Map<string, RecordLine>();

  const get = (name: string) => {
    if (!records.has(name)) records.set(name, { wins: 0, losses: 0 });
    return records.get(name)!;
  };

  for (const g of games) {
    if (!g.enabled || statusLabel(g) !== "FINAL") continue;
    if (g.score_a == null || g.score_b == null || g.score_a === g.score_b) continue;
    if (isPlaceholder(g.resolved_team_a) || isPlaceholder(g.resolved_team_b)) continue;

    const winner = g.score_a > g.score_b ? g.resolved_team_a : g.resolved_team_b;
    const loser = g.score_a > g.score_b ? g.resolved_team_b : g.resolved_team_a;
    get(winner).wins += 1;
    get(loser).losses += 1;
  }

  return records;
}

function gameChangerUrl(gameId: string) {
  const deep = encodeURIComponent(`/events/${gameId}/videos`);
  return `https://onelink.gc.com/a5o2?deep_link_value=${deep}&pid=Copy&c=event_share_link`;
}

function nextRoute(
  game: ResolvedGame,
  outcome: "W" | "L",
  games: ResolvedGame[]
): { primary: string; secondary?: string } {
  const ref = `${outcome}:${game.game_key}`;
  const next = games.find(
    g => g.enabled && (g.team_a_source === ref || g.team_b_source === ref)
  );

  if (next) {
    return {
      primary: `Game ${next.game_key}`,
      secondary: `${formatCompactTime(next.scheduled_at)}${next.field_name ? ` • ${next.field_name}` : ""}`
    };
  }

  const key = game.game_key;

  if (["17", "18"].includes(key)) {
    return outcome === "W"
      ? { primary: "Final Four", secondary: "OBA re-pair" }
      : { primary: "Eliminated" };
  }

  if (key === "19") {
    return { primary: "Final Four", secondary: "OBA re-pair" };
  }

  if (["20", "21"].includes(key)) {
    return {
      primary: "Championship round",
      secondary: "Path depends on remaining teams / loss count"
    };
  }

  if (key === "22A") {
    return outcome === "W"
      ? { primary: "Champion or Game 23A", secondary: "If another game is necessary" }
      : { primary: "Game 23A", secondary: "If necessary" };
  }

  if (key === "22B") {
    return outcome === "W"
      ? { primary: "Game 23B", secondary: "Championship final" }
      : { primary: "Eliminated" };
  }

  if (key === "23A" || key === "23B") {
    return outcome === "W" ? { primary: "Provincial Champion" } : { primary: "Tournament complete" };
  }

  return outcome === "L" ? { primary: "Eliminated" } : { primary: "Next round TBD" };
}

function statAt(totals: number[], index: number) {
  const value = totals[index];
  return Number.isFinite(value) ? value : "—";
}

function TeamNameBlock({
  name,
  records
}: {
  name: string;
  records: Map<string, RecordLine>;
}) {
  const record = records.get(name) || { wins: 0, losses: 0 };
  const eliminated = record.losses >= 2;
  const descriptor =
    record.wins === 0 && record.losses === 0
      ? "0-0"
      : record.losses === 0
        ? `${record.wins}-0 • Undefeated`
        : `${record.wins}-${record.losses} • ${record.losses === 1 ? "1 loss" : "2 losses"}`;

  return (
    <div className={styles.teamIdentity}>
      <span>{name}</span>
      {!isPlaceholder(name) && (
        <small className={eliminated ? styles.eliminatedText : ""}>
          {eliminated ? `${descriptor} • ELIMINATED` : descriptor}
        </small>
      )}
    </div>
  );
}

function BoxScore({ game }: { game: ResolvedGame }) {
  const mapped = mapLineScore(game);
  if (!mapped) return null;

  const innings = Math.max(mapped.a.scores.length, mapped.b.scores.length);
  if (!innings) return null;

  return (
    <div className={styles.boxScoreScroll}>
      <table className={styles.boxScoreTable}>
        <thead>
          <tr>
            <th>Team</th>
            {Array.from({ length: innings }, (_, i) => <th key={i}>{i + 1}</th>)}
            <th>R</th>
            <th>H</th>
            <th>E</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{game.resolved_team_a}</td>
            {Array.from({ length: innings }, (_, i) => <td key={i}>{mapped.a.scores[i] ?? "—"}</td>)}
            <td>{statAt(mapped.a.totals, 0)}</td>
            <td>{statAt(mapped.a.totals, 1)}</td>
            <td>{statAt(mapped.a.totals, 2)}</td>
          </tr>
          <tr>
            <td>{game.resolved_team_b}</td>
            {Array.from({ length: innings }, (_, i) => <td key={i}>{mapped.b.scores[i] ?? "—"}</td>)}
            <td>{statAt(mapped.b.totals, 0)}</td>
            <td>{statAt(mapped.b.totals, 1)}</td>
            <td>{statAt(mapped.b.totals, 2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function BracketClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const res = await fetch("/api/bracket", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load bracket");
      setData(await res.json());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load bracket");
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, []);

  const groups = useMemo(() => {
    const m = new Map<string, ResolvedGame[]>();
    for (const g of data?.games || []) {
      if (!g.enabled) continue;
      if (!m.has(g.round_label)) m.set(g.round_label, []);
      m.get(g.round_label)!.push(g);
    }
    return [...m.entries()];
  }, [data]);

  const records = useMemo(() => buildRecords(data?.games || []), [data]);

  const startingTeams = useMemo(() => {
    const names = new Set<string>();
    for (const g of data?.games || []) {
      const gameNumber = Number(g.game_key);
      if (!Number.isFinite(gameNumber) || gameNumber < 1 || gameNumber > 6) continue;
      if (g.team_a) names.add(g.team_a);
      if (g.team_b) names.add(g.team_b);
    }
    return [...names];
  }, [data]);

  const teamsRemaining = startingTeams.filter(name => (records.get(name)?.losses || 0) < 2).length;
  const liveGames = (data?.games || []).filter(g => g.enabled && statusLabel(g) === "LIVE").length;

  const game10 = data?.games.find(g => g.game_key === "10");
  const byeTeam = winnerName(game10);

  const burlingtonName =
    startingTeams.find(name => name.includes(FAVOURITE_TEAM)) || "Burlington Bulls";
  const burlingtonRecord = records.get(burlingtonName) || { wins: 0, losses: 0 };

  const burlingtonNext = useMemo(() => {
    const candidates = (data?.games || [])
      .filter(g => g.enabled)
      .filter(g =>
        g.resolved_team_a.includes(FAVOURITE_TEAM) ||
        g.resolved_team_b.includes(FAVOURITE_TEAM)
      )
      .filter(g => statusLabel(g) !== "FINAL")
      .sort((a, b) => {
        if (statusLabel(a) === "LIVE" && statusLabel(b) !== "LIVE") return -1;
        if (statusLabel(b) === "LIVE" && statusLabel(a) !== "LIVE") return 1;
        return new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime();
      });

    return candidates[0] || null;
  }, [data]);

  const burlingtonOpponent = burlingtonNext
    ? burlingtonNext.resolved_team_a.includes(FAVOURITE_TEAM)
      ? burlingtonNext.resolved_team_b
      : burlingtonNext.resolved_team_a
    : null;

  return (
    <main>
      <header className="champHero">
        <div className="heroShade" />
        <div className="heroInner">
          <div className="heroBrand">
            <div className="logoPlate">
              <img src={OBA_LOGO_URL} alt="Ontario Baseball Association" className="obaLogo" />
            </div>
            <div className="brandWords">
              <span>Ontario Baseball Association</span>
              <strong>2026 Provincial Championships</strong>
            </div>
          </div>

          <div className="heroCopy">
            <div className="eyebrow">Windsor, Ontario</div>
            <h1>11U AAA <span>Live Bracket</span></h1>
            <p>September 4–7, 2026 <i>•</i> Double knockout</p>
          </div>

          <div className="heroBottom">
            <div className="liveStamp">
              <span className="pulse" />
              <span>
                {data
                  ? `Updated ${new Date(data.refreshed_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                  : "Loading live bracket…"}
              </span>
            </div>
            <div className="venueTag">Riverside / Realtor Park</div>
          </div>
        </div>
      </header>

      <div className="shell">
        {error && <div className="error">{error}</div>}

        <section className={styles.dashboard}>
          <div className={`${styles.dashboardCard} ${styles.burlingtonTracker}`}>
            <span className={styles.dashboardKicker}>Burlington tracker</span>
            <div className={styles.trackerHeader}>
              <div>
                <strong>{burlingtonName}</strong>
                <span>{burlingtonRecord.wins}-{burlingtonRecord.losses} tournament record</span>
              </div>
              <div className={styles.recordBadge}>
                {burlingtonRecord.losses >= 2 ? "ELIMINATED" : burlingtonRecord.losses === 0 ? "UNDEFEATED" : "1 LOSS"}
              </div>
            </div>

            {burlingtonRecord.losses >= 2 ? (
              <div className={styles.trackerNext}>Tournament complete</div>
            ) : burlingtonNext ? (
              <div className={styles.trackerNext}>
                <div>
                  <span>{statusLabel(burlingtonNext) === "LIVE" ? "LIVE NOW" : `NEXT • GAME ${burlingtonNext.game_key}`}</span>
                  <strong>vs. {burlingtonOpponent}</strong>
                </div>
                <div>
                  <span>{formatTime(burlingtonNext.scheduled_at)}</span>
                  <span>{burlingtonNext.field_name}</span>
                </div>
              </div>
            ) : (
              <div className={styles.trackerNext}>Awaiting bracket result</div>
            )}
          </div>

          <div className={styles.dashboardCard}>
            <span className={styles.dashboardKicker}>Tournament status</span>
            <div className={styles.statGrid}>
              <div><strong>{teamsRemaining}</strong><span>teams remaining</span></div>
              <div><strong>{liveGames}</strong><span>live games</span></div>
            </div>
          </div>
        </section>

        <div className="bracketIntro">
          <div>
            <span className="sectionKicker">Championship bracket</span>
            <h2>Road to the provincial title</h2>
          </div>
          <p>
            Scores refresh automatically every 15 seconds. Tap any connected game for
            inning-by-inning scoring, R/H/E and advancement paths.
          </p>
        </div>

        {groups.map(([label, games]) => (
          <section className="round" key={label}>
            <div className="roundTitle">
              <span>{label}</span>
              <span>{games.length} {games.length === 1 ? "game" : "games"}</span>
            </div>

            <div className="cards">
              {label.startsWith("Round 3") && (
                <article
                  className="gameCard"
                  style={{
                    borderColor: "var(--oba)",
                    boxShadow: "inset 3px 0 0 var(--oba), 0 8px 22px rgba(25,57,38,.055)"
                  }}
                >
                  <div className="gameTop">
                    <b>BYE — WINNER GAME 10</b>
                    <span className="status final">ADVANCES</span>
                  </div>

                  <div
                    className={`teamRow ${byeTeam.includes(FAVOURITE_TEAM) ? "burlington" : ""}`}
                    style={{ gridTemplateColumns: "1fr", minHeight: "64px" }}
                  >
                    <span>{byeTeam}</span>
                  </div>

                  <div className="meta">
                    <span>No game this round</span>
                    <span>Advances to Game 19</span>
                  </div>
                </article>
              )}

              {games.map(g => {
                const status = statusLabel(g);
                const inningText = liveDescriptor(g);
                const winner = winnerSide(g);
                const hasBurlington =
                  g.resolved_team_a.includes(FAVOURITE_TEAM) ||
                  g.resolved_team_b.includes(FAVOURITE_TEAM);
                const mapped = mapLineScore(g);
                const winnerRoute = nextRoute(g, "W", data?.games || []);
                const loserRoute = nextRoute(g, "L", data?.games || []);

                return (
                  <article
                    className={`gameCard ${hasBurlington ? "burlingtonCard" : ""} ${status === "LIVE" ? styles.liveCard : ""}`}
                    key={g.game_key}
                  >
                    <div className="gameTop">
                      <b>GAME {g.game_key}</b>
                      <span className={`status ${status.toLowerCase()}`}>
                        {status === "LIVE" && <span className="statusDot" />}
                        {status}{inningText ? ` • ${inningText}` : ""}
                      </span>
                    </div>

                    <div
                      className={`teamRow ${g.resolved_team_a.includes(FAVOURITE_TEAM) ? "burlington" : ""} ${winner === "a" ? "winner" : ""} ${winner === "b" ? "loser" : ""}`}
                    >
                      <TeamNameBlock name={g.resolved_team_a} records={records} />
                      <strong>{g.score_a ?? "—"}</strong>
                    </div>

                    <div
                      className={`teamRow ${g.resolved_team_b.includes(FAVOURITE_TEAM) ? "burlington" : ""} ${winner === "b" ? "winner" : ""} ${winner === "a" ? "loser" : ""}`}
                    >
                      <TeamNameBlock name={g.resolved_team_b} records={records} />
                      <strong>{g.score_b ?? "—"}</strong>
                    </div>

                    {mapped && (
                      <div className={styles.rheStrip}>
                        <span>R</span><span>H</span><span>E</span>
                        <strong>{statAt(mapped.a.totals, 0)}</strong>
                        <strong>{statAt(mapped.a.totals, 1)}</strong>
                        <strong>{statAt(mapped.a.totals, 2)}</strong>
                        <strong>{statAt(mapped.b.totals, 0)}</strong>
                        <strong>{statAt(mapped.b.totals, 1)}</strong>
                        <strong>{statAt(mapped.b.totals, 2)}</strong>
                      </div>
                    )}

                    <div className="meta">
                      <span>{formatTime(g.scheduled_at)}</span>
                      <span>{g.field_name}</span>
                    </div>

                    <div className={styles.routeStrip}>
                      <div>
                        <span>WINNER</span>
                        <strong>{winnerRoute.primary}</strong>
                        {winnerRoute.secondary && <small>{winnerRoute.secondary}</small>}
                      </div>
                      <div>
                        <span>LOSER</span>
                        <strong>{loserRoute.primary}</strong>
                        {loserRoute.secondary && <small>{loserRoute.secondary}</small>}
                      </div>
                    </div>

                    {(mapped || g.gc_game_id) && (
                      <details className={styles.gameDetails}>
                        <summary>Game details</summary>
                        <div className={styles.detailsBody}>
                          <BoxScore game={g} />

                          {g.gc_game_id && (
                            <div className={styles.actions}>
                              <a
                                href={gameChangerUrl(g.gc_game_id)}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.gcButton}
                              >
                                Follow on GameChanger
                              </a>
                            </div>
                          )}
                        </div>
                      </details>
                    )}

                    {g.source === "gamechanger" && (
                      <div className="gc"><span>✓</span> GameChanger synced</div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        <footer>
          <img src={OBA_LOGO_URL} alt="" className="footerLogo" />
          <div>
            <strong>2026 11U AAA Ontario Provincial Championship</strong>
            <span>Unofficial live bracket • Scores may be corrected by tournament administration.</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
