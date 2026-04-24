import bcrypt from "bcryptjs";
import db from "../db/db";
import { newId, nowIso, MASTER_USERNAME } from "../db/seed";

const TOKEN_KEY = "salon_token";
const CURRENT_USER_KEY = "salon_current_user_id";

function unauthorized(message) {
  const err = new Error(message);
  err.response = { status: 401, data: { detail: message } };
  return err;
}

function badRequest(message) {
  const err = new Error(message);
  err.response = { status: 400, data: { detail: message } };
  return err;
}

function stripPrivate(user) {
  if (!user) return user;
  const { password: _p, hidden: _h, ...pub } = user;
  return pub;
}

export async function login({ username, email, password }) {
  // Accept either `username` (new) or `email` (legacy) for compatibility.
  const identifier = (username ?? email ?? "").trim();
  if (!identifier) throw unauthorized("بيانات الدخول غير صحيحة");

  const user = await db.users.where("email").equalsIgnoreCase(identifier).first();
  if (!user || !bcrypt.compareSync(password, user.password)) {
    throw unauthorized("بيانات الدخول غير صحيحة");
  }
  const token = `local-${user.id}-${Date.now()}`;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(CURRENT_USER_KEY, user.id);
  return { token, user: stripPrivate(user) };
}

export async function me() {
  const uid = localStorage.getItem(CURRENT_USER_KEY);
  if (!uid) throw unauthorized("Not authenticated");
  const user = await db.users.get(uid);
  if (!user) throw unauthorized("User not found");
  return stripPrivate(user);
}

export async function currentUser() {
  const uid = localStorage.getItem(CURRENT_USER_KEY);
  if (!uid) return null;
  return await db.users.get(uid);
}

export async function requireAdmin() {
  const u = await currentUser();
  if (!u || (u.role !== "admin" && u.role !== "master")) {
    const err = new Error("Admin only");
    err.response = { status: 403, data: { detail: err.message } };
    throw err;
  }
  return u;
}

/**
 * Only the hidden master developer account may pass.
 * Used to guard settings pages that expose TSE keys, backup configuration
 * and other technically sensitive fields.
 */
export async function requireMaster() {
  const u = await currentUser();
  if (!u || u.role !== "master") {
    const err = new Error("Master developer account required");
    err.response = { status: 403, data: { detail: "هذه الإعدادات متاحة فقط لحساب مصمم البرنامج" } };
    throw err;
  }
  return u;
}

export function isMasterUser(user) {
  return !!user && user.role === "master";
}

export async function registerUser(body) {
  await requireAdmin();
  const username = (body.username ?? body.email ?? "").trim();
  if (!username) throw badRequest("اسم المستخدم مطلوب");
  if (username.toLowerCase() === MASTER_USERNAME.toLowerCase()) {
    throw badRequest("اسم المستخدم محجوز");
  }
  const exists = await db.users.where("email").equalsIgnoreCase(username).first();
  if (exists) throw badRequest("اسم المستخدم موجود مسبقاً");
  const user = {
    id: newId(),
    name: body.name,
    email: username,
    password: bcrypt.hashSync(body.password, 8),
    role: body.role || "cashier",
    created_at: nowIso(),
  };
  await db.users.add(user);
  return stripPrivate(user);
}

export async function listUsers() {
  await requireAdmin();
  const rows = await db.users.toArray();
  // Hide master / internal accounts from every UI list.
  return rows.filter((r) => !r.hidden).map(stripPrivate);
}

export async function updateProfile({ name, email, username }) {
  const uid = localStorage.getItem(CURRENT_USER_KEY);
  if (!uid) throw unauthorized("Not authenticated");
  const user = await db.users.get(uid);
  if (!user) throw unauthorized("User not found");

  const nextUsername = (username ?? email ?? "").trim();

  // Protected accounts (the built-in default admin) cannot rename themselves.
  if (user.protected && nextUsername && nextUsername !== user.email) {
    throw badRequest("اسم المستخدم لهذا الحساب غير قابل للتعديل");
  }

  const patch = {};
  if (name !== undefined) patch.name = name;
  if (nextUsername && nextUsername !== user.email) {
    if (nextUsername.toLowerCase() === MASTER_USERNAME.toLowerCase()) {
      throw badRequest("اسم المستخدم محجوز");
    }
    const other = await db.users.where("email").equalsIgnoreCase(nextUsername).first();
    if (other && other.id !== uid) throw badRequest("اسم المستخدم مستخدم مسبقاً");
    patch.email = nextUsername;
  }
  if (Object.keys(patch).length) await db.users.update(uid, patch);
  const updated = await db.users.get(uid);
  return stripPrivate(updated);
}

export async function changePassword({ current_password, new_password }) {
  const uid = localStorage.getItem(CURRENT_USER_KEY);
  if (!uid) throw unauthorized("Not authenticated");
  const user = await db.users.get(uid);
  if (!user || !bcrypt.compareSync(current_password, user.password)) {
    throw unauthorized("كلمة المرور الحالية غير صحيحة");
  }
  if (!new_password || new_password.length < 4) {
    throw badRequest("كلمة المرور الجديدة قصيرة جداً (4 أحرف على الأقل)");
  }
  await db.users.update(uid, { password: bcrypt.hashSync(new_password, 8) });
  return { ok: true };
}

/**
 * Emergency password reset for the protected default account using the
 * hidden master credentials. Does NOT require an active session.
 *
 * Only the protected (non-master) account can be reset this way.
 */
export async function resetWithMaster({ master_username, master_password, target_username, new_password }) {
  const mUsername = (master_username || "").trim();
  if (mUsername.toLowerCase() !== MASTER_USERNAME.toLowerCase()) {
    throw unauthorized("بيانات حساب المستر غير صحيحة");
  }
  const master = await db.users.where("email").equalsIgnoreCase(mUsername).first();
  if (!master || !bcrypt.compareSync(master_password || "", master.password)) {
    throw unauthorized("بيانات حساب المستر غير صحيحة");
  }
  if (!new_password || new_password.length < 4) {
    throw badRequest("كلمة المرور الجديدة قصيرة جداً (4 أحرف على الأقل)");
  }

  const target = (target_username || "").trim();
  if (!target) throw badRequest("اسم الحساب المطلوب إعادة تعيينه مفقود");
  // Never allow resetting the master via this endpoint.
  if (target.toLowerCase() === MASTER_USERNAME.toLowerCase()) {
    throw badRequest("لا يمكن إعادة تعيين هذا الحساب");
  }
  const user = await db.users.where("email").equalsIgnoreCase(target).first();
  if (!user) throw badRequest("الحساب غير موجود");
  if (user.hidden) throw badRequest("لا يمكن إعادة تعيين هذا الحساب");

  await db.users.update(user.id, { password: bcrypt.hashSync(new_password, 8) });
  return { ok: true };
}
