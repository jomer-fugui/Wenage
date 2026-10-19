import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, chatMembers, messages } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { isDbReady, dbNotReadyResponse } from "@/lib/db-guard";

export const dynamic = "force-dynamic";

function requireDb() {
  if (!isDbReady()) return dbNotReadyResponse();
  return null;
}

function clean(u: Record<string, unknown>) {
  const { appPin, masterSecret, ...rest } = u;
  void appPin;
  void masterSecret;
  return rest;
}

export async function GET(req: Request) {
  const guard = requireDb();
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (id) {
      const rows = await db.select().from(users).where(eq(users.id, Number(id)));
      const u = rows[0];
      if (!u) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
      const [chatsCount] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(chatMembers)
        .where(eq(chatMembers.userId, u.id));
      const [msgCount] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(messages)
        .where(eq(messages.senderId, u.id));
      return NextResponse.json({
        user: {
          ...clean(u as unknown as Record<string, unknown>),
          hasPin: !!u.appPin,
          hasMasterSecret: !!u.masterSecret,
          chatsCount: chatsCount?.n ?? 0,
          messagesCount: msgCount?.n ?? 0,
        },
      });
    }
    const all = await db.select().from(users).orderBy(users.id);
    return NextResponse.json({ users: all.map((u) => ({ ...clean(u as unknown as Record<string, unknown>), hasPin: !!u.appPin })) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo cargar usuarios" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = requireDb();
  if (guard) return guard;
  try {
    const b = await req.json();
    const rawUsername = String(b.username ?? "").trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_.]/g, "");
    const displayName = String(b.displayName ?? b.name ?? "").trim();
    if (!rawUsername || rawUsername.length < 3) return NextResponse.json({ error: "El usuario debe tener al menos 3 caracteres (letras, números, _ .)." }, { status: 400 });
    if (!displayName) return NextResponse.json({ error: "Escribe tu nombre para mostrar." }, { status: 400 });
    const existing = await db.select().from(users).where(eq(users.username, rawUsername));
    if (existing[0]) return NextResponse.json({ error: `El usuario @${rawUsername} ya existe. Elige otro.` }, { status: 409 });
    const [u] = await db
      .insert(users)
      .values({
        username: rawUsername,
        displayName,
        avatarUrl: b.avatarUrl ?? null,
        avatarColor: b.avatarColor ?? "#6366f1",
        coverColor: b.coverColor ?? "#0f172a",
        bio: (String(b.bio ?? "").slice(0, 500)) || "",
        website: b.website ?? null,
        socials: JSON.stringify(b.socials ?? {}),
      })
      .returning();
    return NextResponse.json({ user: clean(u as unknown as Record<string, unknown>) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo crear el usuario" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const guard = requireDb();
  if (guard) return guard;
  try {
    const b = await req.json();
    const id = Number(b.id);
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
    const rows = await db.select().from(users).where(eq(users.id, id));
    if (!rows[0]) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    const patch: Record<string, unknown> = {};
    if (b.displayName !== undefined) patch.displayName = String(b.displayName).slice(0, 60);
    if (b.avatarUrl !== undefined) patch.avatarUrl = b.avatarUrl || null;
    if (b.avatarColor !== undefined) patch.avatarColor = b.avatarColor;
    if (b.coverUrl !== undefined) patch.coverUrl = b.coverUrl || null;
    if (b.coverColor !== undefined) patch.coverColor = b.coverColor;
    if (b.bio !== undefined) {
      const bio = String(b.bio).slice(0, 500);
      patch.bio = bio;
    }
    if (b.website !== undefined) patch.website = String(b.website).slice(0, 120) || null;
    if (b.socials !== undefined) patch.socials = JSON.stringify(b.socials ?? {});
    if (Object.keys(patch).length === 0) return NextResponse.json({ user: clean(rows[0] as unknown as Record<string, unknown>) });
    const [u] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
    return NextResponse.json({ user: clean(u as unknown as Record<string, unknown>) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo guardar el perfil" }, { status: 500 });
  }
}
