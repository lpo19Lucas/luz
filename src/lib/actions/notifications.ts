"use server";

import { getCurrentMember } from "@/lib/currentSalon";
import { notify } from "@/lib/push";

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
