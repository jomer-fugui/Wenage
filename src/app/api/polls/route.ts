import { NextResponse } from "next/server";
import { db } from "@/db";
import { pollVotes, polls } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { isDbReady, dbNotReadyResponse } from "@/lib/db-guard";

export const dynamic = "force-dynamic";

function requireDb() {
  if (!isDbReady()) return dbNotReadyResponse();
  return null;
}

export async function POST(req: Request) {
  const guard = requireDb();
  if (guard) return guard;
  try {
    const b = await req.json();
    const pollId = Number(b.pollId);
    const userId = Number(b.userId);
    const optionIndex = Number(b.optionIndex);
    if (!pollId || !userId || optionIndex === undefined || optionIndex < 0)
      return NextResponse.json({ error: "Faltan datos del voto." }, { status: 400 });
    const p = (await db.select().from(polls).where(eq(polls.id, pollId)))[0];
    if (!p) return NextResponse.json({ error: "Encuesta no existe" }, { status: 404 });
    const existing = await db.select().from(pollVotes).where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)));
    if (existing[0]) {
      await db.update(pollVotes).set({ optionIndex }).where(eq(pollVotes.id, existing[0].id));
    } else {
      await db.insert(pollVotes).values({ pollId, userId, optionIndex });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "vote failed" }, { status: 500 });
  }
}
