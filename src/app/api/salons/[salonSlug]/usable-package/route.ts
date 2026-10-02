import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { findUsablePackageForAppointment } from "@/lib/packages";

/**
 * GET /api/salons/:salonSlug/usable-package?phone=&serviceId=
 *
 * Pacote ativo do cliente (pelo telefone) que cubra esse serviço — usado
 * pela tela pública de agendamento pra oferecer "usar meu pacote" sem exigir
 * login do cliente (mesma identificação por telefone do resto do produto).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ salonSlug: string }> }) {
  const { salonSlug } = await params;
  const phone = req.nextUrl.searchParams.get("phone");
  const serviceId = req.nextUrl.searchParams.get("serviceId");
  if (!phone || !serviceId) {
    return NextResponse.json({ usablePackage: null });
  }

  const salon = await prisma.salon.findUnique({ where: { slug: salonSlug } });
  if (!salon) return NextResponse.json({ usablePackage: null });

  const client = await prisma.client.findUnique({
    where: { salonId_phone: { salonId: salon.id, phone: normalizePhone(phone) } },
  });
  if (!client || client.bannedAt) return NextResponse.json({ usablePackage: null });

  const service = await prisma.service.findFirst({ where: { id: serviceId, salonId: salon.id } });
  if (!service) return NextResponse.json({ usablePackage: null });

  const usable = await findUsablePackageForAppointment({
    salonId: salon.id,
    clientId: client.id,
    serviceId,
    priceCents: service.priceCents,
  });

  return NextResponse.json({
    usablePackage: usable ? { id: usable.id, name: usable.packageDefinition.name } : null,
  });
}
