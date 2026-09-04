type GCDetails = {
  id: string;
  opponent_team?: { name?: string };
  home_away?: "home" | "away" | null;
  score?: { team?: number; opponent_team?: number };
  game_status?: string;
  line_score?: unknown;
};

const GAMECHANGER_ACCEPT =
  "application/vnd.gc.com.public_team_schedule_event_details+json; version=0.0.0";

export async function fetchGameChanger(
  gameId: string
): Promise<GCDetails | null> {
  const url =
    `https://api.team-manager.gc.com/public/game-stream-processing/` +
    `${encodeURIComponent(gameId)}/details?include=line_scores`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: GAMECHANGER_ACCEPT
      }
    });

    if (!res.ok) {
      console.warn(
        `GameChanger request failed for ${gameId}: ${res.status} ${res.statusText}`
      );
      return null;
    }

    return (await res.json()) as GCDetails;
  } catch (error) {
    console.warn(`GameChanger request failed for ${gameId}`, error);
    return null;
  }
}
