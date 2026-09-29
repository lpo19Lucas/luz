import { PrismaClient } from "@prisma/client";

// Singleton padrão pra evitar esgotar conexões em dev (hot reload do Next.js).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Helper "escopado por salão" — ver arquitetura-modelo-de-dados.md, seção 2.
 * Toda leitura/escrita que pertence a um salão deveria passar por aqui,
 * em vez de montar `where: { salonId }` manualmente em cada query.
 * Começa simples (repassa salonId pros métodos que já aceitam where);
 * o objetivo é ter UM lugar pra evoluir se decidirmos reforçar isolamento
 * (ex.: Row-Level Security) mais pra frente.
 */
export function scopedToSalon(salonId: string) {
  return {
    professional: {
      findMany: (args: Parameters<typeof prisma.professional.findMany>[0] = {}) =>
        prisma.professional.findMany({ ...args, where: { ...args.where, salonId } }),
    },
    service: {
      findMany: (args: Parameters<typeof prisma.service.findMany>[0] = {}) =>
        prisma.service.findMany({ ...args, where: { ...args.where, salonId } }),
    },
    appointment: {
      findMany: (args: Parameters<typeof prisma.appointment.findMany>[0] = {}) =>
        prisma.appointment.findMany({ ...args, where: { ...args.where, salonId } }),
    },
    // Adicionar os outros modelos (client, subscription, etc.) conforme forem
    // sendo usados de verdade — não vale a pena adiantar todos agora.
  };
}
