import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, chatMembers, messages, chatSecrets, chats } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET ?userId= → ajustes de privacidad (sin exponer secretos completos)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = Number(searchParams.get("userId"));
    if (!userId) return NextResponse.json({ error: "Falta userId" }, { status: 400 });
    const rows = await db.select().from(users).where(eq(users.id, userId));
    const u = rows[0];
    if (!u) return NextResponse.json({ error: "No existe" }, { status: 404 });
    const secrets = await db.select().from(chatSecrets).where(eq(chatSecrets.ownerId, userId));
    const allChats = await db.select().from(chats);
    const cmap = new Map(allChats.map((c) => [c.id, c.title]));
    return NextResponse.json({
      settings: {
        allowScreenshot: u.allowScreenshot,
        allowDownload: u.allowDownload,
        hasPin: !!u.appPin,
        hasMasterSecret: !!u.masterSecret,
        masterHint: u.masterSecret ? `••••${String(u.masterSecret).slice(-2)}` : null,
      },
      chatSecrets: secrets.map((s) => ({ id: s.id, chatId: s.chatId, chatTitle: cmap.get(s.chatId) ?? `#${s.chatId}`, hint: `••••${String(s.secretWord).slice(-2)}` })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "privacy get failed" }, { status: 500 });
  }
}

async function wipeOwner(ownerId: number) {
  // todos los chats donde participa el dueño: borrar sus mensajes + sacarlo + borrar secretos
  const memberships = await db.select().from(chatMembers).where(eq(chatMembers.userId, ownerId));
  const chatIds = [...new Set(memberships.map((m) => m.chatId))];
  let deletedMessages = 0;
  if (chatIds.length) {
    const msgs = await db.select().from(messages).where(inArray(messages.chatId, chatIds));
    const toDelete = msgs.filter((m) => m.senderId === ownerId || chatIds.includes(m.chatId));
    // borrado total de esos chats (todos sus chats eliminados completamente)
    for (const m of toDelete) {
      await db.update(messages).set({ isDeleted: true, content: "", mediaUrl: null }).where(eq(messages.id, m.id));
      deletedMessages++;
    }
    // eliminar membresías del dueño
    for (const mem of memberships) {
      await db.delete(chatMembers).where(eq(chatMembers.id, mem.id));
    }
  } else {
    const own = await db.select().from(messages).where(eq(messages.senderId, ownerId));
    for (const m of own) {
      await db.update(messages).set({ isDeleted: true, content: "", mediaUrl: null }).where(eq(messages.id, m.id));
      deletedMessages++;
    }
  }
  const secs = await db.select().from(chatSecrets).where(eq(chatSecrets.ownerId, ownerId));
  for (const s of secs) await db.delete(chatSecrets).where(eq(chatSecrets.id, s.id));
  return { chatIds: chatIds.length, deletedMessages };
}

