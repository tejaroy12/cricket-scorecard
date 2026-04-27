// Seed script: creates two demo teams + a few players each, ready to score.
// Run: node prisma/seed.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEAMS = [
  {
    name: "Hitachi Tigers",
    shortName: "TIG",
    players: [
      ["Rahul Sharma", "ALL_ROUNDER", "RHB", "Right-arm medium"],
      ["Aakash Verma", "BATTER", "LHB", null],
      ["Vikram Singh", "BATTER", "RHB", null],
      ["Ravi Kumar", "BOWLER", "RHB", "Right-arm fast"],
      ["Sanjay Patel", "BOWLER", "RHB", "Left-arm spin"],
      ["Arjun Mehta", "WICKET_KEEPER", "RHB", null],
      ["Karthik Iyer", "ALL_ROUNDER", "RHB", "Right-arm off-spin"],
      ["Nikhil Rao", "BATTER", "RHB", null],
      ["Suresh Yadav", "BOWLER", "RHB", "Right-arm medium"],
      ["Manoj Pillai", "BATTER", "LHB", null],
      ["Deepak Nair", "BOWLER", "RHB", "Right-arm fast"],
    ],
  },
  {
    name: "Hitachi Lions",
    shortName: "LIO",
    players: [
      ["Anil Kapoor", "BATTER", "RHB", null],
      ["Pradeep Joshi", "ALL_ROUNDER", "LHB", "Left-arm spin"],
      ["Mohit Gupta", "BATTER", "RHB", null],
      ["Harish Reddy", "BOWLER", "RHB", "Right-arm fast"],
      ["Naveen Das", "WICKET_KEEPER", "RHB", null],
      ["Sundar Murthy", "BATTER", "RHB", null],
      ["Rajesh Goel", "BOWLER", "LHB", "Left-arm fast"],
      ["Pranav Bhat", "ALL_ROUNDER", "RHB", "Right-arm medium"],
      ["Tarun Saxena", "BATTER", "RHB", null],
      ["Vinod Khanna", "BOWLER", "RHB", "Right-arm leg-spin"],
      ["Ganesh Rao", "BATTER", "RHB", null],
    ],
  },
];

async function main() {
  console.log("Seeding demo data...");
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
