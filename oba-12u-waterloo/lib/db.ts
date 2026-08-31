import { neon } from "@neondatabase/serverless";
import { seedGames } from "./seed";
import type { GameRow } from "./types";

export const hasDatabase = Boolean(process.env.DATABASE_URL);

function sqlClient() {
  if (!process.env.DATABASE_URL) return null;
  return neon(process.env.DATABASE_URL);
}

export async function getGames(): Promise<GameRow[]> {
  const sql = sqlClient();
  if (!sql) return seedGames;
  const rows = await sql`
    SELECT game_key, sort_order, round_label, scheduled_at::text, field_name,
           team_a, team_b, team_a_source, team_b_source, gc_game_id,
           score_a, score_b, game_status, is_manual_override, enabled
    FROM tournament_games
    ORDER BY sort_order
  `;
  if (!rows.length) return seedGames;
  return rows as unknown as GameRow[];
}

export async function upsertGame(input: Partial<GameRow> & { game_key: string }) {
  const sql = sqlClient();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  const existing = seedGames.find(g => g.game_key === input.game_key);
  if (!existing) throw new Error("Unknown game key.");

  const merged = { ...existing, ...input };
  await sql`
    INSERT INTO tournament_games (
      game_key, sort_order, round_label, scheduled_at, field_name,
      team_a, team_b, team_a_source, team_b_source, gc_game_id,
      score_a, score_b, game_status, is_manual_override, enabled, updated_at
    ) VALUES (
      ${merged.game_key}, ${merged.sort_order}, ${merged.round_label}, ${merged.scheduled_at},
      ${merged.field_name}, ${merged.team_a}, ${merged.team_b}, ${merged.team_a_source},
      ${merged.team_b_source}, ${merged.gc_game_id}, ${merged.score_a}, ${merged.score_b},
      ${merged.game_status}, ${merged.is_manual_override}, ${merged.enabled}, now()
    )
    ON CONFLICT (game_key) DO UPDATE SET
      team_a = EXCLUDED.team_a,
      team_b = EXCLUDED.team_b,
      gc_game_id = EXCLUDED.gc_game_id,
      score_a = EXCLUDED.score_a,
      score_b = EXCLUDED.score_b,
      game_status = EXCLUDED.game_status,
      is_manual_override = EXCLUDED.is_manual_override,
      enabled = EXCLUDED.enabled,
      updated_at = now()
  `;
}
