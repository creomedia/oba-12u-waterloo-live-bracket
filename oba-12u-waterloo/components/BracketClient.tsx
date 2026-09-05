"use client";

import { useEffect, useMemo, useState } from "react";
import type { ResolvedGame } from "../lib/types";

type Payload = {
  tournament: string;
  location: string;
  database_connected: boolean;
  refreshed_at: string;
  games: ResolvedGame[];
};

const OBA_LOGO_URL = "https://ondeck.baseballontario.com/images/footer_bo_logo.png";

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

function liveInning(g: ResolvedGame) {
  if (statusLabel(g) !== "LIVE" || !g.line_score) return null;

  const line = g.line_score as {
    team?: { scores?: unknown[] };
    opponent_team?: { scores?: unknown[] };
  };

  const teamScores = line.team?.scores;
  const opponentScores = line.opponent_team?.scores;
  const teamInnings = Array.isArray(teamScores) ? teamScores.length : 0;
  const opponentInnings = Array.isArray(opponentScores) ? opponentScores.length : 0;
  const inning = Math.max(teamInnings, opponentInnings);

  return inning > 0 ? `${ordinal(inning)} inning` : null;
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

  const game10 = data?.games.find(g => g.game_key === "10");
  const byeTeam = winnerName(game10);

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
            <div className="eyebrow">Waterloo, Ontario</div>
            <h1>12U AAA <span>Live Bracket</span></h1>
            <p>September 4–6, 2026 <i>•</i> Double knockout</p>
          </div>

          <div className="heroBottom">
            <div className="liveStamp">
              <span className="pulse" />
              <span>{data ? `Updated ${new Date(data.refreshed_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Loading live bracket…"}</span>
            </div>
            <div className="venueTag">Hillside Park / Waterloo Park</div>
          </div>
        </div>
      </header>

      <div className="shell">
        {!data?.database_connected && (
          <div className="notice">Preview mode: connect Neon in Vercel to enable shared admin changes.</div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="bracketIntro">
          <div>
            <span className="sectionKicker">Championship bracket</span>
            <h2>Road to the provincial title</h2>
          </div>
          <p>Scores refresh automatically every 15 seconds when a GameChanger game is connected.</p>
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
                    className={`teamRow ${byeTeam.includes("Burlington") ? "burlington" : ""}`}
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
                const inning = liveInning(g);
                const winner = winnerSide(g);
                const hasBurlington = g.resolved_team_a.includes("Burlington") || g.resolved_team_b.includes("Burlington");
                return (
                  <article className={`gameCard ${hasBurlington ? "burlingtonCard" : ""}`} key={g.game_key}>
                    <div className="gameTop">
                      <b>GAME {g.game_key}</b>
                      <span className={`status ${status.toLowerCase()}`}>
                        {status === "LIVE" && <span className="statusDot" />}
                        {status}{inning ? ` • ${inning}` : ""}
                      </span>
                    </div>

                    <div className={`teamRow ${g.resolved_team_a.includes("Burlington") ? "burlington" : ""} ${winner === "a" ? "winner" : ""} ${winner === "b" ? "loser" : ""}`}>
                      <span>{g.resolved_team_a}</span>
                      <strong>{g.score_a ?? "—"}</strong>
                    </div>
                    <div className={`teamRow ${g.resolved_team_b.includes("Burlington") ? "burlington" : ""} ${winner === "b" ? "winner" : ""} ${winner === "a" ? "loser" : ""}`}>
                      <span>{g.resolved_team_b}</span>
                      <strong>{g.score_b ?? "—"}</strong>
                    </div>

                    <div className="meta">
                      <span>{formatTime(g.scheduled_at)}</span>
                      <span>{g.field_name}</span>
                    </div>

                    {g.source === "gamechanger" && <div className="gc"><span>✓</span> GameChanger synced</div>}
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        <footer>
          <img src={OBA_LOGO_URL} alt="" className="footerLogo" />
          <div>
            <strong>2026 12U AAA Ontario Provincial Championship</strong>
            <span>Unofficial live bracket • Scores may be corrected by tournament administration.</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
