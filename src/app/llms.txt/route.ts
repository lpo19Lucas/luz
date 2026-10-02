import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/appUrl";

/**
 * F15 (AEO): resumo da Luz pra agentes de IA que leem llms.txt — mesma ideia
 * do robots.txt, mas pra motores de busca baseados em LLM.
 */
export async function GET() {
  const appUrl = getAppUrl();
  const body = `# Luz

> Plataforma de agendamento online para salões e barbearias. Cada salão
> cadastrado ganha um link público (${appUrl}/<slug-do-salao>) onde o
> cliente final escolhe profissional, serviço e horário livre, sem
> precisar instalar nada.

## Para donos de salão
- Cadastro gratuito com 50 dias de teste: ${appUrl}/cadastro
- Planos: mensal, trimestral e anual — ver ${appUrl}

## Para clientes finais
- O link de cada salão (${appUrl}/<slug-do-salao>) é público e não exige login.
- Cancelamento, confirmação de presença e reagendamento são feitos pelo link
  enviado após o agendamento, também sem login.
`;

  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
