# 2026 12U AAA OBA Live Bracket

Separate mobile-first live bracket for the 2026 12U AAA OBA Championship in Waterloo, Ontario.

## Tournament
- Dates: September 4–6, 2026
- Host location: Waterloo, Ontario
- Parks: Hillside Park Upper/Lower and Waterloo Park 3/4
- Format: 12-team double knockout
- Official workbook used for seeding: `Schedule 12U AAA OBA Championship 2026.xlsx`

The official workbook currently lists one Round 1 entrant as `YSBA`; this app intentionally preserves that placeholder until the official team name is confirmed.

## Live scoring
GameChanger games can be connected per bracket game from `/admin`.

The admin accepts either:
- a normal GameChanger share link, or
- the raw GameChanger UUID.

The UUID is extracted automatically on save. With Manual Override off, the app reads the public GameChanger game-details feed, maps the opponent name to the correct bracket side, and syncs the live score/status. A mismatch is rejected rather than guessed.

Winners/losers propagate only after the source game has a final status (`completed`, `final`, or `closed`).

## Setup
1. Create a separate GitHub repository for this project.
2. Create a separate Vercel project.
3. Create/connect a separate Neon Postgres database.
4. Add `DATABASE_URL` and `ADMIN_PASSWORD` to Vercel.
5. Run `scripts/schema.sql`, then `scripts/seed.sql` in the new database.
6. Deploy.

This project is intentionally independent of the 11U Windsor/Riverside bracket.
