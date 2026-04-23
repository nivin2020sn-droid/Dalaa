import bcrypt from "bcryptjs";
import db from "../db/db";
import { newId, nowIso } from "../db/seed";

const TOKEN_KEY = "salon_token";
const CURRENT_USER_KEY = "salon_current_user_id";

export async function login({ email, password }) {
  const user = await db.users.where("email").equals(email).first();
  if (!user || !bcrypt.compareSync(password, user.password)) {
    const err = new Error("بيانات الدخول غير صحيحة");
    err.response = { status: 401, data: { detail: err.message } };
    throw err;
  }
  const token = `local-${user.id}-${Date.now()}`;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(CURRENT_USER_KEY, user.id);
  const { password: _p, ...publicUser } = user;
  return { token, user: publicUser };
}

export async function me() {
  const uid = localStorage.getItem(CURRENT_USER_KEY);
  if (!uid) {
    const err = new Error("Not authenticated");
    err.response = { status: 401, data: { detail: err.message } };
    throw err;
  }
  const user = await db.users.get(uid);
  if (!user) {
    const err = new Error("User not found");
    err.response = { status: 401, data: { detail: err.message } };
    throw err;
  }
  const { password: _p, ...publicUser } = user;
  return publicUser;
}

export async function currentUser() {
  const uid = localStorage.getItem(CURRENT_USER_KEY);
  if (!uid) return null;
  return await db.users.get(uid);
}

export async function requireAdmin() {
  const u = await currentUser();
  if (!u || u.role !== "admin") {
    const err = new Error("Admin only");
    err.response = { status: 403, data: { detail: err.message } };
    throw err;
  }
  return u;
}

export async function registerUser(body) {
  await requireAdmin();
  const exists = await db.users.where("email").equals(body.email).first();
  if (exists) {
    const err = new Error("Email already exists");
    err.response = { status: 400, data: { detail: err.message } };
    throw err;
  }
  const user = {
    id: newId(),
    name: body.name,
    email: body.email,
    password: bcrypt.hashSync(body.password, 8),
    role: body.role || "cashier",
    created_at: nowIso(),
  };
  await db.users.add(user);
  const { password: _p, ...pub } = user;
  return pub;
}

export async function listUsers() {
  await requireAdmin();
  const rows = await db.users.toArray();
  return rows.map(({ password: _p, ...r }) => r);
}
