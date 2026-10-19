import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, friends, mediaItems, chats, chatMembers, messages, polls, pollVotes, chatSecrets, customRoles } from "@/db/schema";
import { sql } from "drizzle-orm";
import { isDbReady, dbNotReadyResponse } from "@/lib/db-guard";

export const dynamic = "force-dynamic";

function requireDb() {
  if (!isDbReady()) return dbNotReadyResponse();
  return null;
}

async function reset() {
  await db.delete(pollVotes);
  await db.delete(polls);
  await db.delete(messages);
  await db.delete(chatSecrets);
  await db.delete(chatMembers);
  await db.delete(customRoles);
  await db.delete(chats);
  await db.delete(mediaItems);
  await db.delete(friends);
  await db.delete(users);
  for (const s of ["users_id_seq","friends_id_seq","media_items_id_seq","chats_id_seq","chat_members_id_seq","custom_roles_id_seq","messages_id_seq","polls_id_seq","poll_votes_id_seq","chat_secrets_id_seq"]) {
    try { await db.execute(sql.raw(`ALTER SEQUENCE ${s} RESTART WITH 1`)); } catch {}
  }
}

export async function POST() {
  const guard = requireDb();
  if (guard) return guard;
  try {
    await reset();

    const seedUsers = [
      { username: "valeria", displayName: "Valeria Ríos", avatarColor: "#a855f7", coverColor: "#3b0764", bio: "Amante de la privacidad y la fotografía. Aquí comparto solo con quien yo decido.", website: "https://valeria.foto", socials: { instagram: "@valeria.foto", tiktok: "@valeria.rios" } },
      { username: "diego", displayName: "Diego Torres", avatarColor: "#0ea5e9", coverColor: "#082f49", bio: "Dev Android · Creo comunidades sanas sin spam.", website: "https://diego.dev", socials: { x: "@diego_dev", youtube: "@diegotorres" } },
      { username: "sofia", displayName: "Sofía Méndez", avatarColor: "#ec4899", coverColor: "#500724", bio: "Admin de canales de música. Respeto ante todo. 🎧", website: "", socials: { instagram: "@sofi.musica" } },
      { username: "marco", displayName: "Marco Ruiz", avatarColor: "#10b981", coverColor: "#052e16", bio: "Fotógrafo urbano. Mis mejores fotos solo para amigos.", website: "https://marco.photo", socials: { facebook: "marco.ruiz" } },
      { username: "lucia", displayName: "Lucía Fernández", avatarColor: "#f59e0b", coverColor: "#451a03", bio: "Nueva por aquí. Me encantan las encuestas y los grupos.", website: "", socials: {} },
    ];
    const uids: Record<string, number> = {};
    for (const s of seedUsers) {
      const [u] = await db.insert(users).values({
        username: s.username, displayName: s.displayName, avatarColor: s.avatarColor, coverColor: s.coverColor,
        bio: s.bio, website: s.website || null, socials: JSON.stringify(s.socials),
        allowScreenshot: s.username === "marco" ? false : true,
        allowDownload: s.username === "marco" ? false : true,
      }).returning();
      uids[s.username] = u.id;
    }
    // PIN y palabra maestra de demo en valeria
    await db.execute(sql`UPDATE users SET app_pin='1234', master_secret='FENIX TOTAL' WHERE username='valeria'`);

    // amigos
    const pairs: [string, string][] = [["valeria","diego"],["valeria","sofia"],["valeria","marco"],["diego","sofia"],["diego","lucia"],["sofia","marco"]];
    for (const [a,b] of pairs) {
      await db.insert(friends).values({ userId: uids[a], friendId: uids[b], status: "accepted" });
    }

    // multimedia de perfil con visibilidades
    await db.insert(mediaItems).values([
      { ownerId: uids["valeria"], kind: "image", title: "Atardecer en la playa", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80", visibility: "public" },
      { ownerId: uids["valeria"], kind: "image", title: "Mi estudio (solo amigos elegidos)", url: "https://images.unsplash.com/photo-1493863641943-9b68992a8d07?w=800&q=80", visibility: "selected", allowedIds: JSON.stringify([uids["diego"], uids["sofia"]]) },
      { ownerId: uids["valeria"], kind: "image", title: "Diario privado", url: "https://images.unsplash.com/photo-1517842645767-c639042777db?w=800&q=80", visibility: "private", allowDownload: false },
      { ownerId: uids["marco"], kind: "image", title: "Ciudad de noche (sin descarga)", url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80", visibility: "public", allowDownload: false },
      { ownerId: uids["marco"], kind: "video", title: "Timelapse privado", url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", visibility: "selected", allowedIds: JSON.stringify([uids["valeria"]]) },
      { ownerId: uids["sofia"], kind: "audio", title: "Demo de mi set", url: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3", visibility: "public" },
    ]);

    // chats
    // 1. privado valeria-diego
    const [priv] = await db.insert(chats).values({ type: "private", title: "Valeria Ríos ↔ Diego Torres", description: "Chat privado 1 a 1", creatorId: uids["valeria"], inviteCode: "PRIV01", requireApproval: false }).returning();
    await db.insert(chatMembers).values([{ chatId: priv.id, userId: uids["valeria"], role: "founder", status: "member" }, { chatId: priv.id, userId: uids["diego"], role: "member", status: "member" }]);
    await db.insert(messages).values([
      { chatId: priv.id, senderId: uids["valeria"], kind: "text", content: "Hola Diego 👋 ¿probamos el modo privado? Esta conversación es solo nuestra." },
      { chatId: priv.id, senderId: uids["diego"], kind: "text", content: "¡Perfecto! Y si activo mi palabra secreta, solo ese chat se borraría. 🔐" },
      { chatId: priv.id, senderId: uids["valeria"], kind: "image", content: "Te comparto esta foto, solo tú la ves aquí.", mediaUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80", mediaKind: "image" },
    ]);

    // 2. grupo con aprobación
    const [grp] = await db.insert(chats).values({ type: "group", title: "Guardianes sin Spam 🛡️", description: "Grupo demo: se entra con aprobación, anti-spam 60s, roles y permisos.", creatorId: uids["diego"], inviteCode: "GUARD1", requireApproval: true, avatarColor: "#10b981" }).returning();
    await db.insert(chatMembers).values([
      { chatId: grp.id, userId: uids["diego"], role: "founder", status: "member" },
      { chatId: grp.id, userId: uids["valeria"], role: "admin", status: "member" },
      { chatId: grp.id, userId: uids["sofia"], role: "moderator", status: "member" },
      { chatId: grp.id, userId: uids["marco"], role: "member", status: "member" },
      { chatId: grp.id, userId: uids["lucia"], role: "member", status: "pending" },
    ]);
    // rol personalizado
    const [curador] = await db.insert(customRoles).values({ chatId: grp.id, name: "Curador", level: 30, permissions: JSON.stringify({ send_text: true, send_image: true, send_video: false, send_audio: true, send_link: false, mention: true, create_poll: true, create_invite: true, mute_members: false, accept_members: false, kick_lower: false, customize_group: false, manage_roles: false, send_sticker: true, publish: false }) }).returning();
    void curador;
    await db.insert(messages).values([
      { chatId: grp.id, senderId: uids["diego"], kind: "system", content: "Diego Torres creó el grupo «Guardianes sin Spam 🛡️»." },
      { chatId: grp.id, senderId: uids["diego"], kind: "text", content: "Bienvenidos 👋 Reglas: nada de repetir el mismo mensaje en 60 segundos (anti-spam activo) y respeten los rangos." },
      { chatId: grp.id, senderId: uids["valeria"], kind: "text", content: "Yo soy admin: puedo aceptar a @lucia cuando quieran. ¡Pruébenlo en la pestaña del grupo!" },
      { chatId: grp.id, senderId: uids["sofia"], kind: "sticker", content: "🔥" },
    ]);
    // encuesta en el grupo
    const [pm] = await db.insert(messages).values({ chatId: grp.id, senderId: uids["sofia"], kind: "poll", content: "¿Noche de cine el viernes?" }).returning();
    const [poll] = await db.insert(polls).values({ messageId: pm.id, chatId: grp.id, question: "¿Noche de cine el viernes?", options: JSON.stringify(["Sí, comedia", "Sí, terror", "Mejor sábado", "No puedo"]) }).returning();
    await db.insert(pollVotes).values([{ pollId: poll.id, userId: uids["diego"], optionIndex: 0 }, { pollId: poll.id, userId: uids["valeria"], optionIndex: 2 }]);

    // 3. público
    const [pub] = await db.insert(chats).values({ type: "public", title: "Plaza Pública 🌍", description: "Chat público: cualquiera puede leer sin pertenecer. Únete para escribir.", creatorId: uids["sofia"], inviteCode: "PLAZA1", requireApproval: false, avatarColor: "#f59e0b" }).returning();
    await db.insert(chatMembers).values([{ chatId: pub.id, userId: uids["sofia"], role: "founder", status: "member" }, { chatId: pub.id, userId: uids["diego"], role: "admin", status: "member" }]);
    await db.insert(messages).values([
      { chatId: pub.id, senderId: uids["sofia"], kind: "text", content: "¡Bienvenidos a la plaza! 🌍 Aquí TODO el mundo puede leer, incluso sin unirse." },
      { chatId: pub.id, senderId: uids["diego"], kind: "text", content: "Tip: entra como @lucia (sin unirte) y verás que igual puedes leer este chat. 👍" },
    ]);

    // 4. canal
    const [chan] = await db.insert(chats).values({ type: "channel", title: "Anuncios Oficiales 📢", description: "Canal: solo administradores publican, el resto lee.", creatorId: uids["diego"], inviteCode: "NEWS01", requireApproval: false, avatarColor: "#ef4444" }).returning();
    await db.insert(chatMembers).values([
      { chatId: chan.id, userId: uids["diego"], role: "founder", status: "member" },
      { chatId: chan.id, userId: uids["valeria"], role: "admin", status: "member" },
      { chatId: chan.id, userId: uids["sofia"], role: "member", status: "member" },
      { chatId: chan.id, userId: uids["marco"], role: "member", status: "member" },
    ]);
    await db.insert(messages).values([
      { chatId: chan.id, senderId: uids["diego"], kind: "text", content: "📢 Bienvenidos al canal oficial. Solo el equipo publica aquí." },
      { chatId: chan.id, senderId: uids["valeria"], kind: "text", content: "📢 Novedad: ya puedes poner palabra secreta por chat en Privacidad. Pruébalo con cuidado 😅" },
    ]);

    // palabra secreta de chat demo: privada valeria-diego
    await db.insert(chatSecrets).values({ chatId: priv.id, ownerId: uids["valeria"], secretWord: "BORRA ESTO" });

    return NextResponse.json({ ok: true, message: "Demo lista: 5 usuarios, 4 chats, roles, encuesta, multimedia con privacidad, PIN 1234 en @valeria, maestra FENIX TOTAL, secreta de chat BORRA ESTO." });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "seed failed" }, { status: 500 });
  }
}
