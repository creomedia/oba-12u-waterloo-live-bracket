type GCDetails = {
  id: string;
  opponent_team?: { name?: string };
  home_away?: "home" | "away" | null;
  score?: { team?: number; opponent_team?: number };
  game_status?: string;
  line_score?: unknown;
};

export async function fetchGameChanger(gameId: string): Promise<GCDetails | null> {
  const url = `https://api.team-manager.gc.com/public/game-stream-processing/${encodeURIComponent(gameId)}/details?include=line_scores`;
  try {
    const res = await fetch(url, { cache: "no-store", headers: { "accept": "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
