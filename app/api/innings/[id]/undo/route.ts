import { NextResponse } from "next/server";
import { undoLastBall } from "@/lib/scoring";
import { isAuthenticated } from "@/lib/auth";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!isAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await undoLastBall(params.id);
  return NextResponse.json(result);
}
