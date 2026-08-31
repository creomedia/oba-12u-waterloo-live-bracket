"use client";

import { useEffect, useState } from "react";
import type { ResolvedGame } from "../lib/types";

export default function AdminClient() {
  const [games, setGames] = useState<ResolvedGame[]>([]);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/bracket", { cache: "no-store" });
    const data = await res.json();
    setGames(data.games);
  }

  useEffect(() => { load(); }, []);

  function patch(key: string, field: keyof ResolvedGame, value: unknown) {
    setGames(gs => gs.map(g => g.game_key === key ? { ...g, [field]: value } : g));
  }

  function normalizeGameChangerId(value: string | null) {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
    return match ? match[0] : trimmed;
  }

  async function save(g: ResolvedGame) {
    setMessage(`Saving Game ${g.game_key}…`);
    const res = await fetch("/api/admin/game", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-password": password },
      body: JSON.stringify({
        game_key: g.game_key,
        team_a: g.team_a,
        team_b: g.team_b,
        gc_game_id: normalizeGameChangerId(g.gc_game_id),
        score_a: g.score_a,
        score_b: g.score_b,
        game_status: g.game_status,
        is_manual_override: g.is_manual_override,
        enabled: g.enabled
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Save failed");
      return;
    }
    setMessage(`Game ${g.game_key} saved.`);
    await load();
  }

  return (
    <main className="adminShell">
      <a href="/" className="back">← Public bracket</a>
      <div className="adminTitleBlock">
        <span className="sectionKicker">Tournament control</span>
        <h1>Bracket Admin</h1>
        <p className="adminIntro">Paste a GameChanger share link or game UUID once it is created. The admin extracts the UUID automatically. With manual override off, live scores and status sync automatically. If GameChanger's opponent name cannot be matched safely, the bracket will refuse to apply the score instead of guessing.</p>
      </div>

      <div className="passwordBar">
        <input type="password" placeholder="Admin password" value={password} onChange={e => setPassword(e.target.value)} />
        <span>{message}</span>
      </div>

      <div className="adminGrid">
        {games.map(g => (
          <section className="adminCard" key={g.game_key}>
            <div className="adminHeading"><b>Game {g.game_key}</b><span>{g.round_label}</span></div>

            <label>Team A
              <input value={g.team_a ?? ""} disabled={Boolean(g.team_a_source) && !g.is_manual_override}
                onChange={e => patch(g.game_key, "team_a", e.target.value)} />
            </label>
            <label>Team B
              <input value={g.team_b ?? ""} disabled={Boolean(g.team_b_source) && !g.is_manual_override}
                onChange={e => patch(g.game_key, "team_b", e.target.value)} />
            </label>
            <label>GameChanger link or UUID
              <input value={g.gc_game_id ?? ""} onChange={e => patch(g.game_key, "gc_game_id", e.target.value || null)} placeholder="Paste share link or UUID" />
            </label>

            {g.gc_game_id && !g.is_manual_override && (
              <div className={`syncState ${g.gc_mapping_warning ? "warning" : g.source === "gamechanger" ? "ok" : "waiting"}`}>
                {g.gc_mapping_warning
                  ? g.gc_mapping_warning
                  : g.source === "gamechanger"
                    ? `GameChanger synced${g.gc_opponent_name ? ` • Opponent: ${g.gc_opponent_name}` : ""}`
                    : `GameChanger connected${g.gc_opponent_name ? ` • Opponent: ${g.gc_opponent_name}` : " • waiting for score"}`}
              </div>
            )}

            <div className="scoreInputs">
              <label>Score A<input type="number" disabled={!g.is_manual_override} value={g.score_a ?? ""} onChange={e => patch(g.game_key, "score_a", e.target.value === "" ? null : Number(e.target.value))} /></label>
              <label>Score B<input type="number" disabled={!g.is_manual_override} value={g.score_b ?? ""} onChange={e => patch(g.game_key, "score_b", e.target.value === "" ? null : Number(e.target.value))} /></label>
            </div>

            <label>Status
              <select disabled={!g.is_manual_override} value={g.game_status} onChange={e => patch(g.game_key, "game_status", e.target.value)}>
                <option value="upcoming">Upcoming</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </label>

            <div className="checkRow">
              <label><input type="checkbox" checked={g.is_manual_override} onChange={e => patch(g.game_key, "is_manual_override", e.target.checked)} /> Manual override</label>
              <label><input type="checkbox" checked={g.enabled} onChange={e => patch(g.game_key, "enabled", e.target.checked)} /> Show game</label>
            </div>

            <button onClick={() => save(g)}>Save Game {g.game_key}</button>
          </section>
        ))}
      </div>
    </main>
  );
}
