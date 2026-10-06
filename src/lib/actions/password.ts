"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { getCurrentSalon } from "@/lib/currentSalon";
import { requestPasswordReset, resetPasswordWithToken, changePassword, PasswordResetError } from "@/lib/passwordReset";
import { isRateLimited, recordAuthAttempt, clientIpFromHeaders, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";

export type PasswordFormState = { error?: string; success?: string } | undefined;

/** "Esqueci minha senha" — resposta sempre igual, exista a conta ou não. */
export async function requestPasswordResetAction(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Informe o e-mail da conta." };

  // Limite por IP (o limite por conta fica em requestPasswordReset).
  const key = `reset-ip:${clientIpFromHeaders(await headers())}`;
  if (await isRateLimited(key)) return { error: RATE_LIMIT_MESSAGE };
  await recordAuthAttempt(key, false);

  await requestPasswordReset(email);
  return {
    success:
      "Se existir uma conta com esse e-mail, enviamos um link para criar uma nova senha. Confira também a caixa de spam. Não recebeu? Fale com o suporte.",
  };
}

/** Link de redefinição/convite: define a senha e já entra no painel. */
export async function resetPasswordAction(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  let result: Awaited<ReturnType<typeof resetPasswordWithToken>>;
  try {
    result = await resetPasswordWithToken({
      token: String(formData.get("token") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmation: String(formData.get("confirmation") ?? ""),
      acceptTerms: formData.get("acceptTerms") === "on",
    });
  } catch (err) {
    if (err instanceof PasswordResetError) return { error: err.message };
    throw err;
  }

  await createSession(result.userId);
  redirect(result.purpose === "INVITE" ? "/inicio" : "/agenda");
}

/** Configurações → Alterar senha. */
export async function changePasswordAction(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  const salon = await getCurrentSalon();
  try {
    await changePassword({
      userId: salon.ownerId,
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword: String(formData.get("newPassword") ?? ""),
      confirmation: String(formData.get("confirmation") ?? ""),
    });
  } catch (err) {
    if (err instanceof PasswordResetError) return { error: err.message };
    throw err;
  }
  // A troca derruba as sessões antigas (inclusive a atual) — emite uma nova
  // pra este navegador continuar logado; os outros dispositivos saem.
  await createSession(salon.ownerId);
  return { success: "Senha alterada. Outros dispositivos conectados foram desconectados." };
}
