# Cricket — Live Scoring & Player Stats

A self-hosted, CricHeroes-style cricket platform.
Manage teams and players, run **ball-by-ball live scoring**, and publish
match results, scorecards, player profiles and league leaderboards on a
public-facing website.

Built with **Next.js 14 (App Router) + TypeScript + Prisma + SQLite + Tailwind CSS**.

---

## Features

### Public site
- Modern landing page with live, upcoming and recent matches
- **Live match view** that auto-refreshes every 5 seconds (score, current batters, bowler, last balls, run rate, target, required RR)
- Team pages with full squad
- Player profile pages with **career batting & bowling stats** (runs, avg, SR, 50s/100s, wickets, economy, best, etc.)
- League leaderboards: most runs and most wickets
- Match list with status filters (Live / Upcoming / Completed)

### Admin panel (`/admin`)
- Cookie-based admin login (configured via `.env`)
- Create / delete **teams**
- Create / delete **players** (name, role, batting style, bowling style, jersey #, employee ID)
- Create matches (pick teams, venue, overs, date)
- **Live scoring console** with everything an umpire/scorer needs:
  - Toss winner & decision
  - Set opening batters and opening bowler
  - One-tap run buttons (0, 1, 2, 3, 4, 5, 6)
  - Extras: wide / no-ball / bye / leg-bye with extra-run support
  - Wickets: bowled, caught, LBW, run-out, stumped, hit wicket
  - Strike rotation handled automatically (odd runs + end-of-over)
  - Change bowler at any point
  - **Undo last ball** (recomputes innings totals from scratch)
  - End innings → start 2nd innings → complete match (auto result text)

### Scoring engine
- Ball-by-ball storage in DB (replayable)
- Per-innings batting card (R, B, 4s, 6s, SR, dismissal)
- Per-innings bowling card (O, R, W, Econ, wides, no-balls)
- Aggregated career stats across all matches

---

## Quick start

> Prerequisites: **Node.js 18+** (tested on Node 22) and **npm**.

```bash
# 1. Install
npm install

# 2. Create the SQLite database from the Prisma schema
npm run db:push

# 3. (Optional) Seed two demo teams with players
npm run db:seed

# 4. Run the dev server
npm run dev
```

Open **http://localhost:3000**.

### Default admin credentials

Configured in `.env`:

```

```

**Change these** in production by editing `.env` (or your deploy environment).

---

## Typical workflow

1. **Sign in** at `/admin/login`
2. **Create teams** at `/admin/teams`
3. **Add players** to each team at `/admin/players`
4. **Create a match** at `/admin/matches/new`
5. From the match page (`/admin/matches/<id>`):
   - Set the **toss** → match goes Live
   - Pick **opening batters & bowler**
   - Score **ball by ball** using the buttons. Strike rotates automatically.
   - On a wicket: tick the box, choose dismissal type and the new batter
   - To change bowler at over end, pick from the dropdown and click *Set bowler*
   - When innings ends: click **End innings & start 2nd innings**
   - When the chase finishes: click **Complete match** — the result is auto-generated
6. Anyone can watch live at `/matches/<id>` — no login required
7. View career stats at `/players/<id>` and league standings at `/leaderboard`

---

## Project structure

```
app/
  page.tsx                       # Public homepage
  matches/                       # Public match list & live view
  teams/, players/, leaderboard/ # Public listings
  admin/
    login/                       # Public login form
    (authed)/                    # Auth-protected admin section
      page.tsx                   # Admin dashboard
      teams/                     # Manage teams
      players/                   # Manage players
      matches/                   # List + live scoring console
  api/
    auth/                        # Login / logout
    matches/[id]/                # toss, complete, start-second-innings, state
    innings/[id]/                # openers, ball, bowler, undo

lib/
  prisma.ts        # Prisma client singleton
  auth.ts          # HMAC-signed cookie sessions
  scoring.ts       # Ball-by-ball scoring engine + recompute/undo
  matchState.ts    # Build the full state object served to clients
  stats.ts         # Career stats + leaderboard aggregation

prisma/
  schema.prisma    # Team, Player, Match, Innings, Ball, BattingEntry, BowlingEntry
  seed.mjs         # Demo data seeder
```

---

## Configuration (`.env`)

```env

```

### Switching to PostgreSQL (recommended for shared deployments)

1. Set `DATABASE_URL` to your Postgres URL.
2. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
3. Run `npx prisma migrate dev --name init` (or `npx prisma db push`).

---

## Production build

```bash
npm run build
npm start
```

The `build` script automatically runs `prisma generate` and applies any pending
migrations (`prisma migrate deploy`).

---

## Notes & known limitations

- Strike rotation handles the standard cases (odd off-bat runs and over-end)
  but ignores some edge cases (e.g. byes/leg-byes on a no-ball running an odd
  total). For league play this is fine; review and adjust `lib/scoring.ts`
  for tournament-grade accuracy.
- "Maidens" are not auto-detected; the column exists in the DB but is left at 0.
- Auth is intentionally simple (single shared admin) since this is for an
  internal company league. If multiple scorers need accounts, swap in
  NextAuth.js — only `lib/auth.ts` needs to change.
- The default DB is SQLite. For multi-node deployments, switch to Postgres.

---

## License

Internal use — Hitachi.
