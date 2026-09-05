export type GameKey = `${number}` | "22A" | "23A" | "22B" | "23B";

export type GameRow = {
  game_key: GameKey;
  sort_order: number;
  round_label: string;
  scheduled_at: string | null;
  field_name: string | null;
  team_a: string | null;
  team_b: string | null;
  team_a_source: string | null;
  team_b_source: string | null;
  gc_game_id: string | null;
  score_a: number | null;
  score_b: number | null;
  game_status: string;
  is_manual_override: boolean;
  enabled: boolean;
};

export type ResolvedGame = GameRow & {
  resolved_team_a: string;
  resolved_team_b: string;
  source: "manual" | "gamechanger" | "scheduled";
  gc_status?: string | null;
  gc_home_away?: "home" | "away" | null;
  line_score?: unknown;
  gc_opponent_name?: string | null;
  gc_mapping_warning?: string | null;
};
