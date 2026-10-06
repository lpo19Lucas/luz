import { prisma } from "@/lib/prisma";
import { LEGAL_VERSION } from "@/lib/legal";

/**
 * O dono precisa (re)aceitar os documentos quando nunca aceitou (contas
 * criadas antes dos termos existirem, convites do admin) ou quando a versão
 * aceita é anterior à atual (LEGAL_VERSION mudou).
 */
export function needsTermsAcceptance(user: { termsVersion: string | null }) {
  return user.termsVersion !== LEGAL_VERSION;
}

export async function acceptCurrentTerms(userId: string, now: Date = new Date()) {
  await prisma.user.update({ where: { id: userId }, data: { termsAcceptedAt: now, termsVersion: LEGAL_VERSION } });
}
