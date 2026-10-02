"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { generateUniqueSalonSlug } from "@/lib/slug";

export type FormState = { error: string } | undefined;

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Preencha e-mail e senha." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "E-mail ou senha inválidos." };
  }

  await createSession(user.id);
  redirect("/agenda");
}

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const salonName = String(formData.get("salonName") ?? "").trim();

  if (!name || !email || !password || !salonName) {
    return { error: "Preencha todos os campos." };
  }
  if (password.length < 6) {
    return { error: "A senha precisa ter pelo menos 6 caracteres." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Já existe uma conta com esse e-mail." };
  }

  const passwordHash = await hashPassword(password);
  const slug = await generateUniqueSalonSlug(salonName);

  const user = await prisma.user.create({ data: { name, email, passwordHash } });
  const salon = await prisma.salon.create({ data: { name: salonName, slug, ownerId: user.id } });

  await prisma.subscription.create({
    data: {
      salonId: salon.id,
      plan: "TRIAL",
      status: "TRIAL",
      // Trial de 50 dias (decisão registrada em STATUS-DO-PROJETO.md).
      trialEndsAt: new Date(Date.now() + 50 * 24 * 60 * 60_000),
    },
  });
  await prisma.presenceConfirmationConfig.create({
    data: { salonId: salon.id, enabled: true, hoursBefore: 24, actionOnNoConfirm: "ALERT_ONLY" },
  });

  await createSession(user.id);
  redirect("/inicio");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
