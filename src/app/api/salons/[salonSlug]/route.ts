import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storedImageUrl } from "@/lib/storedImages";

/**
 * GET /api/salons/:salonSlug
 *
 * Dados públicos do salão pra montar a tela de agendamento self-service
 * (spec seção 8.4): profissionais ativos, serviços, e quais profissionais
 * fazem quais serviços.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ salonSlug: string }> }
) {
  const { salonSlug } = await params;
  const salon = await prisma.salon.findUnique({
    where: { slug: salonSlug },
    include: {
      professionals: {
        where: { active: true },
        include: { services: { select: { serviceId: true } } },
      },
      services: true,
    },
  });

  if (!salon) {
    return NextResponse.json({ error: "Salão não encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    id: salon.id,
    name: salon.name,
    slug: salon.slug,
    professionals: salon.professionals.map((p) => ({
      id: p.id,
      name: p.name,
      photoUrl: storedImageUrl(p.photoImageId) ?? p.photoUrl,
      serviceIds: p.services.map((s) => s.serviceId),
    })),
    services: salon.services.map((s) => ({
      id: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
      priceCents: s.priceCents,
      imageUrl: storedImageUrl(s.imageId),
    })),
  });
}
