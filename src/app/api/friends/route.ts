import { NextResponse } from "next/server";
import { db } from "@/db";
import { friends, users } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { isDbReady, dbNotReadyResponse } from "@/lib/db-guard";

export const dynamic = "force-dynamic";

function requireDb() {
  if (!isDbReady()) return dbNotReadyResponse();
  return null;
}

export async function GET(req: Request) {
  const guard = requireDb();
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const userId = Number(searchParams.get("userId"));
    if (!userId) return NextResponse.json({ error: "Falta userId" }, { status: 400 });
    const rows = await db.select().from(friends).where(or(eq(friends.userId, userId), eq(friends.friendId, userId)));
    const allUsers = await db.select().from(users);
    const umap = new Map(allUsers.map((u) => [u.id, u]));
    const list = rows.map((r) => {
      const otherId = r.userId === userId ? r.friendId : r.userId;
      const other = umap.get(otherId);
      return {
        id: r.id,
        otherId,
        username: other?.username ?? "?",
        displayName: other?.displayName ?? "?",
        avatarColor: other?.avatarColor ?? "#6366f1",
        avatarUrl: other?.avatarUrl ?? null,
        status: r.status,
        outgoing: r.userId === userId,
        createdAt: r.createdAt,
      };
    });
    return NextResponse.json({ friends: list });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "friends failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = requireDb();
  if (guard) return guard;
  try {
    const b = await req.json();
    const userId = Number(b.userId);
    const otherUsername = String(b.username ?? "").trim().toLowerCase().replace(/^@/, "");
    const action = String(b.action ?? "add");
    if (!userId) return NextResponse.json({ error: "Falta userId" }, { status: 400 });

    if (action === "remove" && b.friendId) {
      const fid = Number(b.friendId);
      const rows = await db.select().from(friends).where(
        or(
          and(eq(friends.userId, userId), eq(friends.friendId, fid)),
          and(eq(friends.userId, fid), eq(friends.friendId, userId))
        )
      );
      for (const r of rows) await db.delete(friends).where(eq(friends.id, r.id));
      return NextResponse.json({ ok: true, message: "Amistad eliminada." });
    }

    if (!otherUsername) return NextResponse.json({ error: "Escribe el @usuario." }, { status: 400 });
    const target = await db.select().from(users).where(eq(users.username, otherUsername));
    const t = target[0];
    if (!t) return NextResponse.json({ error: `No existe @${otherUsername}.` }, { status: 404 });
    if (t.id === userId) return NextResponse.json({ error: "No puedes agregarte a ti mismo." }, { status: 400 });

    const existing = await db.select().from(friends).where(
      or(
        and(eq(friends.userId, userId), eq(friends.friendId, t.id)),
        and(eq(friends.userId, t.id), eq(friends.friendId, userId))
      )
    );
    if (action === "add") {
      if (existing[0]) {
        if (existing[0].status === "blocked") return NextResponse.json({ error: "Ese contacto está bloqueado." }, { status: 403 });
        // si había pendiente entrante, aceptar
        if (existing[0].status === "pending" && existing[0].friendId === userId) {
          await db.update(friends).set({ status: "accepted" }).where(eq(friends.id, existing[0].id));
          return NextResponse.json({ ok: true, message: `Ahora eres amigo de @${t.username}.` });
        }
        return NextResponse.json({ error: "Ya son amigos o hay solicitud pendiente." }, { status: 409 });
      }
      await db.insert(friends).values({ userId, friendId: t.id, status: "accepted" });
      return NextResponse.json({ ok: true, message: `@${t.username} agregado a tus amigos.` });
    }
    if (action === "block") {
      if (existing[0]) await db.update(friends).set({ status: "blocked" }).where(eq(friends.id, existing[0].id));
      else await db.insert(friends).values({ userId, friendId: t.id, status: "blocked" });
      return NextResponse.json({ ok: true, message: `@${t.username} bloqueado.` });
    }
    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "friends post failed" }, { status: 500 });
  }
}
