import { NextResponse } from "next/server";
import { getMatchState } from "@/lib/matchState";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const state = await getMatchState(params.id);
  if (!state) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(state);
}
