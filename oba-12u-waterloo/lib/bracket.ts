import type { GameRow, ResolvedGame } from "./types";
import { fetchGameChanger } from "./gamechanger";

function isFinalStatus(status: string | null | undefined): boolean {
  const normalized = (status || "").toLowerCase().trim();
  return normalized === "completed" || normalized === "final" || normalized === "closed";
}

function winner(game: ResolvedGame): string | null {
  if (!isFinalStatus(game.game_status)) return null;
  if (game.score_a == null || game.score_b == null || game.score_a === game.score_b) return null;
  return game.score_a > game.score_b ? game.resolved_team_a : game.resolved_team_b;
}

function loser(game: ResolvedGame): string | null {
  if (!isFinalStatus(game.game_status)) return null;
  if (game.score_a == null || game.score_b == null || game.score_a === game.score_b) return null;
  return game.score_a < game.score_b ? game.resolved_team_a : game.resolved_team_b;
}

function resolveSource(source: string | null, map: Map<string, ResolvedGame>, fallback: string | null): string {
  if (!source) return fallback || "TBD";
  const [kind, key] = source.split(":");
  const sourceGame = map.get(key);
  if (!sourceGame) return kind === "W" ? `Winner Game ${key}` : `Loser Game ${key}`;
  return (kind === "W" ? winner(sourceGame) : loser(sourceGame)) || (kind === "W" ? `Winner Game ${key}` : `Loser Game ${key}`);
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

export async function resolveBracket(rows: GameRow[]): Promise<ResolvedGame[]> {
  const map = new Map<string, ResolvedGame>();
  const output: ResolvedGame[] = [];

  for (const row of [...rows].sort((a, b) => a.sort_order - b.sort_order)) {
    const resolvedA = resolveSource(row.team_a_source, map, row.team_a);
    const resolvedB = resolveSource(row.team_b_source, map, row.team_b);

    let scoreA = row.score_a;
    let scoreB = row.score_b;
    let status = row.game_status;
    let source: ResolvedGame["source"] = row.is_manual_override ? "manual" : "scheduled";
    let gcStatus: string | null = null;
    let lineScore: unknown = null;
    let gcOpponentName: string | null = null;
    let gcMappingWarning: string | null = null;

    if (row.gc_game_id && !row.is_manual_override) {
      const gc = await fetchGameChanger(row.gc_game_id);
      gcOpponentName = gc?.opponent_team?.name || null;
      gcStatus = gc?.game_status || null;
      lineScore = gc?.line_score || null;

      if (gc?.score && typeof gc.score.team === "number" && typeof gc.score.opponent_team === "number") {
        const teamScore = gc.score.team;
        const opponentScore = gc.score.opponent_team;

        // GameChanger returns the score from the perspective of the team whose game feed
        // we are reading. Instead of assuming bracket Team A/B based on home/away, identify
        // which bracket side is the opponent by name. This prevents flipped scores.
        if (teamNamesMatch(gcOpponentName, resolvedA)) {
          scoreA = opponentScore;
          scoreB = teamScore;
          status = gc.game_status || status;
          source = "gamechanger";
        } else if (teamNamesMatch(gcOpponentName, resolvedB)) {
          scoreA = teamScore;
          scoreB = opponentScore;
          status = gc.game_status || status;
          source = "gamechanger";
        } else {
          gcMappingWarning = `Could not match GameChanger opponent${gcOpponentName ? ` (${gcOpponentName})` : ""} to ${resolvedA} or ${resolvedB}. Scores were not applied.`;
        }
      }
    }

    const game: ResolvedGame = {
      ...row,
      resolved_team_a: resolvedA,
      resolved_team_b: resolvedB,
      score_a: scoreA,
      score_b: scoreB,
      game_status: status,
      source,
      gc_status: gcStatus,
      line_score: lineScore,
      gc_opponent_name: gcOpponentName,
      gc_mapping_warning: gcMappingWarning
    };

    map.set(row.game_key, game);
    output.push(game);
  }

  return output;
}
