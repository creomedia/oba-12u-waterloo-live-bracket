CREATE TABLE IF NOT EXISTS tournament_games (
  game_key text PRIMARY KEY,
  sort_order integer NOT NULL,
  round_label text NOT NULL,
  scheduled_at timestamptz,
  field_name text,
  team_a text,
  team_b text,
  team_a_source text,
  team_b_source text,
  gc_game_id text,
  score_a integer,
  score_b integer,
  game_status text NOT NULL DEFAULT 'upcoming',
  is_manual_override boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tournament_games_gc_game_id_idx ON tournament_games (gc_game_id);
CREATE INDEX IF NOT EXISTS tournament_games_status_idx ON tournament_games (game_status);
