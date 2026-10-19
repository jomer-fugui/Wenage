import { NextResponse } from "next/server";
import { db } from "@/db";
import { chats, chatMembers, users, customRoles, messages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { effectivePerms, roleLevel, makeInvite, DEFAULT_ROLE_PERMS } from "@/lib/messaging";
import { isDbReady, dbNotReadyResponse } from "@/lib/db-guard";

export const dynamic = "force-dynamic";

function requireDb() {
  if (!isDbReady()) return dbNotReadyResponse();
  return null;
}

function permsFor(role: string, customRoleId: number | null, customs: typeof customRoles.$inferSelect[]) {
  if (role.startsWith("custom:")) {
    const cr = customs.find((c) => c.id === customRoleId);
    if (cr) {
      try {
        return JSON.parse(cr.permissions);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function GET(req: Request) {
  const guard = requireDb();
  if (guard) return guard;
  try {
    const { searchParams } = new URL(req.url);
    const chatId = Number(searchParams.get("chatId"));
    if (!chatId) return NextResponse.json({ error: "Falta chat" }, { status: 400 });
    const members = await db.select().from(chatMembers).where(eq(chatMembers.chatId, chatId));
    const allUsers = await db.select().from(users);
    const umap = new Map(allUsers.map((u) => [u.id, u]));
    const customs = await db.select().from(customRoles).where(eq(customRoles.chatId, chatId));
    const cmap = new Map(customs.map((c) => [c.id, c]));
    return NextResponse.json({
      members: members.map((m) => ({
        ...m,
        displayName: umap.get(m.userId)?.displayName ?? `#${m.userId}`,
        username: umap.get(m.userId)?.username ?? "",
        avatarColor: umap.get(m.userId)?.avatarColor ?? "#6366f1",
        customRoleName: m.customRoleId ? (cmap.get(m.customRoleId)?.name ?? null) : null,
        customLevel: m.customRoleId ? (cmap.get(m.customRoleId)?.level ?? 20) : null,
      })),
      customRoles: customs,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "members failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = requireDb();
  if (guard) return guard;
  try {
    const b = await req.json();
    const action = String(b.action ?? "");
    const chatId = Number(b.chatId);
    const actorId = Number(b.actorId);
    if (!chatId || !actorId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const chat = (await db.select().from(chats).where(eq(chats.id, chatId)))[0];
    if (!chat) return NextResponse.json({ error: "Chat no existe" }, { status: 404 });
    const members = await db.select().from(chatMembers).where(eq(chatMembers.chatId, chatId));
    const actor = members.find((m) => m.userId === actorId);
    const customs = await db.select().from(customRoles).where(eq(customRoles.chatId, chatId));
    const actorPerms = actor ? effectivePerms(actor.role, permsFor(actor.role, actor.customRoleId, customs)) : null;
    const actorLvl = actor ? roleLevel(actor.role, customs.find((c) => c.id === actor.customRoleId)?.level) : 0;
    const isCreator = chat.creatorId === actorId;
    const adminLike = isCreator || (actor && actorLvl >= 70);

    const need = (perm: keyof typeof DEFAULT_ROLE_PERMS.member) => {
      if (isCreator) return true;
      return !!actorPerms?.[perm];
    };
    const targetLevel = (targetRole: string, targetCustomId: number | null) =>
      roleLevel(targetRole, customs.find((c) => c.id === targetCustomId)?.level);

    // ── unirse / invitación ──
    if (action === "join") {
      const code = String(b.code ?? "").trim().toUpperCase();
      if (chat.type === "public" || chat.type === "channel") {
        if (members.find((m) => m.userId === actorId)) return NextResponse.json({ error: "Ya perteneces." }, { status: 409 });
        await db.insert(chatMembers).values({ chatId, userId: actorId, role: "member", status: "member" });
        return NextResponse.json({ ok: true, message: "Te uniste." });
      }
      // grupo: por código o solicitud
      if (code && chat.inviteCode && code === chat.inviteCode) {
        if (members.find((m) => m.userId === actorId)) return NextResponse.json({ error: "Ya estás dentro o pendiente." }, { status: 409 });
        const status = chat.requireApproval ? "pending" : "member";
        await db.insert(chatMembers).values({ chatId, userId: actorId, role: "member", status });
        return NextResponse.json({ ok: true, status, message: status === "pending" ? "Solicitud enviada. Verás los mensajes al ser aceptado." : "Entraste al grupo." });
      }
      if (members.find((m) => m.userId === actorId)) return NextResponse.json({ error: "Ya tienes solicitud o membresía." }, { status: 409 });
      await db.insert(chatMembers).values({ chatId, userId: actorId, role: "member", status: "pending" });
      return NextResponse.json({ ok: true, status: "pending", message: "Solicitud enviada. Verás los mensajes cuando te acepten." });
    }
    if (action === "accept_invite") {
      const mem = members.find((m) => m.userId === actorId && m.status === "invited");
      if (!mem) return NextResponse.json({ error: "No tienes invitación." }, { status: 404 });
      await db.update(chatMembers).set({ status: "member" }).where(eq(chatMembers.id, mem.id));
      return NextResponse.json({ ok: true, message: "Invitación aceptada. Ya puedes ver los mensajes." });
    }
    if (action === "leave") {
      const mem = members.find((m) => m.userId === actorId);
      if (!mem) return NextResponse.json({ error: "No perteneces." }, { status: 404 });
      if (chat.creatorId === actorId && chat.type !== "private") return NextResponse.json({ error: "El creador no puede salir; transfiere o elimina." }, { status: 403 });
      await db.delete(chatMembers).where(eq(chatMembers.id, mem.id));
      return NextResponse.json({ ok: true });
    }

    // ── moderación (requieren permisos) ──
    const targetId = Number(b.targetId);
    const target = members.find((m) => m.userId === targetId);

    if (action === "approve" || action === "reject") {
      if (!need("accept_members")) return NextResponse.json({ error: "Tu rol no puede aceptar miembros." }, { status: 403 });
      if (!target || target.status !== "pending") return NextResponse.json({ error: "Sin solicitud pendiente." }, { status: 404 });
      if (action === "approve") {
        await db.update(chatMembers).set({ status: "member" }).where(eq(chatMembers.id, target.id));
        await db.insert(messages).values({ chatId, senderId: actorId, kind: "system", content: `Se aceptó a un nuevo miembro en el grupo.` });
        return NextResponse.json({ ok: true, message: "Miembro aceptado: ya puede ver los mensajes." });
      }
      await db.delete(chatMembers).where(eq(chatMembers.id, target.id));
      return NextResponse.json({ ok: true, message: "Solicitud rechazada." });
    }
    if (action === "invite") {
      if (!need("create_invite")) return NextResponse.json({ error: "Tu rol no puede invitar." }, { status: 403 });
      const uname = String(b.username ?? "").toLowerCase().replace(/^@/, "");
      const u = (await db.select().from(users)).find((x) => x.username === uname);
      if (!u) return NextResponse.json({ error: `No existe @${uname}.` }, { status: 404 });
      if (members.find((m) => m.userId === u.id)) return NextResponse.json({ error: "Ya está dentro o pendiente." }, { status: 409 });
      await db.insert(chatMembers).values({ chatId, userId: u.id, role: "member", status: "invited" });
      return NextResponse.json({ ok: true, message: `Invitación enviada a @${uname}.` });
    }
    if (action === "kick") {
      if (!need("kick_lower")) return NextResponse.json({ error: "Tu rol no puede expulsar." }, { status: 403 });
      if (!target) return NextResponse.json({ error: "Miembro no encontrado." }, { status: 404 });
      if (target.userId === chat.creatorId) return NextResponse.json({ error: "No puedes expulsar al creador." }, { status: 403 });
      if (!isCreator && targetLevel(target.role, target.customRoleId) >= actorLvl)
        return NextResponse.json({ error: "Solo puedes expulsar a niveles inferiores al tuyo." }, { status: 403 });
      await db.delete(chatMembers).where(eq(chatMembers.id, target.id));
      await db.insert(messages).values({ chatId, senderId: actorId, kind: "system", content: "Un miembro fue expulsado del grupo." });
      return NextResponse.json({ ok: true, message: "Miembro expulsado." });
    }
    if (action === "mute" || action === "unmute") {
      if (!need("mute_members")) return NextResponse.json({ error: "Tu rol no puede silenciar." }, { status: 403 });
      if (!target) return NextResponse.json({ error: "Miembro no encontrado." }, { status: 404 });
      if (!isCreator && targetLevel(target.role, target.customRoleId) >= actorLvl)
        return NextResponse.json({ error: "Solo puedes silenciar a niveles inferiores." }, { status: 403 });
      if (action === "mute") {
        const mins = Math.min(1440, Math.max(1, Number(b.minutes ?? 10)));
        await db.update(chatMembers).set({ status: "muted", mutedUntil: new Date(Date.now() + mins * 60_000) }).where(eq(chatMembers.id, target.id));
        return NextResponse.json({ ok: true, message: `Silenciado por ${mins} min.` });
      }
      await db.update(chatMembers).set({ status: "member", mutedUntil: null }).where(eq(chatMembers.id, target.id));
      return NextResponse.json({ ok: true, message: "Silencio retirado." });
    }
    if (action === "set_role") {
      if (!need("manage_roles") && !isCreator) return NextResponse.json({ error: "Tu rol no gestiona rangos." }, { status: 403 });
      if (!target) return NextResponse.json({ error: "Miembro no encontrado." }, { status: 404 });
      const role = String(b.role ?? "member");
      const customRoleId = b.customRoleId ? Number(b.customRoleId) : null;
      if (target.userId === chat.creatorId && !isCreator) return NextResponse.json({ error: "No puedes cambiar al creador." }, { status: 403 });
      if (!isCreator && ["founder", "admin"].includes(role)) return NextResponse.json({ error: "Solo el fundador/creador puede dar admin/fundador." }, { status: 403 });
      if (role.startsWith("custom:")) {
        const cr = customs.find((c) => c.id === customRoleId);
        if (!cr) return NextResponse.json({ error: "Rol personalizado no existe." }, { status: 404 });
        await db.update(chatMembers).set({ role: `custom:${cr.id}`, customRoleId: cr.id }).where(eq(chatMembers.id, target.id));
      } else {
        if (!["admin", "moderator", "member"].includes(role)) return NextResponse.json({ error: "Rol inválido." }, { status: 400 });
        await db.update(chatMembers).set({ role, customRoleId: null }).where(eq(chatMembers.id, target.id));
      }
      return NextResponse.json({ ok: true, message: "Rango actualizado." });
    }
    if (action === "create_role") {
      if (!adminLike && !need("manage_roles")) return NextResponse.json({ error: "Sin permiso para crear roles." }, { status: 403 });
      const name = String(b.name ?? "").trim().slice(0, 30);
      const level = Math.min(90, Math.max(1, Number(b.level ?? 20)));
      if (!name) return NextResponse.json({ error: "Nombre del rol requerido." }, { status: 400 });
      if (!isCreator && level >= actorLvl) return NextResponse.json({ error: "El nivel debe ser menor al tuyo." }, { status: 403 });
      const perms = (b.permissions ?? {}) as Record<string, boolean>;
      const [cr] = await db.insert(customRoles).values({ chatId, name, level, permissions: JSON.stringify(perms) }).returning();
      return NextResponse.json({ ok: true, role: cr });
    }
    if (action === "update_role") {
      if (!adminLike && !need("manage_roles")) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
      const id = Number(b.roleId);
      const cr = customs.find((c) => c.id === id);
      if (!cr) return NextResponse.json({ error: "Rol no existe." }, { status: 404 });
      const patch: Record<string, unknown> = {};
      if (b.name) patch.name = String(b.name).slice(0, 30);
      if (b.level) {
        const lv = Math.min(90, Math.max(1, Number(b.level)));
        if (!isCreator && lv >= actorLvl) return NextResponse.json({ error: "Nivel debe ser menor al tuyo." }, { status: 403 });
        patch.level = lv;
      }
      if (b.permissions) patch.permissions = JSON.stringify(b.permissions);
      const [n] = await db.update(customRoles).set(patch).where(eq(customRoles.id, id)).returning();
      return NextResponse.json({ ok: true, role: n });
    }
    if (action === "delete_role") {
      if (!adminLike && !need("manage_roles")) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
      const id = Number(b.roleId);
      const holders = members.filter((m) => m.customRoleId === id);
      for (const h of holders) await db.update(chatMembers).set({ role: "member", customRoleId: null }).where(eq(chatMembers.id, h.id));
      await db.delete(customRoles).where(eq(customRoles.id, id));
      return NextResponse.json({ ok: true });
    }
    if (action === "settings") {
      if (!need("customize_group")) return NextResponse.json({ error: "Tu rol no puede personalizar el grupo." }, { status: 403 });
      const patch: Record<string, unknown> = {};
      if (b.title !== undefined) patch.title = String(b.title).slice(0, 60);
      if (b.description !== undefined) patch.description = String(b.description).slice(0, 300);
      if (b.requireApproval !== undefined) patch.requireApproval = !!b.requireApproval;
      if (b.spamEnabled !== undefined) patch.spamEnabled = !!b.spamEnabled;
      if (b.spamWindow !== undefined) patch.spamWindow = Math.min(600, Math.max(10, Number(b.spamWindow) || 60));
      if (b.avatarColor !== undefined) patch.avatarColor = b.avatarColor;
      const [n] = await db.update(chats).set(patch).where(eq(chats.id, chatId)).returning();
      return NextResponse.json({ ok: true, chat: n });
    }
    if (action === "regen_invite") {
      if (!need("create_invite")) return NextResponse.json({ error: "Tu rol no puede crear invitaciones." }, { status: 403 });
      const [n] = await db.update(chats).set({ inviteCode: makeInvite() }).where(eq(chats.id, chatId)).returning();
      return NextResponse.json({ ok: true, inviteCode: n.inviteCode });
    }

    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "members post failed" }, { status: 500 });
  }
}
