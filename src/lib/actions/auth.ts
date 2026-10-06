"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { provisionSalon, ProvisionError } from "@/lib/salonProvisioning";
import { isRateLimited, recordAuthAttempt, clientIpFromHeaders, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";

export type FormState = { error: string } | undefined;

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Preencha e-mail e senha." };
  }

  // Duas chaves: por e-mail (ataque a uma conta) e por IP (um IP testando
  // várias contas). Qualquer uma estourada bloqueia.
  const ip = clientIpFromHeaders(await headers());
  const keys = [`login:${email}`, `login-ip:${ip}`];
  for (const key of keys) {
    if (await isRateLimited(key)) return { error: RATE_LIMIT_MESSAGE };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = Boolean(user && (await verifyPassword(password, user.passwordHash)));
  await Promise.all(keys.map((key) => recordAuthAttempt(key, ok)));

  if (!user || !ok) {
    return { error: "E-mail ou senha inválidos." };
  }
  if (user.disabledAt) {
    return { error: "Esta conta está bloqueada. Fale com o suporte da Luz." };
  }

  await createSession(user.id);
  redirect("/agenda");
}

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const salonName = String(formData.get("salonName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const acceptTerms = formData.get("acceptTerms") === "on";

  if (!name || !email || !password || !salonName) {
    return { error: "Preencha todos os campos." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  }
  if (!acceptTerms) {
    return { error: "Para criar a conta, aceite os Termos de Uso, a Política de Privacidade e o Contrato." };
  }

  let userId: string;
  try {
    const { user } = await provisionSalon({
      ownerName: name,
      email,
      phone,
      passwordHash: await hashPassword(password),
      salonName,
      termsAccepted: true,
    });
    userId = user.id;
  } catch (err) {
    if (err instanceof ProvisionError) return { error: err.message };
    throw err;
  }

  await createSession(userId);
  redirect("/inicio");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
