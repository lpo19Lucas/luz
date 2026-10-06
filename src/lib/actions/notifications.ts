"use server";

import { getCurrentSalon } from "@/lib/currentSalon";
import { notify } from "@/lib/push";

export type TestNotificationState = { error?: string; success?: string } | undefined;

/** Configurações → "Enviar notificação de teste" pros aparelhos do dono. */
export async function sendTestNotificationAction(): Promise<TestNotificationState> {
  const salon = await getCurrentSalon();
  const result = await notify({
    salonId: salon.id,
    recipient: { userId: salon.ownerId },
    type: "TEST",
    payload: { title: "Luz", body: "Notificações funcionando neste aparelho! 🎉", url: "/agenda", tag: "teste" },
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
