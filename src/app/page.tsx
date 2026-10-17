"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle, Compass, Users, User as UserIcon, Smartphone, Plus, Search, Send, Image as ImageIcon,
  Video, Mic, Paperclip, BarChart3, Smile, Lock, ShieldCheck, Eye, EyeOff, Download, Copy, Check,
  Crown, Shield, Star, X, ChevronLeft, Settings, UserPlus, LogOut, RefreshCw, Database, Camera,
  Globe, BellOff, Hammer, BadgeCheck, AlertTriangle, KeyRound, Skull, QrCode, FileText, AtSign,
  Megaphone, UsersRound, Hash, Zap, ChevronRight, Link2, Pencil, Trash2, Clock, Info,
} from "lucide-react";
import {
  PERMISSIONS, DEFAULT_ROLE_PERMS, ROLE_LABEL, effectivePerms, roleLevel,
  timeAgo, fmtTime, STICKERS, AVATAR_COLORS, COVER_COLORS, initials, parseIds,
  type PermKey,
} from "@/lib/messaging";

/* ================= tipos ================= */
type User = {
  id: number; username: string; displayName: string;
  avatarUrl: string | null; avatarColor: string; coverUrl: string | null; coverColor: string;
  bio: string; website: string | null; socials: string;
  allowScreenshot: boolean; allowDownload: boolean;
  hasPin?: boolean; hasMasterSecret?: boolean;
  chatsCount?: number; messagesCount?: number; createdAt?: string | null;
};
type Friend = { id: number; otherId: number; username: string; displayName: string; avatarColor: string; avatarUrl: string | null; status: string; outgoing: boolean };
type MediaItem = { id: number; ownerId: number; kind: string; title: string | null; url: string | null; visibility: string; allowedIds: string; allowDownload: boolean | null; locked?: boolean; createdAt: string | null };
type Chat = {
  id: number; type: string; title: string; description: string; avatarColor: string; creatorId: number;
  inviteCode: string | null; requireApproval: boolean; spamEnabled: boolean; spamWindow: number;
  membersCount?: number; pendingCount?: number; myStatus?: string | null; myRole?: string | null;
  peerName?: string; peerUsername?: string; peerAvatar?: string;
  lastMessage?: { content: string; kind: string; senderId: number; createdAt: string | null } | null;
  lastSenderName?: string | null; createdAt?: string | null;
};
type PollData = { id: number; question: string; options: string[]; counts: number[]; total: number; myVote: number | null };
type ChatMsg = {
  id: number; chatId: number; senderId: number; senderName: string; senderUsername: string; senderColor: string;
  kind: string; content: string; mediaUrl: string | null; mediaKind: string | null; replyTo: number | null;
  createdAt: string | null; poll: PollData | null;
};
type Member = {
  id: number; chatId: number; userId: number; role: string; customRoleId: number | null; status: string;
  mutedUntil: string | null; displayName: string; username: string; avatarColor: string;
  customRoleName: string | null; customLevel: number | null;
};
type CustomRole = { id: number; chatId: number; name: string; level: number; permissions: string };
type Privacy = { allowScreenshot: boolean; allowDownload: boolean; hasPin: boolean; hasMasterSecret: boolean; masterHint: string | null };

const TABS = [
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "explore", label: "Explorar", icon: Compass },
  { id: "contacts", label: "Amigos", icon: Users },
  { id: "profile", label: "Perfil", icon: UserIcon },
  { id: "android", label: "Android", icon: Smartphone },
] as const;
type TabId = (typeof TABS)[number]["id"];

/* ================= piezas ================= */
function Avatar({ name, color, url, size = 40 }: { name: string; color: string; url?: string | null; size?: number }) {
  if (url) {
    return <img src={url} alt={name} style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="grid shrink-0 place-items-center rounded-full font-black text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}>
      {initials(name)}
    </div>
  );
}

function RoleBadge({ role, customName }: { role: string; customName?: string | null }) {
  if (role === "founder") return <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/15 px-1.5 py-px text-[10px] font-bold text-amber-300"><Crown size={10} /> Fundador</span>;
  if (role === "admin") return <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-400/15 px-1.5 py-px text-[10px] font-bold text-sky-300"><Shield size={10} /> Admin</span>;
  if (role === "moderator") return <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-400/15 px-1.5 py-px text-[10px] font-bold text-emerald-300"><Star size={10} /> Mod</span>;
  if (role.startsWith("custom:")) return <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-400/15 px-1.5 py-px text-[10px] font-bold text-violet-300"><Zap size={10} /> {customName ?? "Personalizado"}</span>;
  return null;
}

function ChatTypeIcon({ type }: { type: string }) {
  if (type === "private") return <Lock size={13} className="text-emerald-300" />;
  if (type === "group") return <UsersRound size={13} className="text-sky-300" />;
  if (type === "public") return <Hash size={13} className="text-amber-300" />;
  return <Megaphone size={13} className="text-rose-300" />;
}

function CodeBlock({ code, title }: { code: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/50">
      <div className="flex items-center justify-between bg-white/5 px-3 py-1.5">
        <span className="text-[11px] font-bold text-slate-300">{title}</span>
        <button
          onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }}
          className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-bold text-white hover:bg-white/15"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="codebox max-h-64 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed text-emerald-200">{code}</pre>
    </div>
  );
}

function socialsOf(u: User): { label: string; value: string }[] {
  try {
    const s = JSON.parse(u.socials || "{}") as Record<string, string>;
    return Object.entries(s).filter(([, v]) => v && String(v).trim()).map(([k, v]) => ({ label: k, value: String(v) }));
  } catch { return []; }
}