async function wipeChat(chatId: number, ownerId: number) {
  const msgs = await db.select().from(messages).where(eq(messages.chatId, chatId));
  for (const m of msgs) {
    await db.update(messages).set({ isDeleted: true, content: "", mediaUrl: null }).where(eq(messages.id, m.id));
  }
  const mems = await db.select().from(chatMembers).where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, ownerId)));
  for (const mem of mems) await db.delete(chatMembers).where(eq(chatMembers.id, mem.id));
  return { deletedMessages: msgs.length };
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const action = String(b.action ?? "");
    const userId = Number(b.userId);
    if (!userId) return NextResponse.json({ error: "Falta userId" }, { status: 400 });
    const rows = await db.select().from(users).where(eq(users.id, userId));
    const u = rows[0];
    if (!u) return NextResponse.json({ error: "Usuario no existe" }, { status: 404 });

    if (action === "toggle_screenshot") {
      const [n] = await db.update(users).set({ allowScreenshot: !u.allowScreenshot }).where(eq(users.id, userId)).returning();
      return NextResponse.json({ ok: true, allowScreenshot: n.allowScreenshot });
    }
    if (action === "toggle_download") {
      const [n] = await db.update(users).set({ allowDownload: !u.allowDownload }).where(eq(users.id, userId)).returning();
      return NextResponse.json({ ok: true, allowDownload: n.allowDownload });
    }
    if (action === "set_pin") {
      const pin = String(b.pin ?? "").replace(/\D/g, "").slice(0, 6);
      if (pin && pin.length < 4) return NextResponse.json({ error: "El PIN debe tener 4 a 6 dígitos." }, { status: 400 });
      await db.update(users).set({ appPin: pin || null }).where(eq(users.id, userId));
      return NextResponse.json({ ok: true, hasPin: !!pin, message: pin ? "Contraseña activada: se pedirá al abrir la app." : "Contraseña desactivada." });
    }
    if (action === "verify_pin") {
      const pin = String(b.pin ?? "");
      if (!u.appPin) return NextResponse.json({ ok: true });
      if (pin === u.appPin) return NextResponse.json({ ok: true });
      return NextResponse.json({ ok: false, error: "PIN incorrecto." }, { status: 401 });
    }
    if (action === "set_master") {
      const w = String(b.word ?? "").trim();
      if (w && w.length < 4) return NextResponse.json({ error: "La palabra maestra debe tener al menos 4 caracteres." }, { status: 400 });
      await db.update(users).set({ masterSecret: w || null }).where(eq(users.id, userId));
      return NextResponse.json({
        ok: true,
        hasMasterSecret: !!w,
        message: w
          ? "Palabra maestra guardada. Si la envías desde OTRA cuenta en cualquier chat donde participes, todos tus chats se eliminarán."
          : "Palabra maestra eliminada.",
      });
    }
    if (action === "set_chat_secret") {
      const chatId = Number(b.chatId);
      const w = String(b.word ?? "").trim();
      if (!chatId) return NextResponse.json({ error: "Falta chat" }, { status: 400 });
      const existing = await db.select().from(chatSecrets).where(and(eq(chatSecrets.chatId, chatId), eq(chatSecrets.ownerId, userId)));
      if (!w) {
        for (const s of existing) await db.delete(chatSecrets).where(eq(chatSecrets.id, s.id));
        return NextResponse.json({ ok: true, message: "Palabra de ese chat eliminada." });
      }
      if (w.length < 4) return NextResponse.json({ error: "Mínimo 4 caracteres." }, { status: 400 });
      if (existing[0]) await db.update(chatSecrets).set({ secretWord: w }).where(eq(chatSecrets.id, existing[0].id));
      else await db.insert(chatSecrets).values({ chatId, ownerId: userId, secretWord: w });
      return NextResponse.json({ ok: true, message: "Palabra de chat guardada. Si se envía desde otra cuenta en ese chat, solo ese chat se eliminará." });
    }
    if (action === "panic_send") {
      // simula enviar la palabra desde otra cuenta: {targetUsername, word}
      const target = String(b.targetUsername ?? "").trim().toLowerCase().replace(/^@/, "");
      const word = String(b.word ?? "").trim();
      if (!target || !word) return NextResponse.json({ error: "Indica usuario y palabra." }, { status: 400 });
      const t = await db.select().from(users).where(eq(users.username, target));
      const victim = t[0];
      if (!victim) return NextResponse.json({ error: "Ese usuario no existe." }, { status: 404 });
      if (victim.masterSecret && word === victim.masterSecret) {
        const r = await wipeOwner(victim.id);
        return NextResponse.json({ ok: true, triggered: "master", message: `Palabra maestra correcta: se eliminaron ${r.chatIds} chats y ${r.deletedMessages} mensajes de @${victim.username}.`, detail: r });
      }
      // buscar secreto por chat
      const allSecs = await db.select().from(chatSecrets).where(eq(chatSecrets.ownerId, victim.id));
      const hit = allSecs.find((s) => s.secretWord === word);
      if (hit) {
        const r = await wipeChat(hit.chatId, victim.id);
        return NextResponse.json({ ok: true, triggered: "chat", message: `Palabra de chat correcta: chat #${hit.chatId} eliminado (${r.deletedMessages} mensajes).`, detail: r });
      }
      return NextResponse.json({ ok: false, error: "Palabra incorrecta: no se eliminó nada." }, { status: 403 });
    }
    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "privacy failed" }, { status: 500 });
  }
}
