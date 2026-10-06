import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { resolveMember } from "@/lib/members";
import { dispatchInBackground } from "@/lib/staffNotifications";
import { sendBookingConfirmedToClient } from "@/lib/clientNotifications";
import { getVapidPublicKey, isPushConfigured, isValidSubscription, removeSubscription, saveSubscription } from "@/lib/push";

/**
 * /api/push/subscription — inscrição do aparelho pra notificações push.
 *
 * GET    → chave pública VAPID (o navegador precisa dela pra se inscrever).
 * POST   { subscription, accessToken? }
 *          com accessToken: aparelho do CLIENTE daquele agendamento;
 *          sem: aparelho do DONO ou PROFISSIONAL logado (sessão).
 * DELETE { endpoint } → desinscreve este aparelho.
 */

export function GET() {
  return NextResponse.json({ configured: isPushConfigured(), publicKey: getVapidPublicKey() });
}

export async function POST(req: NextRequest) {
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Notificações não configuradas" }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { subscription?: unknown; accessToken?: string } | null;
  if (!body || !isValidSubscription(body.subscription)) {
    return NextResponse.json({ error: "Inscrição inválida" }, { status: 400 });
  }
  const userAgent = req.headers.get("user-agent");

  if (body.accessToken) {
    const appointment = await prisma.appointment.findUnique({
      where: { accessToken: body.accessToken },
      select: { salonId: true, clientId: true },
    });
    if (!appointment) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    await saveSubscription(body.subscription, { salonId: appointment.salonId, clientId: appointment.clientId }, userAgent);
    // Resposta imediata de que deu certo ("você vai receber o lembrete...").
    const token = body.accessToken;
    dispatchInBackground(() => sendBookingConfirmedToClient(token));
    return NextResponse.json({ ok: true, audience: "client" });
  }

  // Sem token: aparelho de quem está logado — dono ou profissional (Fase P).
  const member = await resolveMember(await getSession());
  if (!member) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  await saveSubscription(body.subscription, { salonId: member.salon.id, userId: member.userId }, userAgent);
  return NextResponse.json({ ok: true, audience: member.role === "OWNER" ? "owner" : "professional" });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "endpoint obrigatório" }, { status: 400 });
  // Quem tem o endpoint é o próprio navegador inscrito — ele é o segredo.
  await removeSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