/* ================= app ================= */
export default function WenageApp() {
  const [users, setUsers] = useState<User[]>([]);
  const [meId, setMeId] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [booted, setBooted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabId>("chats");
  const [toast, setToast] = useState<string | null>(null);

  const [chats, setChats] = useState<Chat[]>([]);
  const [pending, setPending] = useState<Chat[]>([]);
  const [explore, setExplore] = useState<Chat[]>([]);
  const [chatSearch, setChatSearch] = useState("");

  const [selChat, setSelChat] = useState<number | null>(null);
  const [chatInfo, setChatInfo] = useState<Chat | null>(null);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [chatLocked, setChatLocked] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [privacy, setPrivacy] = useState<Privacy | null>(null);
  const [chatSecrets, setChatSecrets] = useState<{ id: number; chatId: number; chatTitle: string; hint: string }[]>([]);

  const [composer, setComposer] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMsg | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState(["", ""]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [manageTab, setManageTab] = useState<"members" | "roles" | "settings" | "invite">("members");
  const [showProfileOf, setShowProfileOf] = useState<number | null>(null);
  const [profileMedia, setProfileMedia] = useState<MediaItem[]>([]);
  const [blurScreen, setBlurScreen] = useState(false);

  // crear chat
  const [ncType, setNcType] = useState("group");
  const [ncTitle, setNcTitle] = useState("");
  const [ncDesc, setNcDesc] = useState("");
  const [ncMembers, setNcMembers] = useState("");
  const [ncApproval, setNcApproval] = useState(true);
  // unirse con código
  const [joinCode, setJoinCode] = useState("");
  // registro
  const [regUser, setRegUser] = useState("");
  const [regName, setRegName] = useState("");
  // amigos
  const [addFriend, setAddFriend] = useState("");
  // perfil edición
  const [editMode, setEditMode] = useState(false);
  const [eName, setEName] = useState("");
  const [eBio, setEBio] = useState("");
  const [eWeb, setEWeb] = useState("");
  const [eSocials, setESocials] = useState("");
  const [eAvatarColor, setEAvatarColor] = useState(AVATAR_COLORS[0]);
  const [eCoverColor, setECoverColor] = useState(COVER_COLORS[0]);
  const [eAvatarUrl, setEAvatarUrl] = useState("");
  // multimedia
  const [mTitle, setMTitle] = useState("");
  const [mUrl, setMUrl] = useState("");
  const [mKind, setMKind] = useState("image");
  const [mVis, setMVis] = useState("public");
  const [mAllowed, setMAllowed] = useState("");
  // privacidad
  const [newPin, setNewPin] = useState("");
  const [masterWord, setMasterWord] = useState("");
  const [chatSecretWord, setChatSecretWord] = useState("");
  const [panicUser, setPanicUser] = useState("");
  const [panicWord, setPanicWord] = useState("");
  // roles
  const [nrName, setNrName] = useState("");
  const [nrLevel, setNrLevel] = useState(20);
  const [nrPerms, setNrPerms] = useState<Record<string, boolean>>({});
  // mute
  const [muteMins, setMuteMins] = useState(10);

  const me = useMemo(() => users.find((u) => u.id === meId) ?? null, [users, meId]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const msgEndRef = useRef<HTMLDivElement>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4200); };

  /* ---------- carga ---------- */
  const loadUsers = useCallback(async () => {
    const r = await fetch("/api/users").then((x) => x.json());
    setUsers(r.users ?? []);
    return r.users ?? [];
  }, []);

  const loadAll = useCallback(async (uid: number) => {
    const [ch, fr, md, pr] = await Promise.all([
      fetch(`/api/chats?userId=${uid}`).then((x) => x.json()),
      fetch(`/api/friends?userId=${uid}`).then((x) => x.json()),
      fetch(`/api/media?ownerId=${uid}&viewerId=${uid}`).then((x) => x.json()),
      fetch(`/api/privacy?userId=${uid}`).then((x) => x.json()),
    ]);
    setChats(ch.chats ?? []); setPending(ch.pending ?? []); setExplore(ch.explore ?? []);
    setFriends(fr.friends ?? []);
    setMedia(md.media ?? []);
    if (pr.settings) { setPrivacy(pr.settings); setChatSecrets(pr.chatSecrets ?? []); }
  }, []);

  const loadMessages = useCallback(async (chatId: number, uid: number) => {
    const r = await fetch(`/api/messages?chatId=${chatId}&userId=${uid}`).then((x) => x.json());
    if (r.locked) {
      setChatLocked(r.message); setMsgs([]); setChatInfo(r.chat ?? null); setMyRole(null);
    } else {
      setChatLocked(null); setMsgs(r.messages ?? []); setChatInfo(r.chat ?? null); setMyRole(r.myRole ?? null);
    }
    const m = await fetch(`/api/members?chatId=${chatId}`).then((x) => x.json());
    setMembers(m.members ?? []); setCustomRoles(m.customRoles ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list: User[] = await loadUsers();
      const saved = typeof window !== "undefined" ? Number(localStorage.getItem("wenage_user") || 0) : 0;
      if (saved && list.find((u) => u.id === saved)) {
        setMeId(saved);
        const full = await fetch(`/api/users?id=${saved}`).then((x) => x.json());
        if (full.user?.hasPin) { setLocked(true); }
        else { await loadAll(saved); }
      }
      setLoading(false); setBooted(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!meId || locked) return;
    loadMessages && selChat && loadMessages(selChat, meId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selChat]);

  // auto-refresh
  useEffect(() => {
    if (!meId || locked) return;
    const t = setInterval(async () => {
      try {
        const ch = await fetch(`/api/chats?userId=${meId}`).then((x) => x.json());
        setChats(ch.chats ?? []); setPending(ch.pending ?? []); setExplore(ch.explore ?? []);
        if (selChat) {
          const r = await fetch(`/api/messages?chatId=${selChat}&userId=${meId}`).then((x) => x.json());
          if (!r.locked) { setMsgs(r.messages ?? []); setMyRole(r.myRole ?? null); }
        }
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [meId, locked, selChat]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length, selChat]);

  // anti-captura: detectar PrintScreen / menú
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "PrintScreen" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p")) && me && !me.allowScreenshot) {
        e.preventDefault();
        setBlurScreen(true);
        showToast("Capturas desactivadas por tu ajuste de privacidad 🛡️");
        setTimeout(() => setBlurScreen(false), 2500);
      }
    };
    const onCtx = (e: MouseEvent) => {
      if (me && !me.allowScreenshot) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("contextmenu", onCtx);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("contextmenu", onCtx); };
  }, [me]);

  /* ---------- acciones ---------- */
  const login = async (uid: number) => {
    setMeId(uid);
    localStorage.setItem("wenage_user", String(uid));
    setPinInput("");
    const full = await fetch(`/api/users?id=${uid}`).then((x) => x.json());
    await loadUsers();
    if (full.user?.hasPin) setLocked(true);
    else { setLocked(false); await loadAll(uid); }
    setSelChat(null); setTab("chats");
  };

  const logout = () => {
    setMeId(null); setLocked(false); setSelChat(null);
    localStorage.removeItem("wenage_user");
    setChats([]); setFriends([]); setMedia([]);
  };

  const unlock = async () => {
    if (!meId) return;
    const r = await fetch("/api/privacy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify_pin", userId: meId, pin: pinInput }) }).then((x) => x.json());
    if (r.ok) { setLocked(false); setPinInput(""); await loadAll(meId); }
    else showToast(r.error ?? "PIN incorrecto");
  };

  const seed = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/seed-messaging", { method: "POST" }).then((x) => x.json());
      showToast(r.message ?? "Demo lista");
      await loadUsers();
    } catch { showToast("No se pudo cargar la demo"); }
    finally { setBusy(false); }
  };

  const register = async () => {
    if (!regUser.trim() || !regName.trim()) return showToast("Escribe @usuario y nombre.");
    setBusy(true);
    try {
      const r = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: regUser, displayName: regName, avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)] }) }).then((x) => x.json());
      if (r.error) return showToast(r.error);
      showToast(`Cuenta @${r.user.username} creada. ¡Bienvenido!`);
      setRegUser(""); setRegName("");
      const list = await loadUsers();
      const created = list.find((u: User) => u.username === r.user.username);
      if (created) login(created.id);
    } catch { showToast("Error al registrar"); }
    finally { setBusy(false); }
  };

  const sendMessage = async (kind = "text", extra: Record<string, unknown> = {}) => {
    if (!meId || !selChat) return;
    if (kind === "text" && !composer.trim()) return;
    try {
      const r = await fetch("/api/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: selChat, senderId: meId, kind, content: composer, replyTo: replyTo?.id ?? null, ...extra }),
      }).then((x) => x.json());
      if (r.panic) {
        showToast(r.message);
        setComposer(""); setReplyTo(null);
        await loadAll(meId);
        if (r.panic === "chat") { setSelChat(null); }
        return;
      }
      if (r.error) { showToast(r.error); return; }
      setComposer(""); setReplyTo(null); setShowAttach(false); setShowStickers(false);
      await loadMessages(selChat, meId);
      const ch = await fetch(`/api/chats?userId=${meId}`).then((x) => x.json());
      setChats(ch.chats ?? []); setPending(ch.pending ?? []); setExplore(ch.explore ?? []);
    } catch { showToast("No se pudo enviar"); }
  };

  const sendPoll = async () => {
    const opts = pollOpts.map((o) => o.trim()).filter(Boolean);
    if (!pollQ.trim() || opts.length < 2) return showToast("Pregunta + 2 opciones mínimo.");
    await sendMessage("poll", { question: pollQ.trim(), options: opts });
    setPollQ(""); setPollOpts(["", ""]); setShowPoll(false);
  };

  const vote = async (pollId: number, idx: number) => {
    if (!meId || !selChat) return;
    await fetch("/api/polls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pollId, userId: meId, optionIndex: idx }) });
    await loadMessages(selChat, meId);
  };

  const fileToDataUrl = (f: File): Promise<string> => new Promise((res, rej) => {
    if (f.size > 2.5 * 1024 * 1024) { rej(new Error("Archivo muy grande (máx 2.5 MB en demo). Usa un enlace.")); return; }
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("No se pudo leer"));
    r.readAsDataURL(f);
  });

  const attachFile = async (f: File, kind: string) => {
    try {
      const url = await fileToDataUrl(f);
      await sendMessage(kind, { mediaUrl: url, mediaKind: kind, content: composer || f.name });
    } catch (e) { showToast(e instanceof Error ? e.message : "Error de archivo"); }
  };

  const createChat = async () => {
    if (!meId) return;
    if (!ncTitle.trim()) return showToast("Ponle nombre al chat.");
    if (ncType === "private" && !ncMembers.trim()) return showToast("Chat privado: escribe 1 @usuario.");
    setBusy(true);
    try {
      const r = await fetch("/api/chats", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: meId, type: ncType, title: ncTitle.trim(), description: ncDesc.trim(), members: ncMembers.split(/[\s,]+/).filter(Boolean), requireApproval: ncApproval }),
      }).then((x) => x.json());
      if (r.error) { showToast(r.error + (r.chatId ? "" : "")); if (r.chatId) { setSelChat(r.chatId); setShowNewChat(false); } return; }
      showToast("Chat creado ✅");
      setShowNewChat(false); setNcTitle(""); setNcDesc(""); setNcMembers("");
      await loadAll(meId);
      setSelChat(r.chat.id);
    } catch { showToast("No se pudo crear"); }
    finally { setBusy(false); }
  };

  const memberAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!meId || !selChat) return;
    const r = await fetch("/api/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, chatId: selChat, actorId: meId, ...extra }) }).then((x) => x.json());
    if (r.error) showToast(r.error);
    else { if (r.message) showToast(r.message); await loadMessages(selChat, meId); await loadAll(meId); }
    return r;
  };

  const openProfile = async (uid: number) => {
    setShowProfileOf(uid);
    const r = await fetch(`/api/media?ownerId=${uid}&viewerId=${meId}`).then((x) => x.json());
    setProfileMedia(r.media ?? []);
  };

  const profileUser = showProfileOf ? userMap.get(showProfileOf) ?? null : null;

  const saveProfile = async () => {
    if (!meId) return;
    let socials: Record<string, string> = {};
    try { socials = eSocials ? JSON.parse(eSocials) : {}; } catch { return showToast("Redes sociales: JSON inválido. Ej: {\"instagram\":\"@tuuser\"}"); }
    const r = await fetch("/api/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: meId, displayName: eName, bio: eBio, website: eWeb, socials, avatarColor: eAvatarColor, coverColor: eCoverColor, avatarUrl: eAvatarUrl || null }) }).then((x) => x.json());
    if (r.error) return showToast(r.error);
    showToast("Perfil guardado ✅");
    setEditMode(false);
    await loadUsers();
  };

  const uploadMedia = async () => {
    if (!meId) return;
    if (!mUrl.trim()) return showToast("Pega un enlace o sube un archivo.");
    const r = await fetch("/api/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerId: meId, kind: mKind, title: mTitle, url: mUrl, visibility: mVis, allowedIds: mAllowed.split(/[\s,]+/).map((s) => users.find((u) => u.username === s.replace(/^@/, "").toLowerCase())?.id).filter(Boolean) }) }).then((x) => x.json());
    if (r.error) return showToast(r.error);
    showToast("Archivo publicado con privacidad: " + mVis);
    setMTitle(""); setMUrl(""); setMAllowed("");
    const md = await fetch(`/api/media?ownerId=${meId}&viewerId=${meId}`).then((x) => x.json());
    setMedia(md.media ?? []);
  };

  const setMediaVis = async (item: MediaItem, visibility: string) => {
    if (!meId) return;
    const r = await fetch("/api/media", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, ownerId: meId, visibility }) }).then((x) => x.json());
    if (r.error) return showToast(r.error);
    const md = await fetch(`/api/media?ownerId=${meId}&viewerId=${meId}`).then((x) => x.json());
    setMedia(md.media ?? []);
    showToast(`Visibilidad → ${visibility === "public" ? "público 🌍" : visibility === "private" ? "privado 🔒" : "solo elegidos 👥"}`);
  };

  const privacyAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!meId) return;
    const r = await fetch("/api/privacy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, userId: meId, ...extra }) }).then((x) => x.json());
    if (r.error) { showToast(r.error); return r; }
    if (r.message) showToast(r.message);
    await loadUsers();
    await loadAll(meId);
    return r;
  };

  /* ---------- filtros ---------- */
  const filteredChats = useMemo(() => {
    const q = chatSearch.toLowerCase().trim();
    if (!q) return chats;
    return chats.filter((c) => (c.peerName ?? c.title).toLowerCase().includes(q) || c.title.toLowerCase().includes(q));
  }, [chats, chatSearch]);

  const myPerms = useMemo(() => {
    const mem = members.find((m) => m.userId === meId);
    if (!mem) return null;
    let cp: Record<string, boolean> | null = null;
    if (mem.role.startsWith("custom:")) {
      const cr = customRoles.find((c) => c.id === mem.customRoleId);
      if (cr) { try { cp = JSON.parse(cr.permissions); } catch { cp = null; } }
    }
    return { perms: effectivePerms(mem.role, cp), level: roleLevel(mem.role, customRoles.find((c) => c.id === mem.customRoleId)?.level), isCreator: chatInfo?.creatorId === meId };
  }, [members, meId, customRoles, chatInfo]);

  const canPublishHere = useMemo(() => {
    if (!chatInfo || !myPerms) return false;
    if (chatInfo.type === "channel") return myPerms.isCreator || (myPerms.perms.publish && myPerms.level >= 70);
    return true;
  }, [chatInfo, myPerms]);

  const friendIds = useMemo(() => new Set(friends.filter((f) => f.status === "accepted").map((f) => f.otherId)), [friends]);

  /* ================= renders ================= */
  if (loading || !booted) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-2xl"><ShieldCheck size={30} /></div>
          <p className="font-black text-white">Wenage</p>
          <p className="mt-1 text-xs text-slate-400">Cifrando tu privacidad…</p>
        </div>
      </div>
    );
  }

  // ---- login ----
  if (!meId || !me) {
    return (
      <div className="min-h-screen bg-slate-950 chat-bg">
        <div className="mx-auto w-full max-w-md px-4 pb-10 pt-10">
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-[28px] bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-white shadow-[0_20px_60px_rgba(124,58,237,0.45)]">
              <ShieldCheck size={38} />
            </div>
            <h1 className="text-3xl font-black text-white">Wenage</h1>
            <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-slate-400">Mensajería para Android con privacidad total: tú decides quién ve, descarga y captura.</p>
          </div>

          {users.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-center anim-in">
              <Database size={28} className="mx-auto mb-2 text-indigo-400" />
              <p className="text-sm font-bold text-white">Empieza con la demo</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">5 usuarios, chats privado · grupal · público · canal, roles, encuesta, PIN <b>1234</b> en @valeria y palabras secretas de ejemplo.</p>
              <button onClick={seed} disabled={busy} className="mt-4 w-full rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-black text-white hover:bg-indigo-400 disabled:opacity-50">
                {busy ? "Cargando…" : "Cargar demo y entrar"}
              </button>
            </div>
          ) : (
            <>
              <p className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Entra como</p>
              <div className="space-y-2">
                {users.map((u) => (
                  <button key={u.id} onClick={() => login(u.id)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/90 p-3 text-left transition hover:border-indigo-400/50">
                    <Avatar name={u.displayName} color={u.avatarColor} url={u.avatarUrl} size={46} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">{u.displayName}</p>
                      <p className="truncate font-mono text-[11px] text-indigo-300">@{u.username}</p>
                    </div>
                    {u.hasPin && <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-300"><Lock size={10} /> PIN</span>}
                    {!u.allowScreenshot && <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] font-bold text-emerald-300"><EyeOff size={10} /> anti-captura</span>}
                    <ChevronRight size={16} className="text-slate-500" />
                  </button>
                ))}
              </div>
              <div className="mt-5 rounded-3xl border border-white/10 bg-slate-900/90 p-5">
                <p className="text-sm font-bold text-white">o crea tu cuenta</p>
                <div className="mt-3 space-y-2.5">
                  <input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Tu nombre (ej. Ana López)" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" />
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-white/10 px-2.5 py-2.5 text-sm font-bold text-slate-400">@</span>
                    <input value={regUser} onChange={(e) => setRegUser(e.target.value)} placeholder="usuario (ej. ana.lopez)" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" />
                  </div>
                  <button onClick={register} disabled={busy} className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
                    <UserPlus size={15} className="mr-1 inline" /> Crear y entrar
                  </button>
                  <button onClick={seed} disabled={busy} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10">
                    Recargar demo
                  </button>
                </div>
              </div>
            </>
          )}
          <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-600">Funciona en Android vía web + instalable como app.<br />Ve a la pestaña Android para generarla con Android Studio.</p>
        </div>
        {toast && <Toast msg={toast} />}
      </div>
    );
  }

  // ---- bloqueo PIN ----
  if (locked) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 px-4 chat-bg">
        <div className="w-full max-w-xs rounded-3xl border border-white/10 bg-slate-900/95 p-7 text-center sheet-in">
          <Avatar name={me.displayName} color={me.avatarColor} url={me.avatarUrl} size={72} />
          <p className="mt-3 text-base font-black text-white">{me.displayName}</p>
          <p className="font-mono text-xs text-indigo-300">@{me.username}</p>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400"><Lock size={13} /> App bloqueada con contraseña</p>
          <input
            type="password" inputMode="numeric" maxLength={6} value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
            placeholder="••••" autoFocus
            className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-center text-2xl font-black tracking-[0.5em] text-white outline-none focus:border-indigo-400"
          />
          <button onClick={unlock} className="mt-3 w-full rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-black text-white hover:bg-indigo-400">Desbloquear</button>
          <button onClick={logout} className="mt-2 w-full rounded-2xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300">Cambiar de cuenta</button>
          <p className="mt-3 text-[11px] text-slate-600">Demo: el PIN de @valeria es 1234</p>
        </div>
        {toast && <Toast msg={toast} />}
      </div>
    );
  }

  const unreadPending = pending.length;

  return (
    <div className={`mx-auto flex min-h-screen w-full max-w-md flex-col bg-slate-950 ${me && !me.allowScreenshot ? "no-select" : ""} ${blurScreen ? "[&_*]:!blur-[2px]" : ""}`}>
      {/* header Android */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex items-center gap-2.5 px-4 py-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><ShieldCheck size={18} /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-black text-white">Wenage</p>
            <p className="truncate text-[10.5px] text-slate-400">{me.displayName} · <span className="font-mono text-indigo-300">@{me.username}</span></p>
          </div>
          {!me.allowScreenshot && <span title="Anti-captura activo" className="rounded-full bg-emerald-400/15 p-1.5 text-emerald-300"><EyeOff size={14} /></span>}
          <button onClick={() => { setMeId(null); setTimeout(() => meId && loadUsers(), 0); openAccountSwitch(); }} className="rounded-full p-1.5 hover:bg-white/10" title="Cambiar cuenta">
            <Avatar name={me.displayName} color={me.avatarColor} url={me.avatarUrl} size={30} />
          </button>
          <button onClick={() => loadAll(meId)} className="rounded-full p-2 text-slate-400 hover:bg-white/10" title="Actualizar"><RefreshCw size={16} /></button>
          <button onClick={logout} className="rounded-full p-2 text-slate-400 hover:bg-white/10" title="Salir"><LogOut size={16} /></button>
        </div>
      </header>

      {toast && <Toast msg={toast} />}

      <main className="flex-1 px-3 pb-24 pt-3">
        {tab === "chats" && (
          <ChatsTab
            chats={filteredChats} pending={pending} search={chatSearch} setSearch={setChatSearch}
            onOpen={(id) => setSelChat(id)} onNew={() => setShowNewChat(true)}
            onApprove={async (c) => { await memberActionRaw(c.id, meId, c.myStatus === "invited" ? "accept_invite" : "join"); await loadAll(meId); }}
            onReject={async (c) => { setBusy(true); await fetch("/api/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject", chatId: c.id, actorId: c.creatorId, targetId: meId }) }); setBusy(false); await loadAll(meId); }}
          />
        )}
        {tab === "explore" && (
          <ExploreTab
            explore={explore} meId={meId} joinCode={joinCode} setJoinCode={setJoinCode}
            onJoin={async (chatId, code) => {
              const r = await fetch("/api/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", chatId, actorId: meId, code }) }).then((x) => x.json());
              showToast(r.message ?? r.error ?? "Listo");
              await loadAll(meId);
              if (!r.error && r.status !== "pending") setSelChat(chatId);
            }}
            onOpen={(id) => setSelChat(id)}
          />
        )}
        {tab === "contacts" && (
          <ContactsTab
            friends={friends} addFriend={addFriend} setAddFriend={setAddFriend}
            onAdd={async () => {
              if (!addFriend.trim()) return showToast("Escribe un @usuario.");
              const r = await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: meId, username: addFriend, action: "add" }) }).then((x) => x.json());
              showToast(r.message ?? r.error);
              if (!r.error) { setAddFriend(""); await loadAll(meId); }
            }}
            onRemove={async (fid) => {
              await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: meId, friendId: fid, action: "remove" }) });
              await loadAll(meId);
            }}
            onChat={async (fid) => {
              const r = await fetch("/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creatorId: meId, type: "private", title: "privado", members: [users.find((u) => u.id === fid)?.username ?? ""] }) }).then((x) => x.json());
              if (r.chatId || r.error?.includes("Ya tienes")) {
                await loadAll(meId);
                const ch = await fetch(`/api/chats?userId=${meId}`).then((x) => x.json());
                const found = (ch.chats ?? []).find((c: Chat) => c.type === "private" && (c.peerUsername === users.find((u) => u.id === fid)?.username));
                if (found) setSelChat(found.id);
                else showToast(r.error);
              } else if (r.chat) { await loadAll(meId); setSelChat(r.chat.id); }
              else showToast(r.error ?? "Error");
            }}
            onProfile={(id) => openProfile(id)}
          />
        )}
        {tab === "profile" && (
          <ProfileTab
            me={me} users={users} media={media} privacy={privacy} chatSecrets={chatSecrets} chats={chats} friends={friends}
            editMode={editMode} setEditMode={setEditMode}
            eName={eName} setEName={setEName} eBio={eBio} setEBio={setEBio} eWeb={eWeb} setEWeb={setEWeb}
            eSocials={eSocials} setESocials={setESocials} eAvatarColor={eAvatarColor} setEAvatarColor={setEAvatarColor}
            eCoverColor={eCoverColor} setECoverColor={setECoverColor} eAvatarUrl={eAvatarUrl} setEAvatarUrl={setEAvatarUrl}
            onStartEdit={() => { setEName(me.displayName); setEBio(me.bio); setEWeb(me.website ?? ""); setESocials(me.socials); setEAvatarColor(me.avatarColor); setECoverColor(me.coverColor); setEAvatarUrl(me.avatarUrl ?? ""); setEditMode(true); }}
            onSave={saveProfile}
            mTitle={mTitle} setMTitle={setMTitle} mUrl={mUrl} setMUrl={setMUrl} mKind={mKind} setMKind={setMKind}
            mVis={mVis} setMVis={setMVis} mAllowed={mAllowed} setMAllowed={setMAllowed}
            onUpload={uploadMedia}
            onFile={async (f) => { try { const url = await fileToDataUrl(f); setMUrl(url); if (f.type.startsWith("image")) setMKind("image"); else if (f.type.startsWith("video")) setMKind("video"); else if (f.type.startsWith("audio")) setMKind("audio"); else setMKind("file"); showToast("Archivo listo. Pon título y publica."); } catch (e) { showToast(e instanceof Error ? e.message : "Error"); } }}
            onVis={setMediaVis}
            onDeleteMedia={async (id) => { await fetch(`/api/media?id=${id}&ownerId=${meId}`, { method: "DELETE" }); const md = await fetch(`/api/media?ownerId=${meId}&viewerId=${meId}`).then((x) => x.json()); setMedia(md.media ?? []); }}
            newPin={newPin} setNewPin={setNewPin} masterWord={masterWord} setMasterWord={setMasterWord}
            chatSecretWord={chatSecretWord} setChatSecretWord={setChatSecretWord}
            panicUser={panicUser} setPanicUser={setPanicUser} panicWord={panicWord} setPanicWord={setPanicWord}
            onPrivacy={privacyAction}
            onPanic={async () => {
              const r = await fetch("/api/privacy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "panic_send", userId: meId, targetUsername: panicUser, word: panicWord }) }).then((x) => x.json());
              showToast(r.message ?? r.error);
              if (r.ok) { await loadAll(meId); setSelChat(null); }
            }}
          />
        )}
        {tab === "android" && <AndroidTab />}
      </main>

      {/* bottom nav Android */}
      {!selChat && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-slate-950/97 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto grid w-full max-w-md grid-cols-5">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold ${tab === t.id ? "text-indigo-300" : "text-slate-500"}`}>
                <t.icon size={21} />
                {t.label}
                {t.id === "chats" && unreadPending > 0 && <span className="absolute right-4 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">{unreadPending}</span>}
                {tab === t.id && <span className="h-1 w-8 rounded-full bg-indigo-400" />}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* ======== vista de chat ======== */}
      {selChat && (
        <ChatView
          chatId={selChat} me={me} meId={meId} userMap={userMap}
          chatInfo={chatInfo} msgs={msgs} lockedMsg={chatLocked} myRole={myRole}
          members={members} customRoles={customRoles} myPerms={myPerms} canPublish={canPublishHere}
          composer={composer} setComposer={setComposer} replyTo={replyTo} setReplyTo={setReplyTo}
          showAttach={showAttach} setShowAttach={setShowAttach} showStickers={showStickers} setShowStickers={setShowStickers}
          showPoll={showPoll} setShowPoll={setShowPoll} pollQ={pollQ} setPollQ={setPollQ} pollOpts={pollOpts} setPollOpts={setPollOpts}
          onBack={() => { setSelChat(null); setMsgs([]); setChatInfo(null); }}
          onSend={() => sendMessage("text")} onPoll={sendPoll} onVote={vote}
          onSticker={(s) => sendMessage("sticker", { content: s })}
          onFile={(f, k) => attachFile(f, k)}
          onUrlMedia={(url, k) => sendMessage(k, { mediaUrl: url, mediaKind: k, content: composer || "archivo" })}
          onOpenProfile={(id) => openProfile(id)}
          onManage={() => { setManageTab("members"); setShowManage(true); }}
          onLeave={async () => { const r = await memberAction("leave"); if (!r?.error) setSelChat(null); }}
          msgEndRef={msgEndRef}
        />
      )}

      {/* ======== modales ======== */}
      {showNewChat && (
        <Sheet onClose={() => setShowNewChat(false)} title="Nuevo chat">
          <div className="grid grid-cols-4 gap-1.5">
            {( [["private", "Privado", Lock], ["group", "Grupal", UsersRound], ["public", "Público", Hash], ["channel", "Canal", Megaphone]] as [string, string, typeof Lock][] ).map(([v, l, I]) => {
              const Icon = I;
              return (
                <button key={v} onClick={() => setNcType(v)} className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-[11px] font-bold ${ncType === v ? "border-indigo-400 bg-indigo-500/15 text-white" : "border-white/10 bg-white/5 text-slate-300"}`}>
                  <Icon size={17} /> {l}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            {ncType === "private" && "1 a 1, solo ustedes dos. Escribe 1 @usuario."}
            {ncType === "group" && "Se entra con aprobación (nadie ve mensajes hasta ser aceptado). Anti-spam + roles."}
            {ncType === "public" && "Todos pueden LEER sin unirse. Para escribir hay que unirse."}
            {ncType === "channel" && "Solo administradores publican. Ideal para anuncios."}
          </p>
          <input value={ncTitle} onChange={(e) => setNcTitle(e.target.value)} placeholder={ncType === "private" ? "Se genera solo" : "Nombre (ej. Vecinos Norte)"} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" />
          {ncType !== "private" && <input value={ncDesc} onChange={(e) => setNcDesc(e.target.value)} placeholder="Descripción (opcional)" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" />}
          <input value={ncMembers} onChange={(e) => setNcMembers(e.target.value)} placeholder="@usuarios separados por espacio (ej. @diego @sofia)" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-[13px] text-white outline-none placeholder:font-sans placeholder:text-slate-600 focus:border-indigo-400" />
          {ncType === "group" && (
            <label className="mt-2 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 text-[13px] text-slate-200">
              <span>Requerir aprobación para entrar</span>
              <input type="checkbox" checked={ncApproval} onChange={(e) => setNcApproval(e.target.checked)} className="h-5 w-5 accent-indigo-500" />
            </label>
          )}
          <button onClick={createChat} disabled={busy} className="mt-3 w-full rounded-xl bg-indigo-500 px-4 py-3 text-sm font-black text-white hover:bg-indigo-400 disabled:opacity-50">Crear chat</button>
        </Sheet>
      )}

      {showManage && chatInfo && (
        <ManageSheet
          chat={chatInfo} members={members} customRoles={customRoles} meId={meId}
          manageTab={manageTab} setManageTab={setManageTab}
          nrName={nrName} setNrName={setNrName} nrLevel={nrLevel} setNrLevel={setNrLevel} nrPerms={nrPerms} setNrPerms={setNrPerms}
          muteMins={muteMins} setMuteMins={setMuteMins}
          onClose={() => setShowManage(false)}
          onAction={memberAction}
        />
      )}

      {showProfileOf && profileUser && (
        <ProfileSheet
          user={profileUser} media={profileMedia} viewerId={meId} users={users}
          onClose={() => setShowProfileOf(null)}
          onChat={async (uid) => {
            setShowProfileOf(null);
            const uname = users.find((u) => u.id === uid)?.username ?? "";
            const r = await fetch("/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creatorId: meId, type: "private", title: "x", members: [uname] }) }).then((x) => x.json());
            await loadAll(meId);
            if (r.chat) setSelChat(r.chat.id);
            else if (r.chatId) setSelChat(r.chatId);
            else showToast(r.error ?? "No se pudo abrir");
          }}
        />
      )}

      {showPoll && (
        <Sheet onClose={() => setShowPoll(false)} title="Crear encuesta">
          <input value={pollQ} onChange={(e) => setPollQ(e.target.value)} placeholder="Pregunta (ej. ¿Salimos el sábado?)" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" />
          {pollOpts.map((o, i) => (
            <div key={i} className="mt-2 flex gap-2">
              <input value={o} onChange={(e) => setPollOpts(pollOpts.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Opción ${i + 1}`} className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" />
              {pollOpts.length > 2 && <button onClick={() => setPollOpts(pollOpts.filter((_, j) => j !== i))} className="rounded-xl bg-white/10 px-3 text-slate-300"><X size={15} /></button>}
            </div>
          ))}
          {pollOpts.length < 6 && <button onClick={() => setPollOpts([...pollOpts, ""])} className="mt-2 text-xs font-bold text-indigo-300">+ agregar opción</button>}
          <button onClick={sendPoll} className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950">Publicar encuesta</button>
        </Sheet>
      )}
    </div>
  );

  async function memberActionRaw(chatId: number, actorId: number, action: string) {
    const r = await fetch("/api/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, chatId, actorId }) }).then((x) => x.json());
    showToast(r.message ?? r.error ?? "Listo");
  }
  function openAccountSwitch() {
    logout();
  }
}

