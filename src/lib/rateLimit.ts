import { prisma } from "@/lib/prisma";

/**
 * Limite de tentativas de autenticação (login do dono e do /admin) contra
 * força bruta. Guardado no banco (tabela auth_attempts) porque na Vercel
 * cada request pode cair numa instância diferente — contador em memória não
 * funcionaria.
 *
 * Regra: mais de MAX_FAILURES falhas na janela de WINDOW_MS, contadas depois
 * do último sucesso, bloqueiam novas tentativas até a falha mais antiga sair
 * da janela.
 */
export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60_000;
const RETENTION_MS = 24 * 60 * 60_000;

export async function isRateLimited(key: string, now: Date = new Date()): Promise<boolean> {
  const windowStart = new Date(now.getTime() - WINDOW_MS);
  const lastSuccess = await prisma.authAttempt.findFirst({
    where: { key, success: true, createdAt: { gte: windowStart } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const since = lastSuccess?.createdAt ?? windowStart;
  const failures = await prisma.authAttempt.count({
    where: { key, success: false, createdAt: { gt: since } },
  });
  return failures >= MAX_FAILURES;
}

export async function recordAuthAttempt(key: string, success: boolean, now: Date = new Date()) {
  await prisma.authAttempt.create({ data: { key, success, createdAt: now } });
  // Faxina barata: só as linhas antigas da própria chave.
  await prisma.authAttempt.deleteMany({
    where: { key, createdAt: { lt: new Date(now.getTime() - RETENTION_MS) } },
  });
}

export const RATE_LIMIT_MESSAGE = "Muitas tentativas. Aguarde 15 minutos e tente de novo.";

/** IP do cliente a partir dos headers do proxy (Vercel manda x-forwarded-for). */
export function clientIpFromHeaders(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "desconhecido";
}
