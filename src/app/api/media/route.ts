import { NextResponse } from "next/server";
import { db } from "@/db";
import { mediaItems, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

function canView(item: typeof mediaItems.$inferSelect, viewerId: number | null): boolean {
  if (item.visibility === "public") return true;
  if (!viewerId) return false;
  if (item.ownerId === viewerId) return true;
  if (item.visibility === "private") return false;
  // selected
  try {
    const ids: number[] = JSON.parse(item.allowedIds || "[]");
    return ids.includes(viewerId);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get("ownerId") ? Number(searchParams.get("ownerId")) : null;
    const viewerId = searchParams.get("viewerId") ? Number(searchParams.get("viewerId")) : null;
    const all = await db.select().from(mediaItems).orderBy(desc(mediaItems.id));
    let list = all;
    if (ownerId) list = list.filter((m) => m.ownerId === ownerId);
    const withAccess = list.map((m) => ({ ...m, canView: canView(m, viewerId) }));
    // si hay viewer, solo devolver los visibles + marcar los ocultos como locked (sin url)
    const out = withAccess.map((m) => {
      if (m.canView) return m;
      return { ...m, url: null, title: m.title, locked: true };
    });
    return NextResponse.json({ media: out });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "media failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const ownerId = Number(b.ownerId);
    const url = String(b.url ?? "").trim();
    if (!ownerId || !url) return NextResponse.json({ error: "Falta archivo o usuario." }, { status: 400 });
    const kind = ["image", "video", "audio", "file"].includes(b.kind) ? b.kind : "image";
    const visibility = ["public", "private", "selected"].includes(b.visibility) ? b.visibility : "public";
    const allowed: number[] = Array.isArray(b.allowedIds) ? b.allowedIds.map(Number).filter(Boolean) : [];
    const [m] = await db
      .insert(mediaItems)
      .values({
        ownerId,
        kind,
        title: String(b.title ?? "").slice(0, 80) || null,
        url,
        visibility,
        allowedIds: JSON.stringify(allowed),
        allowDownload: b.allowDownload === true ? true : b.allowDownload === false ? false : null,
      })
      .returning();
    return NextResponse.json({ item: m });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const b = await req.json();
    const id = Number(b.id);
    const ownerId = Number(b.ownerId);
    if (!id || !ownerId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    const rows = await db.select().from(mediaItems).where(eq(mediaItems.id, id));
    const m = rows[0];
    if (!m || m.ownerId !== ownerId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    const patch: Record<string, unknown> = {};
    if (b.visibility && ["public", "private", "selected"].includes(b.visibility)) patch.visibility = b.visibility;
    if (b.allowedIds !== undefined) patch.allowedIds = JSON.stringify((b.allowedIds as number[]).map(Number));
    if (b.allowDownload !== undefined) patch.allowDownload = b.allowDownload === null ? null : !!b.allowDownload;
    if (b.title !== undefined) patch.title = String(b.title).slice(0, 80) || null;
    if (Object.keys(patch).length === 0) return NextResponse.json({ item: m });
    const [n] = await db.update(mediaItems).set(patch).where(eq(mediaItems.id, id)).returning();
    return NextResponse.json({ item: n });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    const ownerId = Number(searchParams.get("ownerId"));
    if (!id || !ownerId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    const rows = await db.select().from(mediaItems).where(eq(mediaItems.id, id));
    if (!rows[0] || rows[0].ownerId !== ownerId) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    await db.delete(mediaItems).where(eq(mediaItems.id, id));
    const _u = users;
    void _u;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
}