/* ================= sub-vistas ================= */
function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed bottom-20 left-1/2 z-[70] w-[min(92vw,420px)] -translate-x-1/2 anim-in">
      <div className="rounded-2xl border border-indigo-400/30 bg-slate-900/97 p-3.5 text-center text-[13px] font-medium leading-snug text-slate-100 shadow-2xl">{msg}</div>
    </div>
  );
}

function Sheet({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-end bg-black/70 sm:place-items-center" onClick={onClose}>
      <div className="sheet-in max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[15px] font-black text-white">{title}</p>
          <button onClick={onClose} className="rounded-full bg-white/10 p-1.5 text-slate-300"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ChatsTab({ chats, pending, search, setSearch, onOpen, onNew, onApprove, onReject }: {
  chats: Chat[]; pending: Chat[]; search: string; setSearch: (v: string) => void;
  onOpen: (id: number) => void; onNew: () => void;
  onApprove: (c: Chat) => void; onReject: (c: Chat) => void;
}) {
  return (
    <div className="anim-in">
      <div className="mb-2 flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar chats…" className="w-full rounded-2xl border border-white/10 bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" />
        </div>
        <button onClick={onNew} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-500 text-white shadow-lg hover:bg-indigo-400"><Plus size={20} /></button>
      </div>

      {pending.length > 0 && (
        <div className="mb-3 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider text-amber-300"><Clock size={13} /> Solicitudes ({pending.length}) · acepta para ver mensajes</p>
          {pending.map((c) => (
            <div key={c.id} className="mb-1.5 flex items-center gap-2 rounded-xl bg-slate-950/70 p-2.5">
              <Avatar name={c.title} color={c.avatarColor} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-white">{c.title}</p>
                <p className="text-[11px] text-slate-400">{c.myStatus === "invited" ? "Te invitaron 🎟️" : "Pendiente de aprobación"}</p>
              </div>
              <button onClick={() => onApprove(c)} className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] font-black text-slate-950">Aceptar</button>
              {c.myStatus === "pending" && <button onClick={() => onReject(c)} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-slate-300">Salir</button>}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {chats.map((c) => (
          <button key={c.id} onClick={() => onOpen(c.id)} className="flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-slate-900/80 p-3 text-left transition hover:border-indigo-400/40">
            <div className="relative">
              <Avatar name={c.peerName ?? c.title} color={c.peerAvatar ?? c.avatarColor} size={50} />
              <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-slate-950 bg-slate-800"><ChatTypeIcon type={c.type} /></span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-[14px] font-bold text-white">{c.peerName ?? c.title}</p>
                {c.lastMessage && <span className="shrink-0 text-[10.5px] text-slate-500">{fmtTime(c.lastMessage.createdAt)}</span>}
              </div>
              <p className="truncate text-[12px] text-slate-400">
                {c.lastMessage ? `${c.lastMessage.kind === "text" ? c.lastMessage.content : c.lastMessage.kind === "poll" ? "📊 " + c.lastMessage.content : c.lastMessage.kind === "sticker" ? c.lastMessage.content + " (sticker)" : "📎 " + c.lastMessage.kind}` : c.description || "Sin mensajes"}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-slate-500">
                <span className="rounded bg-white/10 px-1.5 py-px font-bold">{c.type === "private" ? "privado" : c.type === "group" ? "grupo" : c.type === "public" ? "público" : "canal"}</span>
                <span>{c.membersCount ?? 0} miembros</span>
                {(c.pendingCount ?? 0) > 0 && <span className="rounded bg-amber-400/15 px-1.5 py-px font-bold text-amber-300">{c.pendingCount} pendientes</span>}
              </div>
            </div>
          </button>
        ))}
        {chats.length === 0 && <p className="py-10 text-center text-[13px] text-slate-500">Sin chats. Toca + para crear uno o explora los públicos.</p>}
      </div>
    </div>
  );
}

function ExploreTab({ explore, meId, joinCode, setJoinCode, onJoin, onOpen }: {
  explore: Chat[]; meId: number; joinCode: string; setJoinCode: (v: string) => void;
  onJoin: (chatId: number, code?: string) => void; onOpen: (id: number) => void;
}) {
  void meId;
  return (
    <div className="anim-in">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <p className="flex items-center gap-1.5 text-sm font-black text-white"><QrCode size={15} className="text-indigo-300" /> Entrar con código</p>
        <div className="mt-2 flex gap-2">
          <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Ej. GUARD1" className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-sm uppercase text-white outline-none placeholder:font-sans placeholder:text-slate-600 focus:border-indigo-400" />
          <button
            onClick={async () => {
              if (!joinCode.trim()) return;
              const all = await fetch(`/api/chats?userId=${meId}`).then((x) => x.json());
              const found = [...(all.chats ?? []), ...(all.pending ?? []), ...(all.explore ?? [])].find((c: Chat) => c.inviteCode === joinCode.trim().toUpperCase());
              if (!found) { alert("Código no encontrado"); return; }
              onJoin(found.id, joinCode.trim());
            }}
            className="rounded-xl bg-indigo-500 px-4 py-2.5 text-[13px] font-black text-white"
          >
            Entrar
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">Los grupos piden aprobación: verás mensajes solo al ser aceptado.</p>
      </div>

      <p className="mb-2 mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Públicos y canales · leer sin unirse</p>
      <div className="space-y-2">
        {explore.map((c) => (
          <div key={c.id} className="rounded-2xl border border-white/10 bg-slate-900/80 p-3.5">
            <div className="flex items-center gap-2.5">
              <Avatar name={c.title} color={c.avatarColor} size={44} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[14px] font-bold text-white"><ChatTypeIcon type={c.type} /> {c.title}</p>
                <p className="truncate text-[12px] text-slate-400">{c.description}</p>
                <p className="text-[11px] text-slate-500">{c.membersCount ?? 0} miembros · código {c.inviteCode}</p>
              </div>
            </div>
            {c.lastMessage && (
              <button onClick={() => onOpen(c.id)} className="mt-2 w-full rounded-xl bg-white/5 p-2.5 text-left text-[12px] text-slate-300 hover:bg-white/10">
                <span className="text-slate-500">Vista previa:</span> {c.lastMessage.kind === "text" ? c.lastMessage.content.slice(0, 90) : `📎 ${c.lastMessage.kind}`}
              </button>
            )}
            <button onClick={() => onJoin(c.id)} className="mt-2 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-[13px] font-black text-slate-950">Unirme {c.type === "channel" ? "al canal" : ""}</button>
          </div>
        ))}
        {explore.length === 0 && <p className="py-8 text-center text-[13px] text-slate-500">Ya estás en todos los públicos. ¡Crea el tuyo con +!</p>}
      </div>
    </div>
  );
}

function ContactsTab({ friends, addFriend, setAddFriend, onAdd, onRemove, onChat, onProfile }: {
  friends: Friend[]; addFriend: string; setAddFriend: (v: string) => void;
  onAdd: () => void; onRemove: (fid: number) => void; onChat: (fid: number) => void; onProfile: (id: number) => void;
}) {
  const ok = friends.filter((f) => f.status === "accepted");
  const blocked = friends.filter((f) => f.status === "blocked");
  return (
    <div className="anim-in">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <p className="text-sm font-black text-white">Agregar amigo</p>
        <div className="mt-2 flex gap-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950 px-3">
            <AtSign size={14} className="text-slate-500" />
            <input value={addFriend} onChange={(e) => setAddFriend(e.target.value)} placeholder="usuario (ej. diego)" className="w-full bg-transparent py-2.5 font-mono text-sm text-white outline-none placeholder:font-sans placeholder:text-slate-600" />
          </div>
          <button onClick={onAdd} className="rounded-xl bg-indigo-500 px-4 text-[13px] font-black text-white"><UserPlus size={15} /></button>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">Tus archivos “solo elegidos” solo los verán estos amigos.</p>
      </div>
      <p className="mb-2 mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Amigos ({ok.length})</p>
      <div className="space-y-1.5">
        {ok.map((f) => (
          <div key={f.id} className="flex items-center gap-2.5 rounded-2xl border border-white/5 bg-slate-900/80 p-2.5">
            <button onClick={() => onProfile(f.otherId)}><Avatar name={f.displayName} color={f.avatarColor} url={f.avatarUrl} size={44} /></button>
            <button onClick={() => onProfile(f.otherId)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-[13.5px] font-bold text-white">{f.displayName}</p>
              <p className="font-mono text-[11px] text-indigo-300">@{f.username}</p>
            </button>
            <button onClick={() => onChat(f.otherId)} className="rounded-xl bg-emerald-500 p-2.5 text-slate-950" title="Chatear"><MessageCircle size={15} /></button>
            <button onClick={() => onRemove(f.otherId)} className="rounded-xl bg-white/10 p-2.5 text-slate-400" title="Eliminar"><Trash2 size={15} /></button>
          </div>
        ))}
        {ok.length === 0 && <p className="py-6 text-center text-[13px] text-slate-500">Sin amigos aún. Agrega por @usuario.</p>}
      </div>
      {blocked.length > 0 && (
        <>
          <p className="mb-2 mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Bloqueados ({blocked.length})</p>
          {blocked.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-xl bg-white/[0.03] p-2.5 text-[12px] text-slate-400">
              <Ban /> @{f.username}
              <button onClick={() => onRemove(f.otherId)} className="ml-auto text-[11px] font-bold text-indigo-300">Desbloquear</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
  function Ban() { return <span className="grid h-8 w-8 place-items-center rounded-full bg-red-500/15 text-red-300 font-black">⊘</span>; }
}

/* ---------- perfil ---------- */
function ProfileTab(props: {
  me: User; users: User[]; media: MediaItem[]; privacy: Privacy | null;
  chatSecrets: { id: number; chatId: number; chatTitle: string; hint: string }[];
  chats: Chat[]; friends: Friend[];
  editMode: boolean; setEditMode: (v: boolean) => void;
  eName: string; setEName: (v: string) => void; eBio: string; setEBio: (v: string) => void;
  eWeb: string; setEWeb: (v: string) => void; eSocials: string; setESocials: (v: string) => void;
  eAvatarColor: string; setEAvatarColor: (v: string) => void; eCoverColor: string; setECoverColor: (v: string) => void;
  eAvatarUrl: string; setEAvatarUrl: (v: string) => void;
  onStartEdit: () => void; onSave: () => void;
  mTitle: string; setMTitle: (v: string) => void; mUrl: string; setMUrl: (v: string) => void;
  mKind: string; setMKind: (v: string) => void; mVis: string; setMVis: (v: string) => void;
  mAllowed: string; setMAllowed: (v: string) => void;
  onUpload: () => void; onFile: (f: File) => void;
  onVis: (item: MediaItem, v: string) => void; onDeleteMedia: (id: number) => void;
  newPin: string; setNewPin: (v: string) => void; masterWord: string; setMasterWord: (v: string) => void;
  chatSecretWord: string; setChatSecretWord: (v: string) => void;
  panicUser: string; setPanicUser: (v: string) => void; panicWord: string; setPanicWord: (v: string) => void;
  onPrivacy: (a: string, e?: Record<string, unknown>) => Promise<unknown>; onPanic: () => void;
}) {
  const { me } = props;
  const [tab, setTab] = useState<"perfil" | "archivos" | "privacidad">("perfil");
  return (
    <div className="anim-in">
      {/* portada */}
      <div className="overflow-hidden rounded-3xl border border-white/10">
        <div className="relative h-28" style={{ background: `linear-gradient(135deg, ${me.coverColor}, #000)` }}>
          <div className="absolute inset-0 chat-bg opacity-60" />
          {me.coverUrl && <img src={me.coverUrl} className="absolute inset-0 h-full w-full object-cover" alt="portada" />}
        </div>
        <div className="bg-slate-900/90 px-4 pb-4">
          <div className="-mt-8 mb-2 flex items-end justify-between">
            <div className="rounded-full border-4 border-slate-900"><Avatar name={me.displayName} color={me.avatarColor} url={me.avatarUrl} size={72} /></div>
            <button onClick={props.editMode ? props.onSave : props.onStartEdit} className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-3.5 py-2 text-[12px] font-black text-white">
              <Pencil size={13} /> {props.editMode ? "Guardar" : "Editar perfil"}
            </button>
          </div>
          {!props.editMode ? (
            <>
              <p className="text-lg font-black text-white">{me.displayName}</p>
              <p className="font-mono text-xs text-indigo-300">@{me.username}</p>
              {me.bio && <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">{me.bio}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
                {me.website && <a href={me.website.startsWith("http") ? me.website : `https://${me.website}`} target="_blank" className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-sky-300"><Globe size={11} /> {me.website}</a>}
                {socialsOf(me).map((s) => <span key={s.label} className="rounded-lg bg-white/10 px-2 py-1 text-slate-300"><b className="capitalize">{s.label}:</b> {s.value}</span>)}
              </div>
              <div className="mt-2.5 flex gap-3 text-[11.5px] text-slate-400">
                <span><b className="text-white">{props.chats.length}</b> chats</span>
                <span><b className="text-white">{props.friends.filter((f) => f.status === "accepted").length}</b> amigos</span>
                <span><b className="text-white">{props.media.length}</b> archivos</span>
              </div>
            </>
          ) : (
            <div className="space-y-2 pt-1">
              <input value={props.eName} onChange={(e) => props.setEName(e.target.value)} placeholder="Nombre" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400" />
              <div>
                <textarea value={props.eBio} onChange={(e) => props.setEBio(e.target.value.slice(0, 500))} rows={3} placeholder="Descripción (máx 500 caracteres)" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" />
                <p className={`text-right text-[11px] ${props.eBio.length >= 500 ? "text-rose-400" : "text-slate-500"}`}>{props.eBio.length}/500</p>
              </div>
              <input value={props.eWeb} onChange={(e) => props.setEWeb(e.target.value)} placeholder="Página web (ej. misitio.com)" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" />
              <input value={props.eSocials} onChange={(e) => props.setESocials(e.target.value)} placeholder='Redes en JSON: {"instagram":"@tu","tiktok":"@tu"}' className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white outline-none placeholder:font-sans placeholder:text-slate-600 focus:border-indigo-400" />
              <input value={props.eAvatarUrl} onChange={(e) => props.setEAvatarUrl(e.target.value)} placeholder="Foto de perfil (URL de imagen, opcional)" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" />
              <div>
                <p className="mb-1 text-[11px] font-bold text-slate-400">Color de avatar</p>
                <div className="flex gap-1.5">{AVATAR_COLORS.map((c) => <button key={c} onClick={() => props.setEAvatarColor(c)} style={{ background: c }} className={`h-8 w-8 rounded-full ${props.eAvatarColor === c ? "ring-2 ring-white" : ""}`} />)}</div>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold text-slate-400">Color de portada</p>
                <div className="flex gap-1.5">{COVER_COLORS.map((c) => <button key={c} onClick={() => props.setECoverColor(c)} style={{ background: c }} className={`h-8 w-14 rounded-lg ${props.eCoverColor === c ? "ring-2 ring-white" : ""}`} />)}</div>
              </div>
              <button onClick={() => props.setEditMode(false)} className="w-full rounded-xl border border-white/10 py-2.5 text-xs text-slate-400">Cancelar</button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-slate-900/80 p-1">
        {[["perfil", "Perfil"], ["archivos", "Archivos"], ["privacidad", "Privacidad"]].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v as typeof tab)} className={`rounded-xl py-2 text-[12px] font-black ${tab === v ? "bg-indigo-500 text-white" : "text-slate-400"}`}>{l}</button>
        ))}
      </div>

      {tab === "perfil" && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-[12.5px] leading-relaxed text-slate-300">
          <p className="flex items-center gap-1.5 font-black text-white"><Info size={14} className="text-indigo-300" /> Tu tarjeta pública</p>
          <p className="mt-1">Así te ven otros: foto, portada, descripción (máx 500), web y redes. Tus archivos se filtran según la privacidad que elijas en <b>Archivos</b>.</p>
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
            {!me.allowScreenshot ? <EyeOff size={15} className="shrink-0 text-emerald-300" /> : <Eye size={15} className="shrink-0 text-slate-400" />}
            <span>{me.allowScreenshot ? "Permites capturas de pantalla de tu contenido." : "BLOQUEAS capturas de tu contenido 🛡️ (se avisa e intenta impedir)."}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
            {!me.allowDownload ? <Download size={15} className="shrink-0 text-emerald-300" /> : <Download size={15} className="shrink-0 text-slate-400" />}
            <span>{me.allowDownload ? "Permites descargar tus archivos." : "BLOQUEAS la descarga de tus archivos ⛔."}</span>
          </div>
        </div>
      )}

      {tab === "archivos" && (
        <div className="mt-3 space-y-2.5">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
            <p className="flex items-center gap-1.5 text-sm font-black text-white"><Camera size={15} className="text-indigo-300" /> Subir multimedia</p>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {[["image", "Foto"], ["video", "Video"], ["audio", "Audio"], ["file", "Archivo"]].map(([v, l]) => (
                <button key={v} onClick={() => props.setMKind(v)} className={`rounded-lg border py-1.5 text-[11px] font-bold ${props.mKind === v ? "border-indigo-400 bg-indigo-500/20 text-white" : "border-white/10 text-slate-400"}`}>{l}</button>
              ))}
            </div>
            <input value={props.mTitle} onChange={(e) => props.setMTitle(e.target.value)} placeholder="Título (opcional)" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" />
            <input value={props.mUrl} onChange={(e) => props.setMUrl(e.target.value)} placeholder="Pega enlace (https://…) o sube archivo ↓" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white outline-none placeholder:font-sans placeholder:text-slate-600 focus:border-indigo-400" />
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-3 py-3 text-[12px] font-bold text-slate-300 hover:bg-white/[0.06]">
              <Paperclip size={14} /> Subir desde el teléfono
              <input type="file" className="hidden" accept={props.mKind === "image" ? "image/*" : props.mKind === "video" ? "video/*" : props.mKind === "audio" ? "audio/*" : "*/*"} onChange={(e) => e.target.files?.[0] && props.onFile(e.target.files[0])} />
            </label>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {[["public", "🌍 Público"], ["private", "🔒 Privado"], ["selected", "👥 Elegidos"]].map(([v, l]) => (
                <button key={v} onClick={() => props.setMVis(v)} className={`rounded-lg border py-2 text-[11px] font-bold ${props.mVis === v ? "border-indigo-400 bg-indigo-500/20 text-white" : "border-white/10 text-slate-400"}`}>{l}</button>
              ))}
            </div>
            {props.mVis === "selected" && <input value={props.mAllowed} onChange={(e) => props.setMAllowed(e.target.value)} placeholder="@amigos que sí pueden ver (ej. @diego @sofia)" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white outline-none placeholder:font-sans placeholder:text-slate-600 focus:border-indigo-400" />}
            <button onClick={props.onUpload} className="mt-2 w-full rounded-xl bg-indigo-500 px-4 py-2.5 text-[13px] font-black text-white">Publicar archivo</button>
          </div>

          {props.media.map((m) => (
            <div key={m.id} className="rounded-2xl border border-white/10 bg-slate-900/80 p-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${m.visibility === "public" ? "bg-emerald-400/15 text-emerald-300" : m.visibility === "private" ? "bg-rose-400/15 text-rose-300" : "bg-amber-400/15 text-amber-300"}`}>
                  {m.visibility === "public" ? "🌍 PÚBLICO" : m.visibility === "private" ? "🔒 PRIVADO" : "👥 ELEGIDOS"}
                </span>
                <span className="text-[11px] text-slate-500">{m.kind} · {timeAgo(m.createdAt)}</span>
                <button onClick={() => props.onDeleteMedia(m.id)} className="ml-auto rounded-lg bg-white/10 p-1.5 text-slate-400"><Trash2 size={13} /></button>
              </div>
              {m.title && <p className="mt-1 text-[13px] font-bold text-white">{m.title}</p>}
              {m.url && m.kind === "image" && <img src={m.url} className="mt-2 max-h-52 w-full rounded-xl object-cover" alt={m.title ?? ""} />}
              {m.url && m.kind === "video" && <video src={m.url} controls className="mt-2 w-full rounded-xl" />}
              {m.url && m.kind === "audio" && <audio src={m.url} controls className="mt-2 w-full" />}
              <div className="mt-2 flex gap-1">
                {["public", "private", "selected"].map((v) => (
                  <button key={v} onClick={() => props.onVis(m, v)} className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold ${m.visibility === v ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-300"}`}>
                    {v === "public" ? "Público" : v === "private" ? "Privado" : "Elegidos"}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {props.media.length === 0 && <p className="py-6 text-center text-[13px] text-slate-500">Sin archivos. Sube tu primera foto.</p>}
        </div>
      )}

      {tab === "privacidad" && (
        <PrivacyPanel {...props} />
      )}
    </div>
  );
}

function PrivacyPanel(props: {
  me: User; privacy: Privacy | null; chats: Chat[]; chatSecrets: { id: number; chatId: number; chatTitle: string; hint: string }[];
  newPin: string; setNewPin: (v: string) => void; masterWord: string; setMasterWord: (v: string) => void;
  chatSecretWord: string; setChatSecretWord: (v: string) => void;
  panicUser: string; setPanicUser: (v: string) => void; panicWord: string; setPanicWord: (v: string) => void;
  onPrivacy: (a: string, e?: Record<string, unknown>) => Promise<unknown>; onPanic: () => void;
}) {
  const { privacy, me } = props;
  const [chatSel, setChatSel] = useState("");
  return (
    <div className="mt-3 space-y-2.5">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <p className="flex items-center gap-1.5 text-sm font-black text-white"><ShieldCheck size={15} className="text-emerald-300" /> Capturas y descargas</p>
        <button onClick={() => props.onPrivacy("toggle_screenshot")} className="mt-2 flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 text-[13px] text-slate-200">
          <span className="flex items-center gap-2">{privacy?.allowScreenshot ? <Eye size={15} /> : <EyeOff size={15} />} Permitir captura de pantalla de mis archivos</span>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${privacy?.allowScreenshot ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}>{privacy?.allowScreenshot ? "SÍ" : "NO"}</span>
        </button>
        <button onClick={() => props.onPrivacy("toggle_download")} className="mt-1.5 flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 text-[13px] text-slate-200">
          <span className="flex items-center gap-2"><Download size={15} /> Permitir descarga de mis archivos</span>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${privacy?.allowDownload ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}>{privacy?.allowDownload ? "SÍ" : "NO"}</span>
        </button>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">Si lo desactivas, otros verán tus fotos pero sin botón de descarga, y la app bloquea el menú y advierte ante capturas.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <p className="flex items-center gap-1.5 text-sm font-black text-white"><KeyRound size={15} className="text-amber-300" /> Contraseña de la app {privacy?.hasPin && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-300">ACTIVA</span>}</p>
        <div className="mt-2 flex gap-2">
          <input value={props.newPin} onChange={(e) => props.setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder={privacy?.hasPin ? "Nuevo PIN o vacío para quitar" : "PIN 4-6 dígitos"} className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-center font-mono text-sm tracking-[0.3em] text-white outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-600 focus:border-amber-400" />
          <button onClick={async () => { await props.onPrivacy("set_pin", { pin: props.newPin }); props.setNewPin(""); }} className="rounded-xl bg-amber-400 px-4 text-[13px] font-black text-slate-950">Guardar</button>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">Se pedirá cada vez que abras la app en este dispositivo.</p>
      </div>

      <div className="rounded-2xl border border-rose-400/25 bg-rose-500/[0.06] p-4">
        <p className="flex items-center gap-1.5 text-sm font-black text-white"><Skull size={15} className="text-rose-300" /> Palabra secreta MAESTRA {privacy?.hasMasterSecret && <span className="rounded-full bg-rose-400/15 px-2 py-0.5 font-mono text-[10px] text-rose-300">{privacy.masterHint}</span>}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-300">Si <b>alguien la envía desde OTRA cuenta</b> en cualquier chat donde participes, <b className="text-rose-300">TODOS tus chats se eliminan por completo</b>. Úsala solo en emergencias.</p>
        <div className="mt-2 flex gap-2">
          <input value={props.masterWord} onChange={(e) => props.setMasterWord(e.target.value)} placeholder={privacy?.hasMasterSecret ? "Nueva palabra o vacío para quitar" : "Ej. FENIX TOTAL"} className="flex-1 rounded-xl border border-rose-400/30 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-rose-400" />
          <button onClick={async () => { await props.onPrivacy("set_master", { word: props.masterWord }); props.setMasterWord(""); }} className="rounded-xl bg-rose-500 px-4 text-[13px] font-black text-white">Guardar</button>
        </div>
      </div>

      <div className="rounded-2xl border border-orange-400/25 bg-orange-500/[0.06] p-4">
        <p className="flex items-center gap-1.5 text-sm font-black text-white"><BellOff size={15} className="text-orange-300" /> Palabra secreta POR CHAT</p>
        <p className="mt-1 text-[12px] text-slate-300">Igual que la maestra pero <b>solo elimina ESE chat</b>.</p>
        <select value={chatSel} onChange={(e) => setChatSel(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-[13px] text-white outline-none">
          <option value="">Elige chat…</option>
          {props.chats.map((c) => <option key={c.id} value={c.id}>{c.peerName ?? c.title}</option>)}
        </select>
        <div className="mt-2 flex gap-2">
          <input value={props.chatSecretWord} onChange={(e) => props.setChatSecretWord(e.target.value)} placeholder="Palabra para ese chat" className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-orange-400" />
          <button onClick={async () => { if (!chatSel) return; await props.onPrivacy("set_chat_secret", { chatId: Number(chatSel), word: props.chatSecretWord }); props.setChatSecretWord(""); }} className="rounded-xl bg-orange-500 px-4 text-[13px] font-black text-slate-950">Guardar</button>
        </div>
        {props.chatSecrets.length > 0 && (
          <div className="mt-2 space-y-1">
            {props.chatSecrets.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5 text-[12px] text-slate-300">
                <span>#{s.chatId} {s.chatTitle} · <span className="font-mono">{s.hint}</span></span>
                <button onClick={() => props.onPrivacy("set_chat_secret", { chatId: s.chatId, word: "" })} className="text-[11px] font-bold text-rose-300">Quitar</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <p className="flex items-center gap-1.5 text-sm font-black text-white"><Zap size={15} className="text-violet-300" /> Consola de pánico (probar borrado)</p>
        <p className="mt-1 text-[12px] text-slate-400">Simula enviar la palabra desde otra cuenta. Si coincide con la maestra o la del chat de ese usuario, se ejecuta el borrado real.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input value={props.panicUser} onChange={(e) => props.setPanicUser(e.target.value)} placeholder="@usuario dueño" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-[13px] text-white outline-none placeholder:font-sans placeholder:text-slate-600 focus:border-violet-400" />
          <input value={props.panicWord} onChange={(e) => props.setPanicWord(e.target.value)} placeholder="palabra secreta" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-slate-600 focus:border-violet-400" />
        </div>
        <button onClick={props.onPanic} className="mt-2 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-[13px] font-black text-white">Enviar palabra y ejecutar</button>
        <p className="mt-1.5 text-[11px] text-slate-600">@{me.username}: tu maestra demo es la que configures arriba.</p>
      </div>
    </div>
  );
}

/* ---------- ver perfil ajeno ---------- */
function ProfileSheet({ user, media, viewerId, users, onClose, onChat }: {
  user: User; media: MediaItem[]; viewerId: number | null; users: User[];
  onClose: () => void; onChat: (uid: number) => void;
}) {
  const owner = users.find((u) => u.id === user.id);
  const visible = media.filter((m) => !m.locked);
  const hidden = media.filter((m) => m.locked);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-end bg-black/70 sm:place-items-center" onClick={onClose}>
      <div className="sheet-in max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-32" style={{ background: `linear-gradient(135deg, ${user.coverColor}, #000)` }}>
          {user.coverUrl && <img src={user.coverUrl} className="absolute inset-0 h-full w-full object-cover" alt="" />}
          <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-black/50 p-1.5 text-white"><X size={16} /></button>
        </div>
        <div className="px-4 pb-4">
          <div className="-mt-8 mb-1 w-fit rounded-full border-4 border-slate-900"><Avatar name={user.displayName} color={user.avatarColor} url={user.avatarUrl} size={72} /></div>
          <p className="text-lg font-black text-white">{user.displayName}</p>
          <p className="font-mono text-xs text-indigo-300">@{user.username}</p>
          {user.bio && <p className="mt-1.5 text-[13px] text-slate-300">{user.bio}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
            {user.website && <span className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-sky-300"><Globe size={11} /> {user.website}</span>}
            {socialsOf(user).map((s) => <span key={s.label} className="rounded-lg bg-white/10 px-2 py-1 text-slate-300"><b className="capitalize">{s.label}:</b> {s.value}</span>)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px]">
            {!owner?.allowScreenshot && <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-1 font-bold text-emerald-300"><EyeOff size={10} /> Sin capturas</span>}
            {!owner?.allowDownload && <span className="flex items-center gap-1 rounded-full bg-rose-400/15 px-2 py-1 font-bold text-rose-300"><Download size={10} /> Sin descargas</span>}
          </div>
          {viewerId !== user.id && <button onClick={() => onChat(user.id)} className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-[13px] font-black text-slate-950">Chatear en privado</button>}

          <p className="mb-2 mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Multimedia ({visible.length} visibles)</p>
          <div className="grid grid-cols-2 gap-2">
            {visible.map((m) => (
              <div key={m.id} className="overflow-hidden rounded-xl border border-white/10 bg-slate-950">
                {m.kind === "image" && m.url && <img src={m.url} className="h-32 w-full object-cover" alt={m.title ?? ""} loading="lazy" />}
                {m.kind === "video" && m.url && <video src={m.url} controls className="h-32 w-full object-cover" />}
                {m.kind === "audio" && m.url && <div className="p-2"><audio src={m.url} controls className="w-full" /></div>}
                {m.kind === "file" && <div className="grid h-32 place-items-center text-slate-400"><FileText size={26} /></div>}
                <div className="p-2">
                  <p className="truncate text-[11px] font-bold text-white">{m.title ?? m.kind}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="rounded bg-white/10 px-1.5 py-px text-[9.5px] font-bold text-slate-300">{m.visibility === "public" ? "🌍 público" : m.visibility === "private" ? "🔒 privado" : "👥 elegidos"}</span>
                    {m.url && (m.allowDownload !== false && owner?.allowDownload !== false
                      ? <a href={m.url} download target="_blank" className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-300"><Download size={10} /> bajar</a>
                      : <span className="text-[10px] font-bold text-slate-600">⛔ sin descarga</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {hidden.length > 0 && (
            <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center text-[12px] text-slate-500">
              <Lock size={14} className="mx-auto mb-1" /> {hidden.length} archivo(s) {hidden[0]?.visibility === "private" ? "privados" : "solo para elegidos"}: no tienes acceso.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- vista de chat ---------- */
function ChatView(props: {
  chatId: number; me: User; meId: number; userMap: Map<number, User>;
  chatInfo: Chat | null; msgs: ChatMsg[]; lockedMsg: string | null; myRole: string | null;
  members: Member[]; customRoles: CustomRole[];
  myPerms: { perms: Record<PermKey, boolean>; level: number; isCreator: boolean } | null;
  canPublish: boolean;
  composer: string; setComposer: (v: string) => void;
  replyTo: ChatMsg | null; setReplyTo: (v: ChatMsg | null) => void;
  showAttach: boolean; setShowAttach: (v: boolean) => void;
  showStickers: boolean; setShowStickers: (v: boolean) => void;
  showPoll: boolean; setShowPoll: (v: boolean) => void;
  pollQ: string; setPollQ: (v: string) => void; pollOpts: string[]; setPollOpts: (v: string[]) => void;
  onBack: () => void; onSend: () => void; onPoll: () => void; onVote: (pollId: number, idx: number) => void;
  onSticker: (s: string) => void; onFile: (f: File, k: string) => void;
  onUrlMedia: (url: string, k: string) => void;
  onOpenProfile: (id: number) => void; onManage: () => void; onLeave: () => void;
  msgEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { chatInfo, meId, me } = props;
  const [urlBox, setUrlBox] = useState(false);
  const [urlKind, setUrlKind] = useState("image");
  const [urlVal, setUrlVal] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileKind, setFileKind] = useState("image");

  if (!chatInfo) return null;
  const isMuted = props.members.find((m) => m.userId === meId)?.status === "muted";

  const renderText = (t: string) => {
    const parts = t.split(/(@[\p{L}0-9_]{2,}|https?:\/\/[^\s]+)/gu);
    return parts.map((p, i) => {
      if (/^@[\p{L}0-9_]{2,}$/u.test(p)) return <span key={i} className="font-bold text-indigo-300">{p}</span>;
      if (/^https?:\/\//.test(p)) return <a key={i} href={p} target="_blank" className="break-all underline decoration-indigo-400">{p}</a>;
      return <span key={i}>{p}</span>;
    });
  };

  return (
    <div className="fixed inset-0 z-50 mx-auto flex w-full max-w-md flex-col bg-slate-950 chat-bg">
      {/* cabecera */}
      <div className="border-b border-white/10 bg-slate-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex items-center gap-2 px-2 py-2">
          <button onClick={props.onBack} className="rounded-full p-2 hover:bg-white/10"><ChevronLeft size={20} /></button>
          <Avatar name={chatInfo.peerName ?? chatInfo.title} color={chatInfo.peerAvatar ?? chatInfo.avatarColor} size={40} />
          <button onClick={props.onManage} className="min-w-0 flex-1 text-left">
            <p className="flex items-center gap-1.5 truncate text-[14px] font-black text-white"><ChatTypeIcon type={chatInfo.type} /> {chatInfo.peerName ?? chatInfo.title}</p>
            <p className="truncate text-[11px] text-slate-400">
              {chatInfo.type === "private" ? "privado · solo ustedes" : chatInfo.type === "channel" ? "canal · solo admins publican" : chatInfo.type === "public" ? "público · todos leen" : `${props.members.filter((m) => m.status === "member" || m.status === "muted").length} miembros${chatInfo.spamEnabled ? ` · anti-spam ${chatInfo.spamWindow}s` : ""}`}
            </p>
          </button>
          <button onClick={props.onManage} className="rounded-full p-2 text-slate-300 hover:bg-white/10"><Settings size={17} /></button>
        </div>
        {!me.allowScreenshot && (
          <p className="flex items-center justify-center gap-1.5 bg-emerald-500/10 px-2 py-1 text-center text-[10.5px] font-bold text-emerald-300"><EyeOff size={11} /> Tienes anti-captura activo: el menú está bloqueado</p>
        )}
      </div>

      {/* mensajes */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {props.lockedMsg ? (
          <div className="mx-auto mt-16 max-w-xs rounded-3xl border border-amber-400/25 bg-slate-900/90 p-6 text-center">
            <Lock size={30} className="mx-auto mb-2 text-amber-300" />
            <p className="text-sm font-black text-white">Aún no puedes ver los mensajes</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">{props.lockedMsg}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {props.msgs.map((m) => {
              if (m.kind === "system") return <p key={m.id} className="mx-auto w-fit max-w-[90%] rounded-full bg-white/10 px-3 py-1 text-center text-[11px] text-slate-300">{m.content}</p>;
              const mine = m.senderId === meId;
              const sender = props.userMap.get(m.senderId);
              const canDl = m.mediaUrl && sender?.allowDownload !== false;
              const reply = m.replyTo ? props.msgs.find((x) => x.id === m.replyTo) : null;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  {!mine && <button onClick={() => props.onOpenProfile(m.senderId)} className="mr-1.5 mt-1 self-start"><Avatar name={m.senderName} color={m.senderColor} size={30} /></button>}
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${mine ? "bubble-me text-white" : "bubble-other text-slate-100"}`}>
                    {!mine && <button onClick={() => props.onOpenProfile(m.senderId)} className="text-[11px] font-black text-indigo-300">{m.senderName} <span className="font-mono font-normal opacity-70">@{m.senderUsername}</span></button>}
                    {reply && <p className="mb-1 truncate rounded-lg bg-black/25 px-2 py-1 text-[11px] opacity-80">↩ {reply.content.slice(0, 60)}</p>}
                    {m.kind === "text" && <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">{renderText(m.content)}</p>}
                    {m.kind === "sticker" && <p className="text-4xl">{m.content}</p>}
                    {(m.kind === "image" || m.mediaKind === "image") && m.mediaUrl && (
                      <div>
                        {m.content && m.content !== m.mediaUrl && <p className="mb-1 text-[13px]">{renderText(m.content)}</p>}
                        <img src={m.mediaUrl} className="max-h-64 w-full rounded-xl object-cover" alt="" loading="lazy" />
                        {canDl ? <a href={m.mediaUrl} download target="_blank" className="mt-1 flex items-center gap-1 text-[11px] font-bold opacity-80"><Download size={11} /> Descargar</a> : <p className="mt-1 text-[11px] opacity-60">⛔ descarga bloqueada por el dueño</p>}
                      </div>
                    )}
                    {(m.kind === "video" || m.mediaKind === "video") && m.mediaUrl && (
                      <div>
                        {m.content && <p className="mb-1 text-[13px]">{m.content}</p>}
                        <video src={m.mediaUrl} controls className="max-h-64 w-full rounded-xl" />
                      </div>
                    )}
                    {(m.kind === "audio" || m.mediaKind === "audio") && m.mediaUrl && (
                      <div>
                        {m.content && <p className="mb-1 text-[13px]">{m.content}</p>}
                        <audio src={m.mediaUrl} controls className="w-full min-w-[200px]" />
                      </div>
                    )}
                    {(m.kind === "file" || m.mediaKind === "file") && m.mediaUrl && (
                      <div className="flex items-center gap-2">
                        <FileText size={22} />
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-bold">{m.content || "archivo"}</p>
                          {canDl ? <a href={m.mediaUrl} download target="_blank" className="flex items-center gap-1 text-[11px] font-bold text-emerald-300"><Download size={11} /> Descargar</a> : <p className="text-[11px] opacity-60">⛔ sin descarga</p>}
                        </div>
                      </div>
                    )}
                    {m.kind === "poll" && m.poll && (
                      <div className="min-w-[210px]">
                        <p className="flex items-center gap-1 text-[13px] font-black"><BarChart3 size={14} /> {m.poll.question}</p>
                        <div className="mt-1.5 space-y-1">
                          {m.poll.options.map((o, i) => {
                            const pct = m.poll!.total ? Math.round((m.poll!.counts[i] / m.poll!.total) * 100) : 0;
                            return (
                              <button key={i} onClick={() => props.onVote(m.poll!.id, i)} className={`relative w-full overflow-hidden rounded-lg border px-2 py-1.5 text-left text-[12px] ${m.poll!.myVote === i ? "border-emerald-300 bg-emerald-400/15 font-bold" : "border-white/15 bg-black/20"}`}>
                                <span className="absolute inset-y-0 left-0 bg-indigo-500/25" style={{ width: `${pct}%` }} />
                                <span className="relative flex justify-between gap-2"><span>{o}</span><span className="font-mono">{m.poll!.counts[i]} · {pct}%</span></span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-1 text-[10.5px] opacity-70">{m.poll.total} votos · toca para votar</p>
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-70">
                      <button onClick={() => props.setReplyTo(m)} className="font-bold">Responder</button>
                      <span>{fmtTime(m.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={props.msgEndRef} />
            {props.msgs.length === 0 && <p className="py-10 text-center text-[12px] text-slate-500">Sé el primero en escribir 👋</p>}
          </div>
        )}
      </div>

      {/* composer */}
      {!props.lockedMsg && (
        <div className="border-t border-white/10 bg-slate-950/95 px-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2">
          {!props.canPublish ? (
            <p className="rounded-xl bg-white/5 p-3 text-center text-[12px] text-slate-400">📢 Solo los administradores pueden publicar en este canal.</p>
          ) : isMuted ? (
            <p className="rounded-xl bg-amber-400/10 p-3 text-center text-[12px] font-bold text-amber-300"><BellOff size={13} className="mr-1 inline" /> Estás silenciado en este chat.</p>
          ) : (
            <>
              {props.replyTo && (
                <div className="mb-1.5 flex items-center justify-between rounded-xl bg-white/5 px-2.5 py-1.5 text-[11.5px] text-slate-300">
                  <span className="truncate">↩ {props.replyTo.content.slice(0, 70)}</span>
                  <button onClick={() => props.setReplyTo(null)}><X size={14} /></button>
                </div>
              )}
              {props.showStickers && (
                <div className="mb-1.5 grid grid-cols-8 gap-1 rounded-2xl border border-white/10 bg-slate-900 p-2">
                  {STICKERS.map((s) => <button key={s} onClick={() => props.onSticker(s)} className="rounded-lg p-1 text-2xl hover:bg-white/10">{s}</button>)}
                </div>
              )}
              {urlBox && (
                <div className="mb-1.5 rounded-2xl border border-white/10 bg-slate-900 p-2.5">
                  <div className="mb-1.5 flex gap-1">
                    {[["image", "Foto"], ["video", "Video"], ["audio", "Audio"], ["file", "Archivo"]].map(([v, l]) => (
                      <button key={v} onClick={() => setUrlKind(v)} className={`flex-1 rounded-lg py-1 text-[11px] font-bold ${urlKind === v ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-300"}`}>{l}</button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input value={urlVal} onChange={(e) => setUrlVal(e.target.value)} placeholder="https://… o data:" className="flex-1 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 font-mono text-xs text-white outline-none" />
                    <button onClick={() => { if (urlVal.trim()) { props.onUrlMedia(urlVal.trim(), urlKind); setUrlVal(""); setUrlBox(false); } }} className="rounded-lg bg-indigo-500 px-3 text-xs font-black text-white">OK</button>
                  </div>
                </div>
              )}
              <div className="flex items-end gap-1.5">
                <button onClick={() => { props.setShowAttach(!props.showAttach); props.setShowStickers(false); }} className={`rounded-full p-2.5 ${props.showAttach ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-300"}`}><Plus size={18} /></button>
                <div className="flex-1 rounded-3xl border border-white/10 bg-slate-900 px-3.5 py-1">
                  <input
                    value={props.composer} onChange={(e) => props.setComposer(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && props.onSend()}
                    placeholder="Escribe un mensaje…"
                    className="w-full bg-transparent py-2 text-[13.5px] text-white outline-none placeholder:text-slate-600"
                  />
                </div>
                <button onClick={() => props.setShowStickers(!props.showStickers)} className="rounded-full bg-white/10 p-2.5 text-slate-300"><Smile size={18} /></button>
                <button onClick={props.onSend} className="rounded-full bg-indigo-500 p-2.5 text-white shadow-lg"><Send size={18} /></button>
              </div>
              {props.showAttach && (
                <div className="mt-1.5 grid grid-cols-5 gap-1.5 anim-in">
                  {[
                    ["image", ImageIcon, "Foto"], ["video", Video, "Video"], ["audio", Mic, "Audio"], ["file", Paperclip, "Archivo"], ["poll", BarChart3, "Encuesta"],
                  ].map(([k, I, l]) => {
                    const Icon = I as typeof ImageIcon;
                    return (
                      <button
                        key={k as string}
                        onClick={() => {
                          if (k === "poll") { props.setShowPoll(true); props.setShowAttach(false); return; }
                          setFileKind(k as string); setUrlBox(false);
                          fileRef.current?.click();
                        }}
                        className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-slate-900 py-2.5 text-[10.5px] font-bold text-slate-200"
                      >
                        <Icon size={17} className="text-indigo-300" /> {l as string}
                      </button>
                    );
                  })}
                  <input ref={fileRef} type="file" className="hidden" accept={fileKind === "image" ? "image/*" : fileKind === "video" ? "video/*" : fileKind === "audio" ? "audio/*" : "*/*"} onChange={(e) => { const f = e.target.files?.[0]; if (f) props.onFile(f, fileKind); e.target.value = ""; props.setShowAttach(false); }} />
                </div>
              )}
              <button onClick={() => setUrlBox(!urlBox)} className="mt-1 flex items-center gap-1 text-[10.5px] text-slate-500"><Link2 size={10} /> o enviar por enlace URL</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- gestión de grupo ---------- */
function ManageSheet(props: {
  chat: Chat; members: Member[]; customRoles: CustomRole[]; meId: number;
  manageTab: "members" | "roles" | "settings" | "invite"; setManageTab: (v: "members" | "roles" | "settings" | "invite") => void;
  nrName: string; setNrName: (v: string) => void; nrLevel: number; setNrLevel: (v: number) => void;
  nrPerms: Record<string, boolean>; setNrPerms: (v: Record<string, boolean>) => void;
  muteMins: number; setMuteMins: (v: number) => void;
  onClose: () => void; onAction: (a: string, e?: Record<string, unknown>) => Promise<unknown>;
}) {
  const { chat, members, meId } = props;
  const me = members.find((m) => m.userId === meId);
  const customs = props.customRoles;
  const myLvl = me ? roleLevel(me.role, customs.find((c) => c.id === me.customRoleId)?.level) : 0;
  const isCreator = chat.creatorId === meId;
  let myCp: Record<string, boolean> | null = null;
  if (me?.role.startsWith("custom:")) { const cr = customs.find((c) => c.id === me.customRoleId); if (cr) { try { myCp = JSON.parse(cr.permissions); } catch {} } }
  const myP = me ? effectivePerms(me.role, myCp) : DEFAULT_ROLE_PERMS.member;

  const [sTitle, setSTitle] = useState(chat.title);
  const [sDesc, setSDesc] = useState(chat.description ?? "");
  const [sAppr, setSAppr] = useState(chat.requireApproval);
  const [sSpam, setSSpam] = useState(chat.spamEnabled);
  const [sWin, setSWin] = useState(chat.spamWindow);
  const [inviteUser, setInviteUser] = useState("");
  const [targetMute, setTargetMute] = useState<Member | null>(null);

  const pendings = members.filter((m) => m.status === "pending");
  const invited = members.filter((m) => m.status === "invited");
  const actives = members.filter((m) => m.status === "member" || m.status === "muted");

  return (
    <div className="fixed inset-0 z-[60] grid place-items-end bg-black/70 sm:place-items-center" onClick={props.onClose}>
      <div className="sheet-in max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[15px] font-black text-white"><Settings size={16} className="text-indigo-300" /> {chat.title}</p>
          <button onClick={props.onClose} className="rounded-full bg-white/10 p-1.5"><X size={16} /></button>
        </div>
        <p className="mb-2 font-mono text-[11px] text-slate-500">Código de invitación: <b className="text-amber-300">{chat.inviteCode}</b> · Tu rol: {me ? <RoleBadge role={me.role} customName={me.customRoleName} /> : "visitante"}</p>

        <div className="mb-3 grid grid-cols-4 gap-1 rounded-2xl bg-white/5 p-1">
          {[["members", "Miembros"], ["roles", "Roles"], ["settings", "Ajustes"], ["invite", "Invitar"]].map(([v, l]) => (
            <button key={v} onClick={() => props.setManageTab(v as typeof props.manageTab)} className={`rounded-xl py-2 text-[11px] font-black ${props.manageTab === v ? "bg-indigo-500 text-white" : "text-slate-400"}`}>{l}</button>
          ))}
        </div>

        {props.manageTab === "members" && (
          <div className="space-y-2">
            {pendings.length > 0 && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-2.5">
                <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-amber-300">⏳ Solicitudes: no ven mensajes hasta ser aceptados ({pendings.length})</p>
                {pendings.map((m) => (
                  <div key={m.id} className="mb-1 flex items-center gap-2 rounded-lg bg-slate-950/70 p-2">
                    <Avatar name={m.displayName} color={m.avatarColor} size={32} />
                    <div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-bold text-white">{m.displayName}</p><p className="font-mono text-[10.5px] text-slate-500">@{m.username}</p></div>
                    <button onClick={() => props.onAction("approve", { targetId: m.userId })} className="rounded-lg bg-emerald-500 px-2 py-1.5 text-[11px] font-black text-slate-950">Aceptar</button>
                    <button onClick={() => props.onAction("reject", { targetId: m.userId })} className="rounded-lg bg-white/10 px-2 py-1.5 text-[11px] font-bold text-slate-300">Rechazar</button>
                  </div>
                ))}
              </div>
            )}
            {invited.length > 0 && (
              <div className="rounded-xl border border-white/10 p-2.5">
                <p className="mb-1 text-[11px] font-bold text-slate-400">Invitados pendientes ({invited.length})</p>
                {invited.map((m) => <p key={m.id} className="text-[12px] text-slate-300">@{m.username} · {m.displayName}</p>)}
              </div>
            )}
            {actives.sort((a, b) => roleLevel(b.role, customs.find((c) => c.id === b.customRoleId)?.level) - roleLevel(a.role, customs.find((c) => c.id === a.customRoleId)?.level)).map((m) => {
              const lvl = roleLevel(m.role, customs.find((c) => c.id === m.customRoleId)?.level);
              const canMod = (isCreator || myP.manage_roles || myP.kick_lower || myP.mute_members) && m.userId !== meId && (isCreator || lvl < myLvl);
              return (
                <div key={m.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={m.displayName} color={m.avatarColor} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1 truncate text-[13px] font-bold text-white">{m.displayName} {m.userId === meId && <span className="text-[10px] text-slate-500">(tú)</span>}</p>
                      <div className="flex items-center gap-1"><RoleBadge role={m.role} customName={m.customRoleName} />{m.status === "muted" && <span className="rounded-full bg-amber-400/15 px-1.5 py-px text-[10px] font-bold text-amber-300">🔇 muteado</span>}</div>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">nv.{lvl}</span>
                  </div>
                  {canMod && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(myP.accept_members || isCreator || myLvl >= 70) && ["admin", "moderator", "member"].map((r) => (
                        <button key={r} onClick={() => props.onAction("set_role", { targetId: m.userId, role: r })} className={`rounded-lg px-2 py-1 text-[10.5px] font-bold ${m.role === r ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-300"}`}>{ROLE_LABEL[r]}</button>
                      ))}
                      {customs.map((cr) => (
                        <button key={cr.id} onClick={() => props.onAction("set_role", { targetId: m.userId, role: `custom:${cr.id}`, customRoleId: cr.id })} className={`rounded-lg px-2 py-1 text-[10.5px] font-bold ${m.customRoleId === cr.id ? "bg-violet-500 text-white" : "bg-white/10 text-slate-300"}`}>{cr.name}</button>
                      ))}
                      {(myP.kick_lower || isCreator) && <button onClick={() => props.onAction("kick", { targetId: m.userId })} className="flex items-center gap-0.5 rounded-lg bg-rose-500/15 px-2 py-1 text-[10.5px] font-bold text-rose-300"><Hammer size={10} /> Expulsar</button>}
                      {(myP.mute_members || isCreator) && (
                        m.status === "muted"
                          ? <button onClick={() => props.onAction("unmute", { targetId: m.userId })} className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[10.5px] font-bold text-emerald-300">Desmutear</button>
                          : <button onClick={() => setTargetMute(m)} className="flex items-center gap-0.5 rounded-lg bg-amber-500/15 px-2 py-1 text-[10.5px] font-bold text-amber-300"><BellOff size={10} /> Mutear</button>
                      )}
                    </div>
                  )}
                  {targetMute?.id === m.id && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-400/10 p-2">
                      <input type="number" min={1} max={1440} value={props.muteMins} onChange={(e) => props.setMuteMins(Number(e.target.value))} className="w-20 rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-[12px] text-white" />
                      <span className="text-[11px] text-slate-400">minutos</span>
                      <button onClick={() => { props.onAction("mute", { targetId: m.userId, minutes: props.muteMins }); setTargetMute(null); }} className="rounded-lg bg-amber-400 px-2.5 py-1.5 text-[11px] font-black text-slate-950">OK</button>
                      <button onClick={() => setTargetMute(null)} className="text-[11px] text-slate-400">cancelar</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {props.manageTab === "roles" && (
          <div className="space-y-2.5">
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
              <p className="mb-1.5 text-[12px] font-black text-white">Rangos del chat</p>
              {[["founder", "Fundador", 100], ["admin", "Administrador", 70], ["moderator", "Moderador", 40], ["member", "Miembro", 10]].map(([k, l, lv]) => (
                <div key={k as string} className="mb-1 flex items-center justify-between rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[12px]">
                  <span className="flex items-center gap-1.5 text-slate-200"><RoleBadge role={k as string} /> nivel {lv as number}</span>
                  <span className="text-[11px] text-slate-500">{members.filter((m) => m.role === k).length} personas</span>
                </div>
              ))}
              {customs.map((cr) => {
                let p: Record<string, boolean> = {};
                try { p = JSON.parse(cr.permissions); } catch {}
                const on = Object.values(p).filter(Boolean).length;
                return (
                  <div key={cr.id} className="mb-1 rounded-lg bg-violet-500/10 px-2.5 py-1.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-bold text-violet-200">{cr.name} <span className="font-mono text-[10px] text-violet-400">nv.{cr.level}</span></span>
                      <span className="text-[11px] text-slate-400">{on}/{PERMISSIONS.length} permisos</span>
                    </div>
                    {(myP.manage_roles || isCreator) && (
                      <button onClick={() => props.onAction("delete_role", { roleId: cr.id })} className="mt-1 text-[11px] font-bold text-rose-300">Eliminar rol (vuelven a miembro)</button>
                    )}
                  </div>
                );
              })}
            </div>
            {(myP.manage_roles || isCreator) ? (
              <div className="rounded-xl border border-violet-400/25 bg-violet-500/[0.07] p-3">
                <p className="text-[12px] font-black text-white">+ Crear rol personalizado</p>
                <div className="mt-2 flex gap-2">
                  <input value={props.nrName} onChange={(e) => props.setNrName(e.target.value)} placeholder="Nombre (ej. Curador)" className="flex-1 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-2 text-[13px] text-white outline-none" />
                  <div className="flex items-center gap-1 text-[12px] text-slate-300">nv. <input type="number" min={1} max={90} value={props.nrLevel} onChange={(e) => props.setNrLevel(Number(e.target.value))} className="w-14 rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-white" /></div>
                </div>
                <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                  {PERMISSIONS.map((p) => (
                    <label key={p.key} className="flex items-start gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[12px]">
                      <input type="checkbox" checked={!!props.nrPerms[p.key]} onChange={(e) => props.setNrPerms({ ...props.nrPerms, [p.key]: e.target.checked })} className="mt-0.5 h-4 w-4 accent-violet-500" />
                      <span><b className="text-slate-100">{p.label}</b> <span className="text-slate-500">· {p.desc}</span></span>
                    </label>
                  ))}
                </div>
                <button onClick={async () => { const r = await props.onAction("create_role", { name: props.nrName, level: props.nrLevel, permissions: props.nrPerms }) as { ok?: boolean }; if ((r as { ok?: boolean })?.ok) { props.setNrName(""); props.setNrPerms({}); } }} className="mt-2 w-full rounded-xl bg-violet-500 px-4 py-2.5 text-[13px] font-black text-white">Crear rol</button>
              </div>
            ) : (
              <p className="rounded-xl bg-white/5 p-3 text-[12px] text-slate-400">Tu rol no gestiona rangos. Pide a un admin.</p>
            )}
          </div>
        )}

        {props.manageTab === "settings" && (
          <div className="space-y-2">
            {(myP.customize_group || isCreator) ? (
              <>
                <input value={sTitle} onChange={(e) => setSTitle(e.target.value)} placeholder="Nombre" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none" />
                <textarea value={sDesc} onChange={(e) => setSDesc(e.target.value)} rows={2} placeholder="Descripción" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none" />
                <label className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 text-[13px] text-slate-200">
                  <span>Aprobar miembros (no ven mensajes hasta entrar)</span>
                  <input type="checkbox" checked={sAppr} onChange={(e) => setSAppr(e.target.checked)} className="h-5 w-5 accent-indigo-500" />
                </label>
                <div className="rounded-xl bg-white/5 p-3">
                  <label className="flex items-center justify-between text-[13px] text-slate-200">
                    <span className="flex items-center gap-1.5"><Shield size={14} className="text-emerald-300" /> Anti-SPAM (bloquea repetidos/similares)</span>
                    <input type="checkbox" checked={sSpam} onChange={(e) => setSSpam(e.target.checked)} className="h-5 w-5 accent-emerald-500" />
                  </label>
                  <div className="mt-2 flex items-center gap-2 text-[12px] text-slate-400">
                    <span>Ventana:</span>
                    <input type="range" min={10} max={600} step={10} value={sWin} onChange={(e) => setSWin(Number(e.target.value))} className="flex-1 accent-emerald-400" />
                    <b className="text-white">{sWin}s</b>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">Si alguien repite el mismo mensaje o muy parecido dentro de ese tiempo, se rechaza.</p>
                </div>
                <button onClick={() => props.onAction("settings", { title: sTitle, description: sDesc, requireApproval: sAppr, spamEnabled: sSpam, spamWindow: sWin })} className="w-full rounded-xl bg-indigo-500 px-4 py-2.5 text-[13px] font-black text-white">Guardar ajustes</button>
              </>
            ) : (
              <div className="rounded-xl bg-white/5 p-3 text-[12.5px] text-slate-300">
                <p><b className="text-white">{chat.title}</b></p>
                <p className="mt-1 text-slate-400">{chat.description || "Sin descripción"}</p>
                <p className="mt-1 text-slate-500">Anti-spam: {chat.spamEnabled ? `activo (${chat.spamWindow}s)` : "desactivado"} · Aprobación: {chat.requireApproval ? "sí" : "no"}</p>
                <p className="mt-1 text-slate-500">Tu rol no puede personalizar el grupo.</p>
              </div>
            )}
            <button onClick={() => props.onAction("leave")} className="w-full rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-[13px] font-bold text-rose-300">Salir del chat</button>
          </div>
        )}

        {props.manageTab === "invite" && (
          <div className="space-y-2">
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-amber-300">Código de invitación</p>
              <p className="mt-1 font-mono text-3xl font-black tracking-[0.2em] text-white">{chat.inviteCode}</p>
              <p className="mt-1 text-[11.5px] text-slate-400">Compártelo: en Explorar → “Entrar con código”.</p>
              {(myP.create_invite || isCreator) && (
                <button onClick={() => props.onAction("regen_invite")} className="mt-2 rounded-xl bg-white/10 px-3 py-2 text-[12px] font-bold text-white"><RefreshCw size={12} className="mr-1 inline" /> Regenerar</button>
              )}
            </div>
            <p className="text-[12px] font-black text-white">Invitar por @usuario</p>
            <div className="flex gap-2">
              <input value={inviteUser} onChange={(e) => setInviteUser(e.target.value)} placeholder="@usuario" className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-sm text-white outline-none" />
              <button onClick={() => props.onAction("invite", { username: inviteUser })} className="rounded-xl bg-emerald-500 px-4 text-[13px] font-black text-slate-950">Invitar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Android ---------- */
function AndroidTab() {
  const TWA_STEPS = `OPCIÓN 1 · PWA instalable (5 minutos, sin código)
1. Abre esta app en Chrome de tu Android.
2. Menú ⋮ → "Agregar a pantalla principal" o "Instalar app".
3. Acepta: queda con icono, pantalla completa y modo offline básico.
4. Fija el icono: mantén presionado → "Agregar a inicio".

OPCIÓN 2 · TWA con Android Studio (publicar en Play Store)
Requisitos: Android Studio + esta app publicada con HTTPS.
1. En Android Studio: New Project → "No Activity" → nombre Wenage, package com.tuempresa.wenage, minSdk 24.
2. Agrega al build.gradle (app):
   implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.5.0'
3. Crea activity TWA que abra tu URL + assetlinks.json en tu dominio:
   /.well-known/assetlinks.json con tu SHA-256 de firma.
4. Genera el AAB: Build → Generate Signed Bundle/APK → sube a Play Console.
(Opción guiada: usa Bubblewrap CLI: npx @bubblewrap/cli init --manifest https://TU-DOMINIO/manifest.webmanifest)

OPCIÓN 3 · WebView nativo (control total: bloquear capturas DE VERDAD)
Con WebView SÍ puedes usar FLAG_SECURE para impedir capturas del sistema:
  window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, ...)
Ver el código MainActivity.kt abajo: pégalo en tu proyecto.`;

  const MAIN_ACTIVITY = `// MainActivity.kt — WebView con bloqueo real de capturas (FLAG_SECURE)
package com.tuempresa.wenage

import android.os.Bundle
import android.webkit.*
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    // ⬇⬇ PON AQUÍ LA URL DE TU APP PUBLICADA ⬇⬇
    private val APP_URL = "https://TU-DOMINIO/"
    // Si el dueño desactiva capturas, esto lo bloquea A NIVEL SISTEMA:
    private val BLOCK_SYSTEM_SCREENSHOT = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (BLOCK_SYSTEM_SCREENSHOT) {
            window.setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            )
        }
        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = true
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            loadUrl(APP_URL)
        }
        setContentView(web)
    }

    override fun onBackPressed() {
        if (::web.isInitialized && web.canGoBack()) web.goBack()
        else super.onBackPressed()
    }
}`;

  const GRADLE = `// app/build.gradle — dependencias mínimas
plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "com.tuempresa.wenage"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.tuempresa.wenage"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }
}
dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    // Solo si usas TWA en vez de WebView:
    // implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
}`;

  const ASSETLINKS = `// https://TU-DOMINIO/.well-known/assetlinks.json (solo TWA / Play)
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.tuempresa.wenage",
    "sha256_cert_fingerprints": ["TU_SHA256_DE_FIRMA"]
  }
}]
// Obtén tu SHA-256 con:
// keytool -list -v -keystore tu-keystore.jks | grep SHA256`;

  return (
    <div className="anim-in space-y-3">
      <div className="overflow-hidden rounded-3xl border border-indigo-400/25 bg-gradient-to-br from-indigo-600/20 via-slate-900 to-slate-900 p-5">
        <p className="flex items-center gap-2 text-[15px] font-black text-white"><Smartphone size={18} className="text-indigo-300" /> Lleva Wenage a Android</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-300">Esta app <b className="text-white">ya funciona en Android</b> desde el navegador. Elige cómo distribuirla: instalación directa (PWA), ficha de Play Store (TWA) o app nativa con bloqueo real de capturas (WebView + FLAG_SECURE).</p>
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[11px] font-black">
          <div className="rounded-xl bg-emerald-400/15 p-2.5 text-emerald-200">1 · PWA<br /><span className="font-normal">5 min · sin código</span></div>
          <div className="rounded-xl bg-sky-400/15 p-2.5 text-sky-200">2 · TWA<br /><span className="font-normal">Play Store rápido</span></div>
          <div className="rounded-xl bg-violet-400/15 p-2.5 text-violet-200">3 · WebView<br /><span className="font-normal">anti-captura real</span></div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <p className="mb-2 text-[13px] font-black text-white">Guía paso a paso</p>
        <pre className="codebox whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-slate-300">{TWA_STEPS}</pre>
      </div>

      <CodeBlock title="MainActivity.kt (WebView + FLAG_SECURE)" code={MAIN_ACTIVITY} />
      <CodeBlock title="app/build.gradle" code={GRADLE} />
      <CodeBlock title="assetlinks.json (solo TWA)" code={ASSETLINKS} />

      <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4 text-[12px] leading-relaxed text-slate-300">
        <p className="flex items-center gap-1.5 font-black text-amber-200"><AlertTriangle size={14} /> Nota honesta sobre capturas</p>
        <p className="mt-1">Ninguna app web puede impedir al 100% una foto a la pantalla con otro teléfono. Lo que SÍ hace Wenage: avisos, bloqueo de menú/descarga, blur ante PrintScreen, y —si la compilas como WebView nativo con el código de arriba— <b>bloqueo de capturas a nivel sistema Android</b> (pantalla negra en screenshots y grabaciones).</p>
      </div>
    </div>
  );
}
