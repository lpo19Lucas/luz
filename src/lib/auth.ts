import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

/**
 * Sessão do dono via cookie httpOnly assinado (JWT). Sem NextAuth: pro
 * caso de uso (1 dono = 1 conta simples), uma lib inteira de auth seria
 * over-engineering — isso é ~60 linhas e dá pra entender de ponta a ponta.
 */

const SESSION_COOKIE = "session";
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 dias

const ADMIN_SESSION_COOKIE = "admin_session";
const ADMIN_SESSION_DURATION_SECONDS = 12 * 60 * 60; // 12 horas — sessão de admin dura menos

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET não configurada (ver .env.example).");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * `issuedAt` (segundos, do `iat` do JWT) permite derrubar sessões antigas
 * depois de uma troca de senha — ver isSessionStillValid.
 */
export async function getSession(): Promise<{ userId: string; issuedAt: number } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.userId !== "string") return null;
    return { userId: payload.userId, issuedAt: typeof payload.iat === "number" ? payload.iat : 0 };
  } catch {
    return null;
  }
}

/**
 * Uma sessão do dono continua valendo se a conta não foi bloqueada pelo
 * admin e se foi emitida depois da última troca de senha. O `iat` do JWT tem
 * resolução de segundos, então compara em segundos (uma sessão criada no
 * mesmo segundo da troca — o login logo depois de redefinir — continua válida).
 */
export function isSessionStillValid(
  session: { issuedAt: number },
  user: { disabledAt: Date | null; passwordChangedAt: Date | null }
) {
  if (user.disabledAt) return false;
  if (user.passwordChangedAt && session.issuedAt < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    return false;
  }
  return true;
}

/**
 * Sessão da tela de administração da plataforma (/admin — item 4 das
 * pendências: conciliação manual de assinatura). Sem User próprio: é uma
 * senha única compartilhada (`ADMIN_PASSWORD`), suficiente pro volume de
 * quem opera a plataforma hoje (só o próprio dono do produto).
 */
export async function createAdminSession() {
  const token = await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_DURATION_SECONDS,
  });
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export async function getAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.admin === true;
  } catch {
    return false;
  }
}
