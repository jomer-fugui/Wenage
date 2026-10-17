import { NextResponse } from "next/server";
import { db } from "@/db";
import { chats, chatMembers, users, messages } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { makeInvite } from "@/lib/messaging";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = Number(searchParams.get("userId"));
    const allChats = await db.select().from(chats).orderBy(desc(chats.id));
    const allMembers = await db.select().from(chatMembers);
    const allUsers = await db.select().from(users);
    const umap = new Map(allUsers.map((u) => [u.id, u]));

    // último mensaje por chat
    const allMsgs = await db.select().from(messages).orderBy(desc(messages.id)).limit(500);
    const lastByChat = new Map<number, (typeof allMsgs)[number]>();
    for (const m of [...allMsgs].reverse()) lastByChat.set(m.chatId, m);

    if (!userId) {
      const pubs = allChats.filter((c) => c.type === "public" || c.type === "channel");
      return NextResponse.json({
        chats: pubs.map((c) => ({
          ...c,
          membersCount: allMembers.filter((m) => m.chatId === c.id && (m.status === "member" || m.status === "muted")).length,
          lastMessage: lastByChat.get(c.id) ?? null,
          myStatus: null,
          myRole: null,
        })),
      });
    }

    const mine = allMembers.filter((m) => m.userId === userId);
    const myMap = new Map(mine.map((m) => [m.chatId, m]));

    const memberChats = allChats
      .filter((c) => {
        const mem = myMap.get(c.id);
        return mem && (mem.status === "member" || mem.status === "muted");
      })
      .map((c) => ({
        ...c,
        membersCount: allMembers.filter((m) => m.chatId === c.id && (m.status === "member" || m.status === "muted")).length,
        pendingCount: allMembers.filter((m) => m.chatId === c.id && m.status === "pending").length,
        lastMessage: lastByChat.get(c.id) ?? null,
        lastSenderName: (() => {
          const lm = lastByChat.get(c.id);
          if (!lm || lm.isDeleted) return null;
          return umap.get(lm.senderId)?.displayName ?? null;
        })(),
        myStatus: myMap.get(c.id)?.status ?? null,
        myRole: myMap.get(c.id)?.role ?? null,
      }));

    const pendingChats = allChats
      .filter((c) => {
        const mem = myMap.get(c.id);
        return mem && (mem.status === "pending" || mem.status === "invited");
      })
      .map((c) => ({
        ...c,
        membersCount: allMembers.filter((m) => m.chatId === c.id && (m.status === "member" || m.status === "muted")).length,
        myStatus: myMap.get(c.id)?.status ?? null,
        myRole: myMap.get(c.id)?.role ?? null,
        lastMessage: null,
      }));

    const explore = allChats
      .filter((c) => (c.type === "public" || c.type === "channel") && !myMap.has(c.id))
      .map((c) => ({
        ...c,
        membersCount: allMembers.filter((m) => m.chatId === c.id && (m.status === "member" || m.status === "muted")).length,
        lastMessage: lastByChat.get(c.id) ?? null,
        myStatus: null,
        myRole: null,
      }));

    // privados con nombre del otro
    const withPeer = memberChats.map((c) => {
      if (c.type !== "private") return c;
      const others = allMembers.filter((m) => m.chatId === c.id && m.userId !== userId && (m.status === "member" || m.status === "muted"));
      const peer = others[0] ? umap.get(others[0].userId) : null;
      return { ...c, peerName: peer?.displayName ?? c.title, peerUsername: peer?.username ?? "", peerAvatar: peer?.avatarColor ?? "#6366f1" };
    });

    const [totalChats] = await db.select({ n: sql<number>`count(*)::int` }).from(chats);

    return NextResponse.json({ chats: withPeer, pending: pendingChats, explore, total: totalChats?.n ?? allChats.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "chats failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const creatorId = Number(b.creatorId);
    const type = ["private", "group", "public", "channel"].includes(b.type) ? b.type : "group";
    const title = String(b.title ?? "").trim().slice(0, 60);
    if (!creatorId || !title) return NextResponse.json({ error: "Falta creador o nombre." }, { status: 400 });

    const me = await db.select().from(users).where(eq(users.id, creatorId));
    if (!me[0]) return NextResponse.json({ error: "Creador no existe" }, { status: 404 });

    const memberUsernames: string[] = Array.isArray(b.members) ? b.members : [];
    const allUsers = await db.select().from(users);
    const byName = new Map(allUsers.map((u) => [u.username.toLowerCase(), u]));
    const memberIds = [...new Set(memberUsernames.map((n) => byName.get(String(n).toLowerCase().replace(/^@/, ""))?.id).filter(Boolean) as number[])].filter(
      (id) => id !== creatorId
    );

    const creatorName = me[0].displayName;

    if (type === "private") {
      if (memberIds.length !== 1) return NextResponse.json({ error: "El chat privado necesita exactamente 1 contacto (@usuario)." }, { status: 400 });
      const peerId = memberIds[0];
      // evitar duplicado privado
      const myChats = await db.select().from(chatMembers).where(eq(chatMembers.userId, creatorId));
      const peerChats = await db.select().from(chatMembers).where(eq(chatMembers.userId, peerId));
      const myIds = new Set(myChats.map((m) => m.chatId));
      const shared = peerChats.find((m) => myIds.has(m.chatId));
      if (shared) {
        const c = await db.select().from(chats).where(eq(chats.id, shared.chatId));
        if (c[0] && c[0].type === "private") return NextResponse.json({ error: "Ya tienes un chat privado con ese contacto.", chatId: c[0].id }, { status: 409 });
      }
      const peer = byName.get(allUsers.find((u) => u.id === peerId)?.username.toLowerCase() ?? "");
      const [c] = await db
        .insert(chats)
        .values({
          type: "private",
          title: `${creatorName} ↔ ${peer?.displayName ?? "contacto"}`,
          description: "Chat privado 1 a 1",
          creatorId,
          inviteCode: makeInvite(),
          requireApproval: false,
        })
        .returning();
      await db.insert(chatMembers).values({ chatId: c.id, userId: creatorId, role: "founder", status: "member" });
      await db.insert(chatMembers).values({ chatId: c.id, userId: peerId, role: "member", status: "member" });
      await db.insert(messages).values({ chatId: c.id, senderId: creatorId, kind: "system", content: `${creatorName} inició un chat privado.` });
      return NextResponse.json({ chat: c });
    }

    // group / public / channel
    const [c] = await db
      .insert(chats)
      .values({
        type,
        title,
        description: String(b.description ?? "").slice(0, 300),
        creatorId,
        inviteCode: makeInvite(),
        requireApproval: type === "group" ? b.requireApproval !== false : false,
        avatarColor: b.avatarColor ?? "#0ea5e9",
      })
      .returning();
    await db.insert(chatMembers).values({ chatId: c.id, userId: creatorId, role: "founder", status: "member" });
    for (const mid of memberIds.slice(0, 50)) {
      // en grupos con aprobación entran como pendientes; en públicos/canal entran directo
      const status = type === "group" && c.requireApproval ? "pending" : "member";
      await db.insert(chatMembers).values({ chatId: c.id, userId: mid, role: "member", status });
    }
    await db.insert(messages).values({
      chatId: c.id,
      senderId: creatorId,
      kind: "system",
      content: `${creatorName} creó ${type === "channel" ? "el canal" : type === "public" ? "el chat público" : "el grupo"} «${title}».`,
    });
    return NextResponse.json({ chat: c });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "create chat failed" }, { status: 500 });
  }
}
