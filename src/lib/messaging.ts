export type PermKey =
  | "customize_group"
  | "accept_members"
  | "kick_lower"
  | "send_text"
  | "send_sticker"
  | "send_image"
  | "send_video"
  | "send_audio"
  | "send_link"
  | "mention"
  | "create_poll"
  | "manage_roles"
  | "create_invite"
  | "mute_members"
  | "publish";

export const PERMISSIONS: { key: PermKey; label: string; desc: string }[] = [
  { key: "customize_group", label: "Personalizar grupo", desc: "Cambiar nombre, descripción y ajustes anti-spam" },
  { key: "accept_members", label: "Aceptar / rechazar", desc: "Aprobar o rechazar solicitudes para entrar" },
  { key: "kick_lower", label: "Expulsar nivel inferior", desc: "Expulsar miembros de rango menor al suyo" },
  { key: "send_text", label: "Enviar texto", desc: "Publicar mensajes de texto" },
  { key: "send_sticker", label: "Enviar stickers", desc: "Usar stickers y emojis grandes" },
  { key: "send_image", label: "Enviar imágenes", desc: "Compartir fotos e imágenes" },
  { key: "send_video", label: "Enviar videos", desc: "Compartir videos" },
  { key: "send_audio", label: "Enviar audios", desc: "Notas de voz y audio" },
  { key: "send_link", label: "Enviar enlaces", desc: "Publicar URLs y links" },
  { key: "mention", label: "Etiquetar", desc: "Mencionar con @ a otros miembros" },
  { key: "create_poll", label: "Crear encuestas", desc: "Lanzar votaciones en el chat" },
  { key: "manage_roles", label: "Gestionar roles", desc: "Crear roles y cambiar permisos" },
  { key: "create_invite", label: "Crear invitación", desc: "Generar códigos de invitación" },
  { key: "mute_members", label: "Silenciar miembros", desc: "Mutear temporalmente a otros" },
  { key: "publish", label: "Publicar en canal", desc: "Publicar en canales (solo rangos altos)" },
];

export const ALL_TRUE: Record<PermKey, boolean> = {
  customize_group: true,
  accept_members: true,
  kick_lower: true,
  send_text: true,
  send_sticker: true,
  send_image: true,
  send_video: true,
  send_audio: true,
  send_link: true,
  mention: true,
  create_poll: true,
  manage_roles: true,
  create_invite: true,
  mute_members: true,
  publish: true,
};

export const DEFAULT_ROLE_PERMS: Record<string, Record<PermKey, boolean>> = {
  founder: { ...ALL_TRUE },
  admin: { ...ALL_TRUE, manage_roles: true },
  moderator: {
    customize_group: false,
    accept_members: false,
    kick_lower: true,
    send_text: true,
    send_sticker: true,
    send_image: true,
    send_video: true,
    send_audio: true,
    send_link: true,
    mention: true,
    create_poll: true,
    manage_roles: false,
    create_invite: true,
    mute_members: true,
    publish: true,
  },
  member: {
    customize_group: false,
    accept_members: false,
    kick_lower: false,
    send_text: true,
    send_sticker: true,
    send_image: true,
    send_video: true,
    send_audio: true,
    send_link: true,
    mention: true,
    create_poll: true,
    manage_roles: false,
    create_invite: false,
    mute_members: false,
    publish: false,
  },
};

export const ROLE_LEVEL: Record<string, number> = {
  founder: 100,
  admin: 70,
  moderator: 40,
  member: 10,
};

export const ROLE_LABEL: Record<string, string> = {
  founder: "Fundador",
  admin: "Administrador",
  moderator: "Moderador",
  member: "Miembro",
};

export function roleLevel(role: string, customLevel?: number): number {
  if (role.startsWith("custom:")) return customLevel ?? 20;
  return ROLE_LEVEL[role] ?? 10;
}

export function roleLabel(role: string, customName?: string): string {
  if (role.startsWith("custom:")) return customName ?? "Rol personalizado";
  return ROLE_LABEL[role] ?? role;
}

export function effectivePerms(
  role: string,
  customPerms?: Record<string, boolean> | null
): Record<PermKey, boolean> {
  if (role.startsWith("custom:") && customPerms) {
    const base = { ...DEFAULT_ROLE_PERMS.member };
    for (const p of PERMISSIONS) {
      if (typeof customPerms[p.key] === "boolean") base[p.key] = customPerms[p.key] as boolean;
    }
    return base;
  }
  return DEFAULT_ROLE_PERMS[role] ?? DEFAULT_ROLE_PERMS.member;
}

export function can(perm: PermKey, role: string, customPerms?: Record<string, boolean> | null): boolean {
  return !!effectivePerms(role, customPerms)[perm];
}

/* ---------- spam / similitud ---------- */
export function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(s: string): Set<string> {
  const set = new Set<string>();
  const t = ` ${s} `;
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

export function similarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const A = bigrams(na);
  const B = bigrams(nb);
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

export function isSpam(newMsg: string, recent: { content: string; at: number }[], windowSec: number): boolean {
  const now = Date.now();
  const n = normalizeText(newMsg);
  if (n.length < 3) return false;
  for (const r of recent) {
    if (now - r.at > windowSec * 1000) continue;
    if (similarity(newMsg, r.content) >= 0.78) return true;
  }
  return false;
}

export function containsLink(s: string): boolean {
  return /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|mx|org|net|io|app|dev|store|site|online)\b)/i.test(s || "");
}

export function containsMention(s: string): boolean {
  return /@[\p{L}0-9_]{2,}/u.test(s || "");
}

export function makeInvite(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function timeAgo(iso: string | Date | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  const d = Date.now() - t;
  if (d < 60_000) return "ahora";
  if (d < 3_600_000) return `hace ${Math.floor(d / 60_000)} min`;
  if (d < 86_400_000) return `hace ${Math.floor(d / 3_600_000)} h`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function fmtTime(iso: string | Date | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export const STICKERS = ["😎", "🔥", "💜", "🛡️", "🚀", "😂", "🥳", "😱", "🤖", "👻", "💀", "🌈", "⚡", "🎉", "❤️", "👍"];

export const AVATAR_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#14b8a6"];
export const COVER_COLORS = ["#0f172a", "#1e1b4b", "#082f49", "#052e16", "#451a03", "#3b0764", "#500724"];

export function initials(name: string): string {
  return (name || "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function parseIds(json: string | null): number[] {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}
