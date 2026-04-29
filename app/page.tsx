import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MatchCard } from "@/components/MatchCard";
import { AutoRefresher } from "@/components/AutoRefresher";
import { getCurrentPlayer } from "@/lib/playerSession";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const me = await getCurrentPlayer();

  // "Your matches": matches where the signed-in player is on the roster, OR
  // (legacy fallback) plays for one of the two teams. We intentionally show
  // LIVE first, then SCHEDULED, then the latest few COMPLETED so the user
  // lands on relevant matches first.
  const myMatchesPromise = me
    ? prisma.match.findMany({
        where: {
          OR: [
            { matchPlayers: { some: { playerId: me.id } } },
            ...(me.teamId
              ? [{ team1Id: me.teamId }, { team2Id: me.teamId }]
              : []),
          ],
        },
        include: {
          team1: true,
          team2: true,
          innings: { include: { battingTeam: true } },
        },
        orderBy: [{ status: "asc" }, { matchDate: "desc" }],
        take: 6,
      })
    : Promise.resolve([] as any[]);

  const [
    liveMatches,
    recentMatches,
    upcomingMatches,
    teamCount,
    playerCount,
    myMatchesAll,
  ] = await Promise.all([
    prisma.match.findMany({
      where: { status: "LIVE" },
      include: {
        team1: true,
        team2: true,
        innings: { include: { battingTeam: true } },
      },
      orderBy: { matchDate: "desc" },
    }),
    prisma.match.findMany({
      where: { status: "COMPLETED" },
      include: {
        team1: true,
        team2: true,
        innings: { include: { battingTeam: true } },
      },
      orderBy: { matchDate: "desc" },
      take: 2,
    }),
    prisma.match.findMany({
      where: { status: "SCHEDULED" },
      include: {
        team1: true,
        team2: true,
        innings: { include: { battingTeam: true } },
      },
      orderBy: { matchDate: "asc" },
      take: 6,
    }),
    prisma.team.count(),
    prisma.player.count(),
    myMatchesPromise,
  ]);

  // Order "Your matches": LIVE → SCHEDULED → COMPLETED (newest first), and
  // dedupe so a match listed in "Your matches" doesn't also appear below.
  const myMatches = (myMatchesAll as any[]).slice().sort((a, b) => {
    const order = (s: string) =>
      s === "LIVE" ? 0 : s === "SCHEDULED" ? 1 : 2;
    const o = order(a.status) - order(b.status);
    if (o !== 0) return o;
    return new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime();
  });
  const myMatchIds = new Set(myMatches.map((m) => m.id));

  const liveMatchesFiltered = liveMatches.filter((m) => !myMatchIds.has(m.id));
  const upcomingMatchesFiltered = upcomingMatches.filter(
    (m) => !myMatchIds.has(m.id),
  );

  const hasLive = liveMatches.length > 0 || myMatches.some((m) => m.status === "LIVE");

  return (
    <div className="space-y-12">
      {/*
       * Live scores need to feel snappy; refresh every 4s while any LIVE
       * match is on the page (whether it's in "Your matches" or "Live now").
       */}
      {hasLive && <AutoRefresher intervalMs={4000} />}

      <Hero
        teamCount={teamCount}
        playerCount={playerCount}
        liveCount={liveMatches.length}
      />

      {me && myMatches.length > 0 && (
        <Section
          title={`Your matches`}
          subtitle={`Hi ${me.name.split(" ")[0]} — matches you're playing in`}
          accent
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myMatches.slice(0, 6).map((m: any) => (
              <MatchCard key={m.id} {...m} />
            ))}
          </div>
        </Section>
      )}

      {liveMatchesFiltered.length > 0 && (
        <Section
          title="Live now"
          subtitle="Matches happening at this moment"
          accent
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {liveMatchesFiltered.map((m) => (
              <MatchCard key={m.id} {...m} />
            ))}
          </div>
        </Section>
      )}

      {upcomingMatchesFiltered.length > 0 && (
        <Section title="Upcoming" subtitle="Scheduled fixtures">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingMatchesFiltered.map((m) => (
              <MatchCard key={m.id} {...m} />
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Recent results"
        subtitle="The two latest completed matches"
        actionHref="/matches"
        actionLabel="View all matches"
      >
        {recentMatches.length === 0 ? (
          <EmptyState
            title="No matches yet"
            body="Once an admin creates and completes a match, it will appear here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentMatches.map((m) => (
              <MatchCard key={m.id} {...m} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Hero({
  teamCount,
  playerCount,
  liveCount,
}: {
  teamCount: number;
  playerCount: number;
  liveCount: number;
}) {
  return (
    <div className="hitachi-hero relative overflow-hidden rounded-3xl px-6 py-12 text-white sm:px-12 sm:py-16">
      <div className="relative z-10 max-w-3xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/80 ring-1 ring-white/20">
          <span className="h-1.5 w-1.5 rounded-full bg-hitachi-light" />
          Hitachi Internal League
        </div>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
          Cricket, Score Card.
          <br />
          <span className="bg-gradient-to-r from-hitachi-light to-white bg-clip-text text-transparent">
            Players Stats.
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg">
          Live ball-by-ball scoring, individual player profiles, season
          leaderboards and complete match history — built for the Hitachi
          cricket community.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/matches"
            className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            View matches
          </Link>
          <Link
            href="/players"
            className="rounded-lg bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/15"
          >
            Browse players
          </Link>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-3 sm:max-w-md">
        <Stat label="Teams" value={teamCount} />
        <Stat label="Players" value={playerCount} />
        <Stat label="Live now" value={liveCount} highlight={liveCount > 0} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur">
      <div
        className={
          "text-2xl font-black tabular-nums " +
          (highlight ? "text-hitachi-light" : "text-white")
        }
      >
        {value}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
        {label}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  actionHref,
  actionLabel,
  accent,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actionHref?: string;
  actionLabel?: string;
  accent?: boolean;
}) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2
            className={
              "text-2xl font-bold " +
              (accent ? "text-hitachi" : "text-slate-900")
            }
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
        {actionHref && actionLabel && (
          <Link
            href={actionHref}
            className="text-sm font-semibold text-hitachi hover:underline"
          >
            {actionLabel} &rarr;
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      </div>
      <div className="text-base font-semibold text-slate-900">{title}</div>
      <div className="mt-1 max-w-sm text-sm text-slate-500">{body}</div>
    </div>
  );
}
