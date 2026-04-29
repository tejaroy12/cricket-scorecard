import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

function clearAndRedirect(req: NextRequest) {
  const url = new URL("/", req.url);
  const res = NextResponse.redirect(url, { status: 303 });
  res.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}

export async function POST(req: NextRequest) {
  return clearAndRedirect(req);
}

export async function GET(req: NextRequest) {
  return clearAndRedirect(req);
}
