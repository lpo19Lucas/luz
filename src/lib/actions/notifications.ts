"use server";

import { getCurrentMember } from "@/lib/currentSalon";
import { notify } from "@/lib/push";
import { prisma } from "@/lib/prisma";
import { STAFF_NOTIFICATION_TYPES } from "@/lib/notificationTypes";

export type TestNotificationState = { error?: string; success?: string } | undefined;

/** "Enviar notificação de teste" pros aparelhos de quem está logado (dono ou profissional). */
export async function sendTestNotificationAction(): Promise<TestNotificationState> {
  const member = await getCurrentMember();
  const result = await notify({
    salonId: member.salon.id,
    recipient: { userId: member.userId },
    type: "TEST",
    payload: {
      title: "Luz",
      body: "Notificações funcionando neste aparelho! 🎉",
      url: member.role === "OWNER" ? "/agenda" : "/minha-agenda",
      tag: "teste",
    },
  });
  switch (result.status) {
    case "SENT":
      return { success: `Enviada para ${result.devices} aparelho(s).` };
    case "NO_SUBSCRIPTION":
      return { error: "Nenhum aparelho com notificações ativas. Ative neste aparelho primeiro." };
    case "DISABLED":
      return { error: "Notificações não configuradas no servidor (chaves VAPID)." };
    default:
      return { error: "Não foi possível entregar. Tente desativar e ativar de novo." };
  }
}

/**
 * Preferências: o formulário manda os tipos LIGADOS (checkbox "on");
 * guardamos os desligados — assim um tipo novo nasce ligado pra todo mundo.
 */
export async function saveNotificationPrefsAction(_prev: TestNotificationState, formData: FormData): Promise<TestNotificationState> {
  const member = await getCurrentMember();
  const available = STAFF_NOTIFICATION_TYPES.filter((t) => member.role === "OWNER" || !t.ownerOnly).map((t) => t.type);
  const enabled = new Set(formData.getAll("enabled").map(String));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: member.userId }, select: { mutedNotifications: true } });
  // Mantém silenciados os tipos que esta tela não mostra (ex.: só do dono).
  const keep = user.mutedNotifications.filter((t) => !available.includes(t));
  const muted = [...keep, ...available.filter((t) => !enabled.has(t))];
  await prisma.user.update({ where: { id: member.userId }, data: { mutedNotifications: muted } });
  return { success: "Preferências salvas." };
}
