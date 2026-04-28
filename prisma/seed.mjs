// Seed script: intentionally a no-op.
//
// Default demo teams/players have been removed. Add your own teams and players
// from the admin panel at /admin/teams and /admin/players, or extend the TEAMS
// array below if you want a custom seed.
//
// Run: node prisma/seed.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEAMS = [];

async function main() {
  if (TEAMS.length === 0) {
    console.log("No seed data configured. Skipping.");
    return;
  }

  console.log("Seeding data...");
  for (const t of TEAMS) {
    const existing = await prisma.team.findUnique({ where: { name: t.name } });
    if (existing) {
      console.log(`  Skipping team (exists): ${t.name}`);
      continue;
    }
    const team = await prisma.team.create({
      data: { name: t.name, shortName: t.shortName },
    });
    let jersey = 1;
    for (const [name, role, battingStyle, bowlingStyle] of t.players) {
      await prisma.player.create({
        data: {
          name,
          role,
          battingStyle,
          bowlingStyle,
          teamId: team.id,
          jerseyNumber: jersey++,
        },
      });
    }
    console.log(`  Created team "${t.name}" with ${t.players.length} players`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
