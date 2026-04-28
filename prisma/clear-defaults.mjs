// One-off cleanup: removes the demo seed teams ("Hitachi Tigers" / "Hitachi Lions")
// along with all their players. Safe to re-run.
//
// Run: node prisma/clear-defaults.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_TEAM_NAMES = ["Hitachi Tigers", "Hitachi Lions"];

async function main() {
  for (const name of DEFAULT_TEAM_NAMES) {
    const team = await prisma.team.findUnique({ where: { name } });
    if (!team) {
      console.log(`  Skip (not found): ${name}`);
      continue;
    }

    const playedMatches = await prisma.match.count({
      where: { OR: [{ team1Id: team.id }, { team2Id: team.id }] },
    });
    if (playedMatches > 0) {
      console.log(
        `  Skip "${name}" — referenced by ${playedMatches} match(es). Delete those matches first.`
      );
      continue;
    }

    const playersDeleted = await prisma.player.deleteMany({
      where: { teamId: team.id },
    });
    await prisma.team.delete({ where: { id: team.id } });
    console.log(
      `  Removed team "${name}" and ${playersDeleted.count} player(s).`
    );
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
