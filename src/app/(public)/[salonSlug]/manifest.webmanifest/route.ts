import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSalonManifest } from "@/lib/pwa";

/**
 * GET /:salonSlug/manifest.webmanifest — app do estabelecimento pro cliente:
 * nome e cor do salão, abre na página dele.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ salonSlug: string }> }) {
  const { salonSlug } = await params;
  const salon = await prisma.salon.findUnique({
    where: { slug: salonSlug },
    select: { name: true, slug: true, primaryColor: true },
  });
  if (!salon) return NextResponse.json({ error: "Salão não encontrado" }, { status: 404 });
  return NextResponse.json(buildSalonManifest(salon), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
