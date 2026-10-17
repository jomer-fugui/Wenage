import { NextResponse } from "next/server";
import { db } from "@/db";
import { chats, chatMembers, messages, users, polls, pollVotes, chatSecrets, customRoles } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { effectivePerms, isSpam, containsLink, containsMention, roleLevel } from "@/lib/messaging";

export const dynamic = "force-dynamic";

function customPermsFor(role: string, customRoleId: number | null, allCustom: typeof customRoles.$inferSelect[]) {
  if (!role.startsWith("custom:") || !customRoleId) return null;
  const cr = allCustom.find((r) => r.id === customRoleId);
  if (!cr) return null;
  try {
    return JSON.parse(cr.permissions || "{}");
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chatId = Number(searchParams.get("chatId"));
    const userId = Number(searchParams.get("userId"));
    if (!chatId) return NextResponse.json({ error: "Falta chat" }, { status: 400 });
    const c = (await db.select().from(chats).where(eq(chats.id, chatId)))[0];
    if (!c) return NextResponse.json({ error: "Chat no existe" }, { status: 404 });

    const members = await db.select().from(chatMembers).where(eq(chatMembers.chatId, chatId));
    const myMem = members.find((m) => m.userId === userId);

    // grupos privados: solo miembros ven mensajes; pendientes NO ven nada hasta ser aceptados
    if (c.type === "private" || c.type === "group") {
      if (!myMem || (myMem.status !== "member" && myMem.status !== "muted")) {
        return NextResponse.json({
          locked: true,
          myStatus: myMem?.status ?? null,
          chat: c,
          message:
            myMem?.status === "pending"
              ? "Solicitaste entrar. Verás los mensajes cuando un administrador te acepte."
              : myMem?.status === "invited"
                ? "Te invitaron a este grupo. Acepta la invitación para ver los mensajes."
                : "No perteneces a este chat.",
        });
      }
    }

    const msgs = await db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(messages.id);
    const allUsers = await db.select().from(users);
    const umap = new Map(allUsers.map((u) => [u.id, u]));
    const allPolls = await db.select().from(polls).where(eq(polls.chatId, chatId));
    const pmap = new Map(allPolls.map((p) => [p.messageId, p]));
    const votes = await db.select().from(pollVotes);
    const vmap = new Map<number, typeof votes>();
    for (const v of votes) {
      if (!vmap.has(v.pollId)) vmap.set(v.pollId, []);
      vmap.get(v.pollId)!.push(v);
    }

    const out = msgs
      .filter((m) => !m.isDeleted)
      .map((m) => {
        const sender = umap.get(m.senderId);
        const poll = m.kind === "poll" ? pmap.get(m.id) : null;
        let pollData = null;
        if (poll) {
          let options: string[] = [];
          try {
            options = JSON.parse(poll.options || "[]");
          } catch {}
          const vs = vmap.get(poll.id) ?? [];
          const counts = options.map((_, i) => vs.filter((v) => v.optionIndex === i).length);
          pollData = {
            id: poll.id,
            question: poll.question,
            options,
            counts,
            total: vs.length,
            myVote: vs.find((v) => v.userId === userId)?.optionIndex ?? null,
          };
        }
        return {
          id: m.id,
          chatId: m.chatId,
          senderId: m.senderId,
          senderName: sender?.displayName ?? "Sistema",
          senderUsername: sender?.username ?? "",
          senderColor: sender?.avatarColor ?? "#6366f1",
          kind: m.kind,
          content: m.content,
          mediaUrl: m.mediaUrl,
          mediaKind: m.mediaKind,
          replyTo: m.replyTo,
          createdAt: m.createdAt,
          poll: pollData,
        };
      });

    return NextResponse.json({ chat: c, messages: out, myRole: myMem?.role ?? null, myStatus: myMem?.status ?? "visitor" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "messages get failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const chatId = Number(b.chatId);
    const senderId = Number(b.senderId);
    const kind = String(b.kind ?? "text");
    const content = String(b.content ?? "");
    const mediaUrl = b.mediaUrl ? String(b.mediaUrl) : null;
    if (!chatId || !senderId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const c = (await db.select().from(chats).where(eq(chats.id, chatId)))[0];
    if (!c) return NextResponse.json({ error: "Chat no existe" }, { status: 404 });
    const members = await db.select().from(chatMembers).where(eq(chatMembers.chatId, chatId));
    const me = members.find((m) => m.userId === senderId);
    if (!me || (me.status !== "member" && me.status !== "muted"))
      return NextResponse.json({ error: "No eres miembro de este chat." }, { status: 403 });
    if (me.status === "muted") {
      if (me.mutedUntil && new Date(me.mutedUntil).getTime() < Date.now()) {
        await db.update(chatMembers).set({ status: "member", mutedUntil: null }).where(eq(chatMembers.id, me.id));
        me.status = "member";
      } else {
        return NextResponse.json({ error: "Estás silenciado en este chat." }, { status: 403 });
      }
    }

    // ── palabra secreta: si el texto coincide con la maestra o la del chat de OTRO miembro → borrado ──
    const trimmed = content.trim();
    if (trimmed.length >= 4 && (kind === "text" || kind === "sticker")) {
      const allUsers = await db.select().from(users);
      const umap = new Map(allUsers.map((u) => [u.id, u]));
      // maestra de cualquier otro miembro
      for (const m of members) {
        if (m.userId === senderId) continue;
        const owner = umap.get(m.userId);
        if (owner?.masterSecret && trimmed === owner.masterSecret) {
          // borrar TODOS los chats del dueño
          const ownerMems = await db.select().from(chatMembers).where(eq(chatMembers.userId, owner.id));
          const ownerChatIds = [...new Set(ownerMems.map((x) => x.chatId))];
          for (const cid of ownerChatIds) {
            const ms = await db.select().from(messages).where(eq(messages.chatId, cid));
            for (const mm of ms) await db.update(messages).set({ isDeleted: true, content: "", mediaUrl: null }).where(eq(messages.id, mm.id));
          }
          for (const om of ownerMems) await db.delete(chatMembers).where(eq(chatMembers.id, om.id));
          const secs = await db.select().from(chatSecrets).where(eq(chatSecrets.ownerId, owner.id));
          for (const s of secs) await db.delete(chatSecrets).where(eq(chatSecrets.id, s.id));
          return NextResponse.json({
            ok: true,
            panic: "master",
            message: `Palabra maestra de @${owner.username} detectada: sus ${ownerChatIds.length} chats fueron eliminados.`,
          });
        }
      }
      // secreta de este chat
      const secrets = await db.select().from(chatSecrets).where(eq(chatSecrets.chatId, chatId));
      const hit = secrets.find((s) => s.ownerId !== senderId && s.secretWord === trimmed);
      if (hit) {
        const ms = await db.select().from(messages).where(eq(messages.chatId, chatId));
        for (const mm of ms) await db.update(messages).set({ isDeleted: true, content: "", mediaUrl: null }).where(eq(messages.id, mm.id));
        const ownerMems = members.filter((m) => m.userId === hit.ownerId);
        for (const om of ownerMems) await db.delete(chatMembers).where(eq(chatMembers.id, om.id));
        return NextResponse.json({ ok: true, panic: "chat", message: "Palabra secreta del chat detectada: este chat fue eliminado." });
      }
    }

    // ── permisos por rol ──
    const allCustom = await db.select().from(customRoles).where(eq(customRoles.chatId, chatId));
    const cp = customPermsFor(me.role, me.customRoleId, allCustom);
    const perms = effectivePerms(me.role, cp);
    const lvl = roleLevel(me.role, allCustom.find((r) => r.id === me.customRoleId)?.level);

    if (c.type === "channel") {
      // solo founder/admin (o publish) publican
      if (!perms.publish || lvl < 70) return NextResponse.json({ error: "Solo los administradores pueden publicar en este canal." }, { status: 403 });
    }

    const kindPerm: Record<string, keyof typeof perms> = {
      text: "send_text",
      sticker: "send_sticker",
      image: "send_image",
      video: "send_video",
      audio: "send_audio",
      file: "send_text",
      poll: "create_poll",
    };
    if (kindPerm[kind] && !perms[kindPerm[kind] as keyof typeof perms])
      return NextResponse.json({ error: `Tu rol (${me.role}) no tiene permiso para enviar ${kind}.` }, { status: 403 });
    if ((kind === "image" || kind === "video" || kind === "audio" || kind === "file") && !mediaUrl)
      return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });

    if (kind === "text" || kind === "poll") {
      if (!content.trim() && kind === "text") return NextResponse.json({ error: "Mensaje vacío." }, { status: 400 });
      if (containsLink(content) && !perms.send_link) return NextResponse.json({ error: "Tu rol no puede enviar enlaces." }, { status: 403 });
      if (containsMention(content) && !perms.mention) return NextResponse.json({ error: "Tu rol no puede etiquetar (@)." }, { status: 403 });
    }

    // ── anti-spam ──
    if (c.spamEnabled && (kind === "text" || kind === "sticker")) {
      const recent = await db.select().from(messages).where(and(eq(messages.chatId, chatId), eq(messages.senderId, senderId))).orderBy(desc(messages.id));
      const windowStart = Date.now() - c.spamWindow * 1000;
      const recents = recent
        .filter((m) => !m.isDeleted && m.createdAt && new Date(m.createdAt).getTime() > windowStart && (m.kind === "text" || m.kind === "sticker"))
        .slice(0, 8)
        .map((m) => ({ content: m.content || "", at: new Date(m.createdAt as Date).getTime() }));
      if (isSpam(content, recents, c.spamWindow))
        return NextResponse.json(
          { error: `Anti-SPAM: ya enviaste un mensaje igual o muy parecido en los últimos ${c.spamWindow}s. Espera o cambia el texto.` },
          { status: 429 }
        );
    }

    // encuestas
    if (kind === "poll") {
      const question = String(b.question ?? content).trim().slice(0, 200);
      const options: string[] = Array.isArray(b.options) ? b.options.map((o: unknown) => String(o).trim().slice(0, 80)).filter(Boolean).slice(0, 6) : [];
      if (!question || options.length < 2) return NextResponse.json({ error: "La encuesta necesita pregunta y al menos 2 opciones." }, { status: 400 });
      const [m] = await db.insert(messages).values({ chatId, senderId, kind: "poll", content: question }).returning();
      const [p] = await db.insert(polls).values({ messageId: m.id, chatId, question, options: JSON.stringify(options) }).returning();
      return NextResponse.json({ message: m, pollId: p.id });
    }

    const [m] = await db
      .insert(messages)
      .values({
        chatId,
        senderId,
        kind,
        content: content.slice(0, 4000),
        mediaUrl,
        mediaKind: b.mediaKind ?? (["image", "video", "audio", "file"].includes(kind) ? kind : null),
        replyTo: b.replyTo ? Number(b.replyTo) : null,
      })
      .returning();
    return NextResponse.json({ message: m });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "send failed" }, { status: 500 });
  }
}
